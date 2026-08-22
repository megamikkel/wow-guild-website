using Madplan.Recipes;

namespace Madplan.Tests;

public class RecipeExtractorTests
{
    private static string Html(string name) =>
        File.ReadAllText(Path.Combine("Fixtures", "html", name));

    [Fact]
    public async Task JsonLd_i_graph_laeses()
    {
        var r = await new RecipeExtractor().ExtractAsync(
            Html("jsonld.html"), "https://madensverden.dk/kylling-i-fad/");

        Assert.NotNull(r);
        Assert.Equal("Kylling i fad med kartofler", r!.Title);
        Assert.Equal(4, r.Ingredients.Count);
        Assert.Equal("1 kg kyllingelår", r.Ingredients[0]);
        Assert.Equal(4, r.Servings);
        Assert.Equal(75, r.TotalMinutes);            // PT1H15M
        Assert.Equal("madensverden.dk", r.SourceName);
        Assert.Equal("Anne Au Chocolat, madensverden.dk", r.Attribution);
        Assert.Contains("Tænd ovnen", r.Instructions);
        Assert.Contains("Skær kartoflerne", r.Instructions);
        Assert.True(r.LooksUsable);
    }

    [Fact]
    public async Task Microdata_laeses_selv_naar_siden_har_JsonLd_uden_Recipe()
    {
        // Det er valdemarsros form præcist: der ER en ld+json-blok, men den
        // indeholder Article, ikke Recipe. En JSON-LD-only parser ville fejle
        // tavst netop her. Se docs/opskriftskilder.md §0.
        var r = await new RecipeExtractor().ExtractAsync(
            Html("microdata.html"), "https://www.valdemarsro.dk/spaghetti-koedsovs/");

        Assert.NotNull(r);
        Assert.Equal("Spaghetti med kødsovs", r!.Title);
        Assert.Equal(4, r.Ingredients.Count);
        Assert.Contains("500 g hakket oksekød", r.Ingredients);
        Assert.Equal(4, r.Servings);
        Assert.Equal(45, r.TotalMinutes);
        Assert.Equal("valdemarsro.dk", r.SourceName);   // www. trimmes
        Assert.Contains("Familiefavoritter", r.Categories);
        Assert.Contains("Brun kødet", r.Instructions);
        Assert.Contains("Tilsæt tomater", r.Instructions);
    }

    [Fact]
    public async Task Side_uden_opskrift_giver_null_frem_for_noget_forkert()
    {
        var r = await new RecipeExtractor().ExtractAsync(
            "<html><body><h1>En blogtekst</h1><p>Ingen opskrift her.</p></body></html>",
            "https://example.dk/blog");

        Assert.Null(r);
    }

    [Fact]
    public async Task Ugyldig_jsonld_blok_vaelter_ikke_parsingen()
    {
        var html = "<html><head><script type='application/ld+json'>{ ugyldigt json </script>"
                 + "<script type='application/ld+json'>"
                 + """{"@type":"Recipe","name":"Virker","recipeIngredient":["1 stk noget"]}"""
                 + "</script></head><body></body></html>";

        var r = await new RecipeExtractor().ExtractAsync(html, "https://example.dk/x");

        Assert.NotNull(r);
        Assert.Equal("Virker", r!.Title);
    }

    [Theory]
    [InlineData("PT45M", 45)]
    [InlineData("PT1H", 60)]
    [InlineData("PT1H30M", 90)]
    [InlineData("PT2H15M", 135)]
    [InlineData("45", 45)]          // blot tal = minutter, ikke dage
    [InlineData("1:30", 90)]        // klokkeslætsform
    [InlineData(null, null)]
    [InlineData("", null)]
    [InlineData("noget vrøvl", null)]
    public void Iso_varigheder_parses(string? input, int? expected)
        => Assert.Equal(expected, RecipeExtractor.ParseIsoDuration(input));

    [Theory]
    [InlineData("4", 4)]
    [InlineData("4 personer", 4)]
    [InlineData("ca. 6 personer", 6)]
    [InlineData("4-6 personer", 4)]
    [InlineData("personer", null)]
    [InlineData(null, null)]
    public void Portionsantal_parses(string? input, int? expected)
        => Assert.Equal(expected, RecipeExtractor.ParseServingsText(input));
}
