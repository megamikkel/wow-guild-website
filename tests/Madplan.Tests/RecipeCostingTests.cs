using Madplan.Core.Model;
using Madplan.Core.Planning;

namespace Madplan.Tests;

/// <summary>Budgetsiden rangerer retterne efter pris pr. portion. Disse tests
/// holder fast i at rangeringen er ærlig: prisen regnes på kiloprisen og ikke
/// på hele pakker, en ukendt pris er ikke nul, og summen af enkeltpriser er
/// ikke menuens pris.</summary>
public class RecipeCostingTests
{
    private static readonly Unit G = new() { Id = 1, Abbreviation = "g", Type = UnitType.Mass, ToBaseFactor = 1 };
    private static readonly Unit[] Units = [G];

    private static Food F(int id, string navn) => new() { Id = id, CanonicalName = navn };

    private static Recipe R(int id, string titel, int portioner, params (Food Food, double Qty)[] ings) => new()
    {
        Id = id, Title = titel, Servings = portioner,
        Ingredients = [.. ings.Select(i => new RecipeIngredient
        {
            Food = i.Food, FoodId = i.Food.Id, Quantity = i.Qty, Unit = G, UnitId = G.Id,
        })],
    };

    private static ProductMapping M(int id, Food food, string produktId, double pakke) => new()
    {
        Id = id, FoodId = food.Id, NemligProductId = produktId, ProductName = $"Vare {produktId}",
        PackageSize = pakke, PackageUnitId = G.Id, PackageUnit = G,
    };

    private static ShoppingListBuilder.Input Ctx(
        IEnumerable<ProductMapping> mappings, Dictionary<string, decimal?> priser)
        => new([], [.. mappings], [], priser, new Dictionary<string, bool>());

    private static RecipeCosting Costing() => new(new ShoppingListBuilder(Units, []));

    [Fact]
    public void Billigste_pr_portion_ligger_oeverst()
    {
        var billig = F(1, "gulerod");
        var dyr = F(2, "oksemørbrad");

        // Begge retter er til 4 portioner og bruger 400 g af hver sin råvare.
        var a = R(1, "Dyr ret", 4, (dyr, 400));
        var b = R(2, "Billig ret", 4, (billig, 400));

        var ctx = Ctx([M(1, billig, "p1", 400), M(2, dyr, "p2", 400)],
                      new() { ["p1"] = 10m, ["p2"] = 300m });

        var rangeret = Costing().RankByPricePerServing([a, b], servings: 4, ctx);

        Assert.Equal("Billig ret", rangeret[0].Recipe.Title);
        Assert.Equal(2.5m, rangeret[0].PerServing);      // 10 kr / 4
        Assert.Equal(75m, rangeret[1].PerServing);       // 300 kr / 4
    }

    [Fact]
    public void En_ukendt_pris_er_ikke_nul_kroner()
    {
        // Den klassiske fælde: retten uden kobling ser gratis ud og lægger sig
        // øverst som ugens tilbud.
        var kendt = F(1, "gulerod");
        var ukendt = F(2, "trøfler");

        var prissat = R(1, "Gulerodssuppe", 4, (kendt, 400));
        var uden = R(2, "Trøffelpasta", 4, (ukendt, 400));

        var ctx = Ctx([M(1, kendt, "p1", 400)], new() { ["p1"] = 40m });

        var rangeret = Costing().RankByPricePerServing([uden, prissat], servings: 4, ctx);

        Assert.Equal("Gulerodssuppe", rangeret[0].Recipe.Title);
        Assert.True(rangeret[0].FullyPriced);

        Assert.Equal("Trøffelpasta", rangeret[1].Recipe.Title);
        Assert.False(rangeret[1].FullyPriced);
        Assert.Null(rangeret[1].PerServing);             // ikke 0 kr
        Assert.Equal(1, rangeret[1].UnknownIngredients);
    }

    [Fact]
    public void Retter_uden_priser_skjules_ikke_men_ligger_bagest()
    {
        var kendt = F(1, "gulerod");
        var a = R(1, "Uden priser", 4, (F(2, "x"), 100), (F(3, "y"), 100));
        var b = R(2, "Halvt kendt", 4, (kendt, 100), (F(4, "z"), 100));
        var c = R(3, "Prissat", 4, (kendt, 100));

        var ctx = Ctx([M(1, kendt, "p1", 400)], new() { ["p1"] = 40m });

        var rangeret = Costing().RankByPricePerServing([a, b, c], servings: 4, ctx);

        Assert.Equal(3, rangeret.Count);                          // ingen forsvinder
        Assert.Equal("Prissat", rangeret[0].Recipe.Title);
        Assert.Equal("Halvt kendt", rangeret[1].Recipe.Title);    // færrest ukendte først
        Assert.Equal("Uden priser", rangeret[2].Recipe.Title);
    }

    [Fact]
    public void Prisen_pr_portion_afhaenger_ikke_af_hvor_mange_man_daekker()
    {
        // Skaleres retten op, skal kr./portion holde sig — ellers sammenligner
        // listen æbler og pærer når husstanden ændrer portionstal. Det holder
        // kun fordi prisen regnes på kiloprisen; med hele pakker ville de
        // samme frikadeller koste 133 kr./portion til tre og 67 til seks,
        // alene fordi posen er den samme.
        var koed = F(1, "hakket oksekød");
        var ret = R(1, "Frikadeller", 4, (koed, 400));

        var ctx = Ctx([M(1, koed, "p1", 4000)], new() { ["p1"] = 400m });   // 0,10 kr/g

        var tre = Costing().For(ret, servings: 3, ctx);
        var seks = Costing().For(ret, servings: 6, ctx);

        Assert.NotNull(tre.PerServing);
        Assert.NotNull(seks.PerServing);
        Assert.Equal(tre.PerServing!.Value, seks.PerServing!.Value, precision: 2);
        Assert.Equal(10m, tre.PerServing!.Value, precision: 2);   // 300 g a 0,10 kr / 3
    }

    [Fact]
    public void En_teskefuld_af_en_dyr_krukke_goer_ikke_retten_dyr()
    {
        // Retten bruger 2 g karry fra en krukke der koster 40 kr. for 40 g.
        // Regnede vi i hele pakker, ville den koste 40 kr. og lægge sig
        // nederst på listen — selvom resten af krukken bruges næste uge.
        var ris = F(1, "ris");
        var karry = F(2, "karry");
        var ret = R(1, "Karryris", 4, (ris, 400), (karry, 2));

        var ctx = Ctx(
            [M(1, ris, "p1", 1000), M(2, karry, "p2", 40)],
            new() { ["p1"] = 20m, ["p2"] = 40m });

        var pris = Costing().For(ret, servings: 4, ctx);

        // 400 g ris a 0,02 = 8 kr. + 2 g karry a 1,00 = 2 kr.
        Assert.Equal(10m, pris.Total);
        Assert.Equal(2.5m, pris.PerServing);
    }

    [Fact]
    public void Enkeltpriser_er_en_indikation_ikke_menuens_total()
    {
        // Enkeltpriserne er råvarepriser og køber ikke pakker. To retter bruger
        // hver 200 g af en pose på 500 g til 50 kr; hver ret «koster» 20 kr,
        // men i kurven ligger der en hel pose til 50. Tallene kan altså ikke
        // lægges sammen til en menupris — Budget-siden skal regne totalen
        // gennem indkøbslisten, og det er dét denne test holder fast i.
        var koed = F(1, "hakket oksekød");
        var a = R(1, "Ret A", 4, (koed, 200));
        var b = R(2, "Ret B", 4, (koed, 200));

        var builder = new ShoppingListBuilder(Units, []);
        var ctx = Ctx([M(1, koed, "p1", 500)], new() { ["p1"] = 50m });
        var costing = new RecipeCosting(builder);

        var sumAfEnkeltpriser = costing.For(a, 4, ctx).Total + costing.For(b, 4, ctx).Total;
        Assert.Equal(40m, sumAfEnkeltpriser);

        var samlet = builder.Build(new MealPlan(), ctx with
        {
            Entries =
            [
                new MealPlanEntry { Recipe = a, RecipeId = a.Id, Servings = 4, Date = new DateOnly(2026, 8, 24) },
                new MealPlanEntry { Recipe = b, RecipeId = b.Id, Servings = 4, Date = new DateOnly(2026, 8, 25) },
            ],
        });

        Assert.Equal(50m, samlet.KnownTotal);
    }
}
