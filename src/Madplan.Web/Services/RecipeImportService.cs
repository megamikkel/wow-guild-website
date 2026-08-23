using Madplan.Core.Model;
using Madplan.Core.Parsing;
using Madplan.Data;
using Madplan.Nemlig.Contracts;
using Madplan.Recipes;
using Microsoft.EntityFrameworkCore;

namespace Madplan.Web.Services;

/// <summary>Gemmer hentede opskrifter i databasen og opretter de råvarer der
/// mangler undervejs.
///
/// Attribution gemmes altid: kilde-URL, sidens navn og forfatteren. Vi cacher
/// til privat husholdningsbrug og publicerer intet — se docs/opskriftskilder.md §7.</summary>
public class RecipeImportService(
    MadplanDbContext db,
    RecipeFetcher fetcher,
    FoodResolver foods,
    INemligRecipes nemligRecipes,
    AutoMapper autoMapper,
    ILogger<RecipeImportService> log)
{
    public record ImportResult(string Url, string? Title, string? Error, bool Skipped)
    {
        public bool Ok => Error is null && !Skipped;
    }

    public async Task<IReadOnlyList<ImportResult>> ImportAsync(
        IEnumerable<string> urls,
        IProgress<ImportResult>? progress = null,
        CancellationToken ct = default)
    {
        var results = new List<ImportResult>();

        foreach (var url in urls.Select(u => u.Trim()).Where(u => u.Length > 0).Distinct())
        {
            ct.ThrowIfCancellationRequested();

            // Allerede importeret? Så lader vi kilden være i fred.
            if (await db.Recipes.AnyAsync(r => r.SourceUrl == url, ct))
            {
                var eksisterende = await db.Recipes
                    .Where(r => r.SourceUrl == url).Select(r => r.Title).FirstAsync(ct);
                var skip = new ImportResult(url, eksisterende, null, Skipped: true);
                results.Add(skip);
                progress?.Report(skip);
                continue;
            }

            var fetched = await fetcher.FetchAsync(url, ct);
            if (!fetched.Ok)
            {
                var fail = new ImportResult(url, null, fetched.Error, false);
                results.Add(fail);
                progress?.Report(fail);
                continue;
            }

            try
            {
                var recipe = await SaveAsync(fetched.Recipe!, ct);
                var ok = new ImportResult(url, recipe.Title, null, false);
                results.Add(ok);
                progress?.Report(ok);
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Kunne ikke gemme opskrift fra {Url}", url);
                var fail = new ImportResult(url, fetched.Recipe!.Title, $"Kunne ikke gemmes: {ex.Message}", false);
                results.Add(fail);
                progress?.Report(fail);
            }
        }

        return results;
    }

    /// <summary>Finder alle opskriftslinks på en oversigtsside, så ét link kan
    /// blive til tredive opskrifter.</summary>
    public Task<(IReadOnlyList<string> Links, string? Error)> FindLinksAsync(
        string pageUrl, CancellationToken ct = default) => fetcher.FindLinksAsync(pageUrl, ct);

    /// <summary>Importerer fra nemligs eget opskriftsunivers.
    ///
    /// Er ingredienserne allerede knyttet til varenumre, gemmer vi mapningen med
    /// det samme — så er projektets sværeste problem løst for den ret, uden at
    /// nogen skal vælge en vare.</summary>
    public async Task<IReadOnlyList<ImportResult>> ImportFromNemligAsync(
        string query, int take,
        IProgress<ImportResult>? progress = null, CancellationToken ct = default)
    {
        var results = new List<ImportResult>();

        IReadOnlyList<NemligRecipe> fundne;
        try
        {
            fundne = await nemligRecipes.SearchRecipesAsync(query, take, ct);
        }
        catch (NemligUnavailableException ex)
        {
            return [new ImportResult(query, null, ex.Message, false)];
        }

        foreach (var indeks in fundne)
        {
            ct.ThrowIfCancellationRequested();
            if (indeks.Url is null) continue;

            var kilde = $"https://www.nemlig.com{indeks.Url}";
            if (await db.Recipes.AnyAsync(r => r.SourceUrl == kilde, ct))
            {
                var skip = new ImportResult(kilde, indeks.Name, null, Skipped: true);
                results.Add(skip); progress?.Report(skip);
                continue;
            }

            try
            {
                var fuld = await nemligRecipes.GetRecipeAsync(indeks.Url, ct);
                if (fuld is null || fuld.Ingredients.Count == 0)
                {
                    var fejl = new ImportResult(kilde, indeks.Name,
                        "Kunne ikke læse ingredienserne.", false);
                    results.Add(fejl); progress?.Report(fejl);
                    continue;
                }

                await SaveNemligAsync(fuld, kilde, ct);
                var ok = new ImportResult(kilde, fuld.Name, null, false);
                results.Add(ok); progress?.Report(ok);
            }
            catch (NemligUnavailableException ex)
            {
                var fejl = new ImportResult(kilde, indeks.Name, ex.Message, false);
                results.Add(fejl); progress?.Report(fejl);
                break;   // circuit breaker har talt
            }
        }

        return results;
    }

    private async Task SaveNemligAsync(NemligRecipe r, string kilde, CancellationToken ct)
    {
        var scraped = new ScrapedRecipe(
            Title: r.Name,
            Ingredients: r.Ingredients,
            Instructions: r.Instructions,
            Servings: r.Servings,
            TotalMinutes: MinutterFra(r.TotalTime),
            ImageUrl: null,
            SourceUrl: kilde,
            SourceName: "nemlig.com",
            Author: null,
            Categories: []);

        var recipe = await SaveAsync(scraped, ct);

        // Har nemlig selv koblet ingredienserne til varer, tager vi imod.
        // Kilden markeres som Forslag: det er nemligs valg, ikke husstandens,
        // og et menneske kan skifte varen bagefter.
        if (!r.HasMappedProducts) return;

        var varenumre = VarenumreEfterLinjenummer(r.Lines);

        var ingredienser = await db.RecipeIngredients
            .Where(i => i.RecipeId == recipe.Id && i.FoodId != null)
            .OrderBy(i => i.SortOrder).ToListAsync(ct);

        foreach (var ing in ingredienser)
        {
            if (!varenumre.TryGetValue(ing.SortOrder, out var linje)) continue;

            var foodId = ing.FoodId!.Value;
            if (await db.ProductMappings.AnyAsync(m => m.FoodId == foodId, ct)) continue;

            var food = await db.Foods.FirstOrDefaultAsync(f => f.Id == foodId, ct);
            if (food is null) continue;

            // Slår varen op for at få dens rigtige pakkestørrelse. Lykkes det
            // ikke, springes råvaren over frem for at få en mapning i den
            // forkerte enhed — se MapToKnownProductAsync.
            await autoMapper.MapToKnownProductAsync(food, linje.ProductId!, linje.ProductUrl, ct);
        }
    }

    /// <summary>Varenumrene slået op på LINJENS PLADS i kilden — ikke på dens
    /// plads i en filtreret liste.
    ///
    /// Da opskriften blev gemt, fik hver ingrediens SortOrder = sit indeks i
    /// præcis denne liste. Derfor kan de to sider mødes igen bagefter, selvom
    /// nogle linjer undervejs faldt fra: en linje uden varenummer efterlader et
    /// hul, og et hul er noget andet end at alle de følgende rykker én op.
    ///
    /// Fejlen den erstatter: teksterne og varenumrene lå i to lister der blev
    /// filtreret hver for sig og lynet sammen på position. Manglede bare én
    /// linje sit varenummer, fik resten af opskriften hinandens varer — med
    /// priser der så helt rigtige ud.</summary>
    internal static Dictionary<int, NemligRecipeLine> VarenumreEfterLinjenummer(
        IReadOnlyList<NemligRecipeLine> linjer) =>
        linjer
            .Select((l, indeks) => (indeks, l))
            .Where(x => !string.IsNullOrWhiteSpace(x.l.ProductId))
            .ToDictionary(x => x.indeks, x => x.l);

    /// <summary>«25 min», «1 t 15 min». Nemlig skriver tid som fritekst.</summary>
    internal static int? MinutterFra(string? tekst)
    {
        if (string.IsNullOrWhiteSpace(tekst)) return null;

        var s = tekst.ToLowerInvariant();
        var minutter = 0;
        var fundet = false;

        for (var i = 0; i < s.Length;)
        {
            if (!char.IsDigit(s[i])) { i++; continue; }

            var start = i;
            while (i < s.Length && char.IsDigit(s[i])) i++;
            var værdi = int.Parse(s[start..i]);

            // Der står et mellemrum mellem tallet og enheden: «1 t 15 min».
            // Uden dette spring blev mellemrummet læst som enheden, og en time
            // blev til ét minut.
            while (i < s.Length && s[i] == ' ') i++;

            var erTimer = i < s.Length && s[i] is 't' or 'h';
            minutter += erTimer ? værdi * 60 : værdi;
            fundet = true;
        }

        return fundet && minutter > 0 ? minutter : null;
    }

    private async Task<Recipe> SaveAsync(ScrapedRecipe scraped, CancellationToken ct)
    {
        var householdId = await db.Households.OrderBy(h => h.Id).Select(h => h.Id).FirstAsync(ct);
        var units = await db.Units.ToListAsync(ct);
        var stkId = units.First(u => u.Abbreviation == "stk").Id;

        var recipe = new Recipe
        {
            HouseholdId = householdId,
            Title = scraped.Title,
            Servings = scraped.Servings ?? 4,
            TotalTimeMinutes = scraped.TotalMinutes,
            Instructions = scraped.Instructions,
            ImageUrl = scraped.ImageUrl,
            SourceUrl = scraped.SourceUrl,
            SourceName = scraped.SourceName,
            Attribution = scraped.Attribution,
            IsOwn = false,
            CachedAt = DateTime.UtcNow,
            IsChildFriendly = LooksChildFriendly(scraped.Categories),
            IsVegetarian = LooksVegetarian(scraped.Categories),
        };

        db.Recipes.Add(recipe);
        await db.SaveChangesAsync(ct);

        var order = 0;
        foreach (var raw in scraped.Ingredients)
        {
            var parsed = IngredientParser.Parse(raw);
            var unit = parsed.UnitAbbrev is null
                ? null
                : units.FirstOrDefault(u => u.Abbreviation == parsed.UnitAbbrev);

            // Uden mængde eller navn er linjen ikke beregnelig. Den gemmes
            // alligevel med sin råtekst — den skal ikke forsvinde.
            Food? food = null;
            if (parsed.HasQuantity && parsed.FoodName.Length > 0)
                food = await foods.ResolveOrCreateAsync(parsed.FoodName, unit?.Id);

            db.RecipeIngredients.Add(new RecipeIngredient
            {
                RecipeId = recipe.Id,
                RawText = raw,
                Quantity = food is null ? null : parsed.Quantity,
                UnitId = food is null ? null : unit?.Id ?? stkId,
                FoodId = food?.Id,
                Note = parsed.Note,
                SortOrder = order++,
            });
        }

        await db.SaveChangesAsync(ct);
        return recipe;
    }

    // Kategorierne er sidernes egne ord. Heuristikken er grov med vilje — den
    // sætter et flag man kan rette i hånden, ikke en sandhed.
    private static bool LooksChildFriendly(IReadOnlyList<string> categories) =>
        categories.Any(c => c.Contains("børn", StringComparison.OrdinalIgnoreCase)
                         || c.Contains("familie", StringComparison.OrdinalIgnoreCase)
                         || c.Contains("hverdag", StringComparison.OrdinalIgnoreCase));

    private static bool LooksVegetarian(IReadOnlyList<string> categories) =>
        categories.Any(c => c.Contains("vegetar", StringComparison.OrdinalIgnoreCase)
                         || c.Contains("vegan", StringComparison.OrdinalIgnoreCase));
}
