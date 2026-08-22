using Madplan.Core.Model;
using Madplan.Nemlig.Contracts;
using Madplan.Web.Services;

namespace Madplan.Tests;

file sealed class FakeCatalog(params NemligProduct[] products) : INemligCatalog
{
    public string? LastQuery { get; private set; }

    public Task<IReadOnlyList<NemligProduct>> SearchAsync(string query, int take = 10, CancellationToken ct = default)
    {
        LastQuery = query;
        return Task.FromResult<IReadOnlyList<NemligProduct>>(products);
    }

    public Task<NemligProductDetail?> GetProductAsync(string id, string? productUrl = null,
                                                      bool forceRefresh = false, CancellationToken ct = default)
        => Task.FromResult<NemligProductDetail?>(null);
}

public class ProductSuggesterTests
{
    private static NemligProduct P(string id, string name, string? brand = null, decimal price = 20m,
                                   bool inStock = true, string? category = null, decimal? unitPrice = null)
        => new(id, name, $"{name.ToLowerInvariant().Replace(' ', '-')}-{id}", brand, category,
               null, null, price, unitPrice, "kr/kg", inStock, true, false, null);

    [Fact]
    public async Task Koebt_foer_slaar_alt_andet()
    {
        // Adfærd er en bedre kilde end strenglighed. Selv et dårligere navnematch
        // vinder, hvis familien faktisk køber den vare.
        var catalog = new FakeCatalog(
            P("1", "Hakket oksekød 8-12%"),
            P("2", "Änglamark Økologisk Kalve- og Flæskefars"));

        var suggester = new ProductSuggester(catalog);
        var food = new Food { CanonicalName = "hakket oksekød" };

        var result = await suggester.SuggestAsync(food, previouslyOrderedIds: ["2"]);

        Assert.Equal("2", result[0].Product.Id);
        Assert.Equal("Købt før", result[0].Reason);
    }

    [Fact]
    public async Task Ordstilling_er_ligegyldig_for_matchet()
    {
        // Token-set, ikke Levenshtein: "oksekød, hakket" skal matche "hakket oksekød".
        var catalog = new FakeCatalog(
            P("1", "Kyllingebryst"),
            P("2", "Oksekød hakket"));

        var result = await new ProductSuggester(catalog)
            .SuggestAsync(new Food { CanonicalName = "hakket oksekød" }, []);

        Assert.Equal("2", result[0].Product.Id);
    }

    [Fact]
    public async Task Udsolgte_nedprioriteres_men_skjules_ikke()
    {
        var catalog = new FakeCatalog(
            P("1", "Hakket oksekød", inStock: false),
            P("2", "Hakket oksekød", inStock: true));

        var result = await new ProductSuggester(catalog)
            .SuggestAsync(new Food { CanonicalName = "hakket oksekød" }, []);

        Assert.Equal("2", result[0].Product.Id);
        Assert.Contains(result, s => s.Product.Id == "1"); // stadig synlig
    }

    [Fact]
    public async Task Korte_navne_foretraekkes_frem_for_lange_brandede()
    {
        var catalog = new FakeCatalog(
            P("1", "Änglamark Økologisk Hakket Oksekød 8-12% Dansk Kvalitet 400g", brand: "Änglamark"),
            P("2", "Hakket oksekød"));

        var result = await new ProductSuggester(catalog)
            .SuggestAsync(new Food { CanonicalName = "hakket oksekød" }, []);

        Assert.Equal("2", result[0].Product.Id);
    }

    [Fact]
    public async Task Soegestrengen_renses_for_tilberedningsord()
    {
        var catalog = new FakeCatalog(P("1", "Cherrytomater"));

        await new ProductSuggester(catalog)
            .SuggestAsync(new Food { CanonicalName = "friske cherrytomater" }, []);

        // "friske" er et støjord og hører ikke med i en søgning hos nemlig.
        Assert.Equal("cherrytomater", catalog.LastQuery);
    }

    [Fact]
    public async Task Der_vises_hoejst_fem_forslag()
    {
        var mange = Enumerable.Range(1, 12).Select(i => P(i.ToString(), $"Oksekød variant {i}")).ToArray();

        var result = await new ProductSuggester(new FakeCatalog(mange))
            .SuggestAsync(new Food { CanonicalName = "oksekød" }, []);

        Assert.Equal(5, result.Count);
    }

    [Fact]
    public async Task Ingen_traef_giver_tom_liste_ikke_et_gaet()
    {
        var result = await new ProductSuggester(new FakeCatalog())
            .SuggestAsync(new Food { CanonicalName = "noget mærkeligt" }, []);

        Assert.Empty(result);
    }
}
