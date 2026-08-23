using Madplan.Core.Model;
using Madplan.Core.Parsing;
using Madplan.Data;
using Madplan.Nemlig.Contracts;
using Microsoft.EntityFrameworkCore;

namespace Madplan.Web.Services;

/// <summary>Kobler råvarer til nemlig-varer automatisk, og vælger den billigste
/// pr. enhed.
///
/// Hvorfor automatisk er forsvarligt her: appen skriver ikke til nemlig. Et
/// forkert valg giver et upræcist budget, ikke en forkert vare i en kurv. Da
/// biblioteket skal rumme hundredvis af opskrifter, ville et krav om manuel
/// bekræftelse af hver enkelt råvare betyde at budgetfunktionen aldrig kom i
/// gang. Valget markeres som automatisk, så et menneske kan gennemgå det bagefter
/// — et review frem for en forudsætning.
///
/// «Billigst» betyder billigst pr. enhed, og valget GEMMES. Så koster den samme
/// ret det samme fra uge til uge, i stedet for at skifte mærke hver gang nogen
/// sætter noget på tilbud.</summary>
public class AutoMapper(
    MadplanDbContext db,
    ProductSuggester suggester,
    INemligCatalog catalog,
    ILogger<AutoMapper> log)
{
    public record Result(int Mapped, int NoCandidates, int AlreadyMapped)
    {
        public int Total => Mapped + NoCandidates + AlreadyMapped;
    }

    /// <summary>Mapper alle råvarer der mangler en vare. Kører sekventielt, fordi
    /// rate limiteren alligevel slipper ét kald igennem ad gangen.</summary>
    public async Task<Result> MapAllUnmappedAsync(
        IProgress<string>? progress = null, CancellationToken ct = default)
    {
        var mappedFoodIds = await db.ProductMappings.Select(m => m.FoodId).Distinct().ToListAsync(ct);

        // KUN råvarer der faktisk bruges i en opskrift. Databasen indeholder også
        // ~30 råvarer der alene findes for at bære en densitetsomregning
        // (majsstivelse, rugflager, quinoa …). At slå dem op ville være et kald
        // til nemlig for hver, til data ingen har brug for — dårlig gæsteopførsel
        // og forvirrende tal i statusbeskeden.
        var usedFoodIds = await db.RecipeIngredients
            .Where(i => i.FoodId != null)
            .Select(i => i.FoodId!.Value)
            .Distinct()
            .ToListAsync(ct);

        var unmapped = await db.Foods
            .Where(f => !f.IsPantryStaple
                     && usedFoodIds.Contains(f.Id)
                     && !mappedFoodIds.Contains(f.Id))
            .OrderBy(f => f.CanonicalName)
            .ToListAsync(ct);

        var mapped = 0;
        var none = 0;

        foreach (var food in unmapped)
        {
            ct.ThrowIfCancellationRequested();
            progress?.Report(food.CanonicalName);

            try
            {
                if (await MapOneAsync(food, ct) is not null) mapped++;
                else none++;
            }
            catch (NemligUnavailableException ex)
            {
                log.LogWarning("Auto-mapping stoppet ved «{Food}»: {Reason}", food.CanonicalName, ex.Reason);
                break; // circuit breaker har talt; det nytter ikke at fortsætte
            }
        }

        return new Result(mapped, none, mappedFoodIds.Count);
    }

    /// <summary>Finder og gemmer den billigste brugbare vare til én råvare.
    /// Returnerer null hvis der ikke var nogen brugbar kandidat.</summary>
    public async Task<ProductMapping?> MapOneAsync(Food food, CancellationToken ct = default)
    {
        var units = await db.Units.ToListAsync(ct);

        // KUN varer vi faktisk har købt eller som et menneske har bekræftet.
        // Tidligere sendte vi alle mapninger med, inklusive dem auto-mapperen
        // selv havde lavet et øjeblik før — og «købt før» vejer +100. Resultatet
        // var at den første råvare i alfabetet lagde beslag på sin vare for alle
        // de følgende: «cherrytomater» blev valgt, og bagefter arvede «flåede
        // tomater» det match. Prioriteten skal komme fra adfærd, ikke fra
        // maskinens egne gæt.
        var actuallyBought = await db.ProductMappings
            .Where(m => m.Source == MappingSource.Ordrehistorik || m.ConfirmedAt != null)
            .Select(m => m.NemligProductId)
            .Distinct()
            .ToListAsync(ct);

        var suggestions = await suggester.SuggestAsync(food, actuallyBought, ct);
        if (suggestions.Count == 0) return null;

        var valg = Choose(food, suggestions);
        var p = valg.Product;
        var (packSize, packUnit) = await ChoosePackageAsync(food, p, units, ct);

        var mapping = new ProductMapping
        {
            FoodId = food.Id,
            NemligProductId = p.Id,
            ProductName = p.Name,
            ProductUrl = p.Url,
            PackageSize = packSize,
            PackageUnitId = packUnit.Id,
            IsPreferred = true,
            Source = MappingSource.Forslag,   // automatisk — ikke bekræftet af et menneske
        };

        db.ProductMappings.Add(mapping);
        db.ProductSnapshots.Add(new ProductSnapshot
        {
            NemligProductId = p.Id, Price = p.Price, UnitPrice = p.UnitPrice,
            UnitPriceLabel = p.UnitPriceLabel, InStock = p.InStock, Description = p.Description,
        });

        await db.SaveChangesAsync(ct);
        return mapping;
    }

    /// <summary>Kobler en råvare til en vare NOGEN ANDEN har udpeget — i praksis
    /// nemlig selv, via deres egne opskrifter. Vi vælger altså ikke varen her;
    /// vi slår den op for at få pakkestørrelsen, som er det indkøbslisten regner
    /// på.
    ///
    /// Kan varen ikke slås op, skrives der INGEN mapning. Det er fristende at
    /// gemme «1 stk» og komme videre, men den løgn er dyrere end den ser ud:
    /// en opskrift der beder om 500 g rammer så uenigheden mellem vægt og
    /// styk og bliver til «kan ikke beregnes» — og fordi råvaren nu tæller som
    /// mappet, prøver auto-mapperen den aldrig igen. Et hul er bedre end en
    /// blokering, for hullet fylder auto-mapperen selv ud bagefter.</summary>
    public async Task<ProductMapping?> MapToKnownProductAsync(
        Food food, string productId, string? productUrl = null, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(productId)) return null;

        NemligProductDetail? detalje;
        try
        {
            detalje = await catalog.GetProductAsync(productId, productUrl, ct: ct);
        }
        catch (NemligUnavailableException ex)
        {
            log.LogInformation("Kunne ikke slå vare {Id} op til {Food}: {Grund}",
                               productId, food.CanonicalName, ex.Reason);
            return null;
        }

        if (detalje?.Product is null) return null;

        var units = await db.Units.ToListAsync(ct);
        var p = detalje.Product;
        var (packSize, packUnit) = await ChoosePackageAsync(food, p, units, ct);

        var mapping = new ProductMapping
        {
            FoodId = food.Id,
            NemligProductId = p.Id,
            ProductName = p.Name,
            ProductUrl = p.Url,
            PackageSize = packSize,
            PackageUnitId = packUnit.Id,
            IsPreferred = true,
            Source = MappingSource.Forslag,   // nemligs valg, ikke husstandens
        };

        db.ProductMappings.Add(mapping);
        db.ProductSnapshots.Add(new ProductSnapshot
        {
            NemligProductId = p.Id, Price = p.Price, UnitPrice = p.UnitPrice,
            UnitPriceLabel = p.UnitPriceLabel, InStock = p.InStock, Description = p.Description,
        });

        await db.SaveChangesAsync(ct);
        return mapping;
    }

    /// <summary>Reglen for hvilken vare der vælges. Trukket ud som en ren
    /// funktion, fordi det er her de stille fejl opstår, og fordi den så kan
    /// testes uden en database.
    ///
    /// To trin, og forskellen mellem dem er hele pointen:
    ///
    ///   1. Er der kandidater der matcher råvarens navn på HELE ord, er det dem
    ///      vi vælger imellem. Blandt dem tager vi den billigste pr. enhed.
    ///      «Løg» slår «Hvidløg», selvom hvidløg også dukker op i en søgning.
    ///
    ///   2. Matcher ingen på hele ord — dansk sætter ord sammen, så «mælk» findes
    ///      hverken i «letmælk» eller «kokosmælk» som selvstændigt ord — så kan
    ///      navnet ikke afgøre sagen. Så lader vi være med at lade som om, og
    ///      tager den billigste pr. enhed blandt alle kandidater. Det er både
    ///      ærligere og præcis det I har bedt om.</summary>
    internal static ProductSuggester.Suggestion Choose(
        Food food, IReadOnlyList<ProductSuggester.Suggestion> suggestions)
    {
        var wanted = FoodNormalizer.Normalize(food.CanonicalName)
            .Split(' ', StringSplitOptions.RemoveEmptyEntries);

        bool HeleOrdMatcher(ProductSuggester.Suggestion s)
        {
            var have = FoodNormalizer.Normalize(s.Product.Name)
                .Split(' ', StringSplitOptions.RemoveEmptyEntries);
            return wanted.Length > 0 && wanted.All(have.Contains);
        }

        var eksakte = suggestions.Where(HeleOrdMatcher).ToList();
        var pulje = eksakte.Count > 0 ? eksakte : suggestions;

        // På lager foretrækkes, men en udsolgt vare er bedre end ingen mapning:
        // prisen er stadig rigtig, og varen er der igen næste uge.
        return pulje.Where(s => s.Product.InStock)
                    .OrderBy(s => UnitPriceOrFallback(s.Product))
                    .FirstOrDefault()
               ?? pulje.OrderBy(s => UnitPriceOrFallback(s.Product)).First();
    }

    /// <summary>Vælger pakkestørrelse OG enhed, så de passer til den måde
    /// råvaren faktisk bruges på i opskrifterne.
    ///
    /// Nemligs enhedspris giver en pakkestørrelse i vægt eller rumfang — «flåede
    /// tomater» bliver til 400 g. Men opskriften siger «1 dåse», altså et STYK.
    /// Sammenligner man de to, kommer der vrøvl ud: «du køber 399,92 for at bruge 1».
    /// Måles råvaren i styk i opskrifterne, er den rigtige pakkestørrelse derfor
    /// 1 stk — én dåse er én dåse.</summary>
    private async Task<(double Size, Unit Unit)> ChoosePackageAsync(
        Food food, NemligProduct product, List<Unit> units, CancellationToken ct)
    {
        var stk = units.First(u => u.Abbreviation == "stk");

        // Hvilken enhedstype bruges råvaren i? Tag den hyppigste.
        var brugteEnheder = await db.RecipeIngredients
            .Where(i => i.FoodId == food.Id && i.UnitId != null)
            .Select(i => i.UnitId!.Value)
            .ToListAsync(ct);

        var dominerende = brugteEnheder
            .Select(id => units.FirstOrDefault(u => u.Id == id))
            .Where(u => u is not null)
            .GroupBy(u => u!.Type)
            .OrderByDescending(g => g.Count())
            .Select(g => (UnitType?)g.Key)
            .FirstOrDefault();

        if (dominerende == UnitType.Count) return (1, stk);

        var guess = product.GuessPackageSize();
        if (guess is null) return (1, stk);

        var gaettetEnhed = units.FirstOrDefault(u => u.Abbreviation == guess.Value.Unit) ?? stk;

        // Passer gættet ikke til brugen, er 1 stk et ærligere svar end et tal
        // i den forkerte enhed.
        return dominerende is not null && gaettetEnhed.Type != dominerende
            ? (1, stk)
            : (guess.Value.Size, gaettetEnhed);
    }

    /// <summary>Enhedsprisen er den rigtige at sammenligne på — en pose ris til
    /// 30 kr. er billigere end en til 20 kr., hvis den første rummer dobbelt så
    /// meget. Mangler den, falder vi tilbage på stykprisen frem for at udelade
    /// varen helt.</summary>
    private static decimal UnitPriceOrFallback(NemligProduct p) =>
        p.UnitPrice is > 0 ? p.UnitPrice.Value : p.Price;
}
