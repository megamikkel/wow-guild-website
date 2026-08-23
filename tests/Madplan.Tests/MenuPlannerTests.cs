using Madplan.Core.Model;
using Madplan.Core.Planning;

namespace Madplan.Tests;

public class MenuPlannerTests
{
    private static readonly Unit G = new() { Id = 1, Abbreviation = "g", Type = UnitType.Mass, ToBaseFactor = 1 };
    private static readonly Unit[] Units = [G];

    private static Food F(int id, string navn) => new() { Id = id, CanonicalName = navn };

    private static Recipe R(int id, string titel, params (Food Food, double Qty)[] ings) => new()
    {
        Id = id, Title = titel, Servings = 4,
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

    [Fact]
    public void Menuen_prissaettes_med_delte_raavarer_ikke_som_en_sum()
    {
        // To retter bruger hver 200 g af samme råvare. Pakken er på 500 g, så
        // ÉN pakke dækker begge. En naiv sum ville sige to.
        var koed = F(1, "hakket oksekød");
        var a = R(1, "Ret A", (koed, 200));
        var b = R(2, "Ret B", (koed, 200));

        var builder = new ShoppingListBuilder(Units, []);
        var ctx = Ctx([M(1, koed, "p1", 500)], new() { ["p1"] = 50m });
        var planner = new MenuPlanner(builder);

        var menu = planner.Plan(
            new MenuPlanner.Request(Budget: 60m, Meals: 2, Servings: 4, [a, b], []),
            ctx, new Random(1));

        Assert.Equal(2, menu.Recipes.Count);
        Assert.Equal(50m, menu.Cost);      // én pakke, ikke to
        Assert.True(menu.WithinBudget);
    }

    [Fact]
    public void Retter_der_genbruger_raavarer_foretraekkes_naar_budgettet_er_stramt()
    {
        var koed = F(1, "oksekød");
        var luksus = F(2, "hummer");

        var a = R(1, "Ret A", (koed, 200));
        var b = R(2, "Ret B", (koed, 200));    // genbruger — næsten gratis oveni
        var c = R(3, "Ret C", (luksus, 200));  // ny dyr råvare

        var builder = new ShoppingListBuilder(Units, []);
        var ctx = Ctx([M(1, koed, "p1", 500), M(2, luksus, "p2", 500)],
                      new() { ["p1"] = 50m, ["p2"] = 400m });

        var menu = new MenuPlanner(builder).Plan(
            new MenuPlanner.Request(Budget: 100m, Meals: 2, Servings: 4, [a, b, c], []),
            ctx, new Random(7));

        Assert.Equal(2, menu.Recipes.Count);
        Assert.DoesNotContain(menu.Recipes, r => r.Id == 3);   // hummeren er valgt fra
        Assert.True(menu.WithinBudget);
    }

    [Fact]
    public void Er_budgettet_for_lille_leveres_faerre_retter_frem_for_en_menu_man_ikke_har_raad_til()
    {
        var a = R(1, "Dyr ret A", (F(1, "a"), 500));
        var b = R(2, "Dyr ret B", (F(2, "b"), 500));
        var c = R(3, "Dyr ret C", (F(3, "c"), 500));

        var builder = new ShoppingListBuilder(Units, []);
        var ctx = Ctx(
            [M(1, F(1, "a"), "p1", 500), M(2, F(2, "b"), "p2", 500), M(3, F(3, "c"), "p3", 500)],
            new() { ["p1"] = 100m, ["p2"] = 100m, ["p3"] = 100m });

        var menu = new MenuPlanner(builder).Plan(
            new MenuPlanner.Request(Budget: 150m, Meals: 3, Servings: 4, [a, b, c], []),
            ctx, new Random(3));

        Assert.True(menu.Recipes.Count < 3);
        Assert.True(menu.Cost <= 150m);
    }

    [Fact]
    public void Filtre_respekteres()
    {
        var mad = F(1, "mad");
        var voksen = R(1, "Stærk karry", (mad, 100));
        var barn = new Recipe
        {
            Id = 2, Title = "Frikadeller", Servings = 4, IsChildFriendly = true,
            Ingredients = [new RecipeIngredient { Food = mad, FoodId = 1, Quantity = 100, Unit = G, UnitId = 1 }],
        };

        var ctx = Ctx([M(1, mad, "p1", 500)], new() { ["p1"] = 20m });
        var menu = new MenuPlanner(new ShoppingListBuilder(Units, [])).Plan(
            new MenuPlanner.Request(300m, 2, 4, [voksen, barn], [], ChildFriendlyOnly: true),
            ctx, new Random(1));

        Assert.All(menu.Recipes, r => Assert.True(r.IsChildFriendly));
    }

    [Fact]
    public void Nylige_retter_nedprioriteres_men_udelukkes_ikke()
    {
        var mad = F(1, "mad");
        var gammel = R(1, "Spaghetti igen", (mad, 100));
        var ny = R(2, "Noget andet", (mad, 100));

        var ctx = Ctx([M(1, mad, "p1", 500)], new() { ["p1"] = 20m });

        // Kun én plads: den vi ikke lige har spist bør vindes.
        var menu = new MenuPlanner(new ShoppingListBuilder(Units, [])).Plan(
            new MenuPlanner.Request(300m, 1, 4, [gammel, ny], RecentRecipeIds: [1]),
            ctx, new Random(5));

        Assert.Equal(2, Assert.Single(menu.Recipes).Id);
    }

    [Fact]
    public void Uden_priser_leveres_stadig_en_menu_men_den_er_markeret()
    {
        // Krav 4: nemlig kan være nede. Så er menuen stadig brugbar til
        // madplanlægning — man ved bare ikke hvad den koster.
        var mad = F(1, "mad");
        var a = R(1, "Ret A", (mad, 100));

        var ctx = Ctx([M(1, mad, "p1", 500)], new() { ["p1"] = null });
        var menu = new MenuPlanner(new ShoppingListBuilder(Units, [])).Plan(
            new MenuPlanner.Request(300m, 1, 4, [a], []), ctx, new Random(1));

        Assert.Single(menu.Recipes);
        Assert.Equal(0m, menu.Cost);
        Assert.Equal(1, menu.UnpricedIngredients);   // så UI'et kan sige det højt
    }

    [Fact]
    public void Tom_opskriftspulje_giver_en_tom_menu_frem_for_at_kaste()
    {
        var menu = new MenuPlanner(new ShoppingListBuilder(Units, [])).Plan(
            new MenuPlanner.Request(300m, 3, 4, [], []),
            Ctx([], []), new Random(1));

        Assert.Empty(menu.Recipes);
        Assert.True(menu.WithinBudget);
    }

    [Fact]
    public void En_ret_vi_ikke_kender_prisen_paa_er_ikke_billigere_end_en_vi_kender()
    {
        // Fejlen dette forhindrer, fundet ved at koere appen: menugeneratoren
        // valgte systematisk de retter den vidste mindst om, fordi en manglende
        // pris taeller som nul. Fem middage til tre personer for 60 kr. saa
        // rigtigt ud og var det ikke.
        var kendt = F(1, "kendt raavare");
        var ukendt = F(2, "ukendt raavare");

        var billigOgKendt = R(1, "Kendt ret", (kendt, 100));
        var gratisOgUkendt = R(2, "Ukendt ret", (ukendt, 100));

        var builder = new ShoppingListBuilder(Units, []);
        // Kun den kendte raavare har en mapning OG en pris.
        var ctx = Ctx([M(1, kendt, "p1", 500), M(2, ukendt, "p2", 500)],
                      new() { ["p1"] = 40m, ["p2"] = null });

        var menu = new MenuPlanner(builder).Plan(
            new MenuPlanner.Request(Budget: 500m, Meals: 1, Servings: 4,
                                    [billigOgKendt, gratisOgUkendt], []),
            ctx, new Random(11));

        Assert.Equal("Kendt ret", Assert.Single(menu.Recipes).Title);
        Assert.Equal(0, menu.UnpricedIngredients);
    }

    [Fact]
    public void Er_intet_prissat_leveres_der_stadig_en_menu()
    {
        // Krav 4: nemlig kan vaere nede, eller ingenting er mappet endnu.
        // Straffen maa ikke betyde at man ingen menu faar.
        var a = F(1, "a"); var b = F(2, "b");
        var r1 = R(1, "Ret A", (a, 100));
        var r2 = R(2, "Ret B", (b, 100));

        var ctx = Ctx([M(1, a, "p1", 500), M(2, b, "p2", 500)],
                      new() { ["p1"] = null, ["p2"] = null });

        var menu = new MenuPlanner(new ShoppingListBuilder(Units, [])).Plan(
            new MenuPlanner.Request(500m, 2, 4, [r1, r2], []), ctx, new Random(3));

        Assert.Equal(2, menu.Recipes.Count);
        Assert.Equal(2, menu.UnpricedIngredients);   // og UI'et siger det hoejt
    }

    [Fact]
    public void En_raavare_helt_uden_vare_taeller_ogsaa_som_ukendt()
    {
        // Den dybere udgave af samme fejl: en ingrediens uden mapning faar
        // status ManglerMapping og indgik hverken i summen eller i taellingen
        // af ukendte. Retten saa baade billig OG fuldt oplyst ud - den vaerste
        // kombination, for saa er der intet at advare om.
        var kendt = F(1, "kendt");
        var umappet = F(2, "umappet");

        var kunKendt = R(1, "Alt kendt", (kendt, 100));
        var medUmappet = R(2, "Har umappet", (umappet, 100));

        var ctx = Ctx([M(1, kendt, "p1", 500)], new() { ["p1"] = 40m });

        var menu = new MenuPlanner(new ShoppingListBuilder(Units, [])).Plan(
            new MenuPlanner.Request(500m, 1, 4, [kunKendt, medUmappet], []),
            ctx, new Random(13));

        Assert.Equal("Alt kendt", Assert.Single(menu.Recipes).Title);
        Assert.Equal(0, menu.UnpricedIngredients);
    }

    [Fact]
    public void Ukendte_raavarer_rapporteres_saa_UI_et_kan_sige_det()
    {
        var umappet = F(1, "umappet");
        var r = R(1, "Ret", (umappet, 100));

        var menu = new MenuPlanner(new ShoppingListBuilder(Units, [])).Plan(
            new MenuPlanner.Request(500m, 1, 4, [r], []),
            Ctx([], []), new Random(1));

        Assert.Single(menu.Recipes);
        Assert.Equal(1, menu.UnpricedIngredients);
        Assert.Equal(0m, menu.Cost);
    }
}
