using System.Text.Json.Nodes;
using Madplan.Nemlig;
using Madplan.Nemlig.Contracts;
using Madplan.Web.Services;

namespace Madplan.Tests;

/// <summary>Nemligs egne opskrifter er projektets mest værdifulde hypotese:
/// knytter nemlig selv ingredienser til varenumre, er det sværeste problem løst
/// af dem. Men koblingen mellem linje og varenummer skal holde, ellers får vi
/// priser der ser rigtige ud og er forkerte. Det er værre end ingen priser.</summary>
public class NemligRecipeLineTests
{
    private static JsonObject Parse(string json) => (JsonObject)JsonNode.Parse(json)!;

    [Fact]
    public void Linjer_uden_varenummer_forskyder_ikke_de_oevrige()
    {
        // Den oprindelige fejl: tekst og varenumre lå i to lister der blev
        // filtreret hver for sig. «salt» har intet varenummer, så listerne
        // forskød sig, og hakket oksekød arvede pastaens vare.
        var node = Parse("""
        {
          "Name": "Pasta med kødsovs",
          "Ingredients": [
            { "Text": "500 g hakket oksekød", "ProductId": "111" },
            { "Text": "salt" },
            { "Text": "400 g pasta", "ProductId": "222" }
          ]
        }
        """);

        var linjer = NemligClient.LæsIngredienser(node);

        Assert.Equal(3, linjer.Count);
        Assert.Equal("500 g hakket oksekød", linjer[0].Text);
        Assert.Equal("111", linjer[0].ProductId);

        Assert.Equal("salt", linjer[1].Text);
        Assert.Null(linjer[1].ProductId);          // hullet bevares

        Assert.Equal("400 g pasta", linjer[2].Text);
        Assert.Equal("222", linjer[2].ProductId);  // ikke rykket op på oksekødets plads
    }

    [Fact]
    public void Raa_tekstlinjer_uden_varenummer_taeller_stadig_med()
    {
        // Nogle opskrifter har ingredienserne som rene strenge. De har aldrig
        // et varenummer, men de skal beholde deres plads i rækkefølgen.
        var node = Parse("""
        {
          "Name": "Æggekage",
          "IngredientLines": ["6 æg", "1 dl mælk", "salt og peber"]
        }
        """);

        var linjer = NemligClient.LæsIngredienser(node);

        Assert.Equal(3, linjer.Count);
        Assert.All(linjer, l => Assert.Null(l.ProductId));
        Assert.Equal("1 dl mælk", linjer[1].Text);
    }

    [Fact]
    public void Blandede_streng_og_objektlinjer_holder_raekkefoelgen()
    {
        var node = Parse("""
        {
          "Name": "Blandet",
          "Ingredients": [
            "1 knivspids salt",
            { "Text": "2 løg", "ProductId": "333" },
            { "Description": "1 dl fløde", "VkNumber": "444" }
          ]
        }
        """);

        var linjer = NemligClient.LæsIngredienser(node);

        Assert.Equal(3, linjer.Count);
        Assert.Null(linjer[0].ProductId);
        Assert.Equal("333", linjer[1].ProductId);
        Assert.Equal("1 dl fløde", linjer[2].Text);
        Assert.Equal("444", linjer[2].ProductId);   // VkNumber duer også
    }

    [Fact]
    public void Tomme_varenumre_regnes_som_ingen_vare()
    {
        var node = Parse("""
        {
          "Name": "Tom",
          "Ingredients": [
            { "Text": "1 løg", "ProductId": "" },
            { "Text": "2 gulerødder", "ProductId": "  " }
          ]
        }
        """);

        var linjer = NemligClient.LæsIngredienser(node);

        Assert.All(linjer, l => Assert.Null(l.ProductId));
    }

    [Fact]
    public void HasMappedProducts_er_falsk_naar_ingen_linje_har_en_vare()
    {
        var uden = new NemligRecipe("1", "Ret", null, 4, null,
            [new NemligRecipeLine("salt", null), new NemligRecipeLine("peber", null)], null);
        Assert.False(uden.HasMappedProducts);

        var med = new NemligRecipe("1", "Ret", null, 4, null,
            [new NemligRecipeLine("salt", null), new NemligRecipeLine("løg", "333")], null);
        Assert.True(med.HasMappedProducts);
    }

    [Fact]
    public void Ingredients_giver_teksterne_i_kildens_raekkefoelge()
    {
        // Importen gemmer opskriften ud fra denne liste og sætter SortOrder til
        // indekset. Koblingen til varenumre hviler på at de to indekser er ét
        // og samme — så rækkefølgen er ikke kosmetik.
        var r = new NemligRecipe("1", "Ret", null, 4, null,
        [
            new NemligRecipeLine("500 g oksekød", "111"),
            new NemligRecipeLine("salt", null),
            new NemligRecipeLine("400 g pasta", "222"),
        ], null);

        Assert.Equal(["500 g oksekød", "salt", "400 g pasta"], r.Ingredients);
    }

    [Fact]
    public void Varenumre_slaas_op_paa_linjens_plads_ikke_paa_sin_egen()
    {
        // Den fejl der gjorde det hele farligt. «2 løg» er en rigtig råvare
        // uden varenummer; pastaen har et. Med en sammenlynings-liste blev
        // løgene koblet til pastaens vare — første varenummer, første råvare.
        var linjer = new List<NemligRecipeLine>
        {
            new("2 løg", null),
            new("400 g pasta", "222"),
        };

        var efterLinje = RecipeImportService.VarenumreEfterLinjenummer(linjer);

        Assert.False(efterLinje.ContainsKey(0));      // løgene får INGEN vare
        Assert.Equal("222", efterLinje[1].ProductId);           // pastaen får sin egen
    }

    [Fact]
    public void Flere_huller_i_traek_forskyder_heller_ikke()
    {
        var linjer = new List<NemligRecipeLine>
        {
            new("salt", null),
            new("peber", null),
            new("500 g hakket oksekød", "111"),
            new("1 dl fløde", null),
            new("400 g pasta", "222"),
        };

        var efterLinje = RecipeImportService.VarenumreEfterLinjenummer(linjer);

        Assert.Equal(2, efterLinje.Count);
        Assert.Equal("111", efterLinje[2].ProductId);
        Assert.Equal("222", efterLinje[4].ProductId);
        foreach (var tomt in new[] { 0, 1, 3 })
            Assert.False(efterLinje.ContainsKey(tomt));
    }

    [Fact]
    public void Varens_adresse_foelger_med_linjen()
    {
        // Uden adressen må varen slås op ved at søge på sit eget varenummer,
        // og det finder ikke pålideligt netop den vare. Bærer nemlig adressen,
        // skal den hele vejen igennem til opslaget.
        var node = Parse("""
        {
          "Name": "Ret",
          "Ingredients": [
            { "Text": "2 løg", "ProductId": "3020117", "Url": "loeg-3020117" }
          ]
        }
        """);

        var linjer = NemligClient.LæsIngredienser(node);

        Assert.Equal("3020117", linjer[0].ProductId);
        Assert.Equal("loeg-3020117", linjer[0].ProductUrl);

        var efterLinje = RecipeImportService.VarenumreEfterLinjenummer(linjer);
        Assert.Equal("loeg-3020117", efterLinje[0].ProductUrl);
    }

    [Fact]
    public void Ingen_varenumre_giver_en_tom_opslagstabel_ikke_et_gaet()
    {
        var linjer = new List<NemligRecipeLine> { new("salt", null), new("peber", "") };
        Assert.Empty(RecipeImportService.VarenumreEfterLinjenummer(linjer));
    }
}
