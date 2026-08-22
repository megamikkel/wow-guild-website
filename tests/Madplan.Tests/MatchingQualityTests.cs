using Madplan.Core.Model;
using Madplan.Nemlig.Contracts;
using Madplan.Web.Services;

namespace Madplan.Tests;

file sealed class Catalog(params NemligProduct[] p) : INemligCatalog
{
    public Task<IReadOnlyList<NemligProduct>> SearchAsync(string q, int take = 10, CancellationToken ct = default)
        => Task.FromResult<IReadOnlyList<NemligProduct>>(p);
    public Task<NemligProductDetail?> GetProductAsync(string id, string? url = null, bool force = false, CancellationToken ct = default)
        => Task.FromResult<NemligProductDetail?>(null);
}

/// <summary>Kvaliteten af råvare→vare-matchet. Fejlene her er stille: en forkert
/// vare giver et budget der ser rigtigt ud og ikke er det. Alle tilfælde nedenfor
/// er observeret i en rigtig kørsel af appen.</summary>
public class MatchingQualityTests
{
    private static NemligProduct P(string id, string navn, decimal pris, decimal enhedspris,
                                   string? brand = null, string label = "kr/stk")
        => new(id, navn, $"{id}-slug", brand, null, null, null, pris, enhedspris, label, true, true, false, null);

    /// <summary>Kører hele kæden: søgning → rangering → valgregel. Det er valget
    /// der ender i budgettet, ikke rangeringen.</summary>
    private static async Task<string> Vaelg(Food food, params NemligProduct[] kandidater)
    {
        var forslag = await new ProductSuggester(new Catalog(kandidater)).SuggestAsync(food, []);
        return AutoMapper.Choose(food, forslag).Product.Name;
    }

    [Fact]
    public async Task Loeg_bliver_ikke_til_hvidloeg()
    {
        var navn = await Vaelg(new Food { CanonicalName = "løg" },
            P("1", "Hvidløg", 8.95m, 8.95m),
            P("2", "Løg", 4.50m, 4.50m));

        Assert.Equal("Løg", navn);
    }

    [Fact]
    public async Task Flaaede_tomater_bliver_ikke_til_cherrytomater()
    {
        var navn = await Vaelg(new Food { CanonicalName = "flåede tomater" },
            P("1", "Cherrytomater", 16.95m, 67.80m),
            P("2", "Flåede tomater", 9.75m, 24.38m, "Mutti"));

        Assert.Equal("Flåede tomater", navn);
    }

    /// <summary>Dansk sætter ord sammen: hverken «letmælk» eller «kokosmælk»
    /// indeholder «mælk» som selvstændigt ord, så navnet kan ikke afgøre sagen.
    /// Så skal enhedsprisen — 12,50 kr/l mod 28,75 kr/l.</summary>
    [Fact]
    public async Task Maelk_bliver_ikke_til_kokosmaelk()
    {
        var navn = await Vaelg(new Food { CanonicalName = "mælk" },
            P("1", "Kokosmælk", 11.50m, 28.75m, "Aroy-D", "kr/l"),
            P("2", "Letmælk 1,5%", 12.50m, 12.50m, "Arla", "kr/l"));

        Assert.Equal("Letmælk 1,5%", navn);
    }

    [Fact]
    public async Task Praecist_navnematch_slaar_et_kortere_men_forkert()
    {
        var navn = await Vaelg(new Food { CanonicalName = "hakket oksekød" },
            P("1", "Oksekød i tern", 60m, 120m),
            P("2", "Hakket oksekød 8-12%", 41.75m, 83.50m));

        Assert.Equal("Hakket oksekød 8-12%", navn);
    }
}


/// <summary>Selve valgreglen, uden søgning og database.</summary>
public class ChooseRuleTests
{
    private static ProductSuggester.Suggestion S(string navn, decimal enhedspris,
                                                 double score, bool paaLager = true)
        => new(new NemligProduct("1", navn, "slug", null, null, null, null,
                                 enhedspris, enhedspris, "kr/kg", paaLager, true, false, null),
               score, null);

    [Fact]
    public void Hele_ord_slaar_billig_men_forkert()
    {
        // «Hvidløg» er billigere pr. enhed her, men det er ikke løg.
        var valg = AutoMapper.Choose(new Food { CanonicalName = "løg" },
            [S("Løg", 10m, 50), S("Hvidløg", 2m, 5)]);

        Assert.Equal("Løg", valg.Product.Name);
    }

    [Fact]
    public void Blandt_flere_hele_ords_match_vinder_den_billigste()
    {
        var valg = AutoMapper.Choose(new Food { CanonicalName = "hakket oksekød" },
            [S("Hakket oksekød økologisk", 135m, 60), S("Hakket oksekød", 83m, 55)]);

        Assert.Equal("Hakket oksekød", valg.Product.Name);
    }

    [Fact]
    public void Uden_hele_ords_match_afgoer_enhedsprisen()
    {
        var valg = AutoMapper.Choose(new Food { CanonicalName = "mælk" },
            [S("Kokosmælk", 28.75m, 20), S("Letmælk 1,5%", 12.50m, 18)]);

        Assert.Equal("Letmælk 1,5%", valg.Product.Name);
    }

    [Fact]
    public void Varer_paa_lager_foretraekkes()
    {
        var valg = AutoMapper.Choose(new Food { CanonicalName = "ris" },
            [S("Ris", 10m, 50, paaLager: false), S("Ris basmati", 20m, 45)]);

        Assert.Equal("Ris basmati", valg.Product.Name);
    }

    [Fact]
    public void Er_alt_udsolgt_vaelges_der_stadig_noget()
    {
        // En udsolgt vare er bedre end ingen mapning: prisen er stadig rigtig,
        // og varen er der igen næste uge.
        var valg = AutoMapper.Choose(new Food { CanonicalName = "ris" },
            [S("Ris", 10m, 50, paaLager: false)]);

        Assert.Equal("Ris", valg.Product.Name);
    }
}
