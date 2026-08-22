using Madplan.Core.Model;
using Madplan.Core.Planning;

namespace Madplan.Tests;

public class ShoppingListBuilderTests
{
    // Enheder svarende til seed-data.
    private static readonly Unit G   = new() { Id = 1, Abbreviation = "g",    Type = UnitType.Mass,   ToBaseFactor = 1 };
    private static readonly Unit Kg  = new() { Id = 2, Abbreviation = "kg",   Type = UnitType.Mass,   ToBaseFactor = 1000 };
    private static readonly Unit Ml  = new() { Id = 3, Abbreviation = "ml",   Type = UnitType.Volume, ToBaseFactor = 1 };
    private static readonly Unit Dl  = new() { Id = 4, Abbreviation = "dl",   Type = UnitType.Volume, ToBaseFactor = 100 };
    private static readonly Unit Spsk= new() { Id = 5, Abbreviation = "spsk", Type = UnitType.Volume, ToBaseFactor = 15 };
    private static readonly Unit Stk = new() { Id = 6, Abbreviation = "stk",  Type = UnitType.Count,  ToBaseFactor = 1 };
    private static readonly Unit Knivspids = new() { Id = 7, Abbreviation = "knivspids", Type = UnitType.Count, ToBaseFactor = 1, IsStandard = false };

    private static readonly Unit[] AllUnits = [G, Kg, Ml, Dl, Spsk, Stk, Knivspids];

    private static ShoppingListBuilder.Input EmptyInput(
        IEnumerable<MealPlanEntry> entries,
        IEnumerable<ProductMapping>? mappings = null,
        IEnumerable<PantryItem>? pantry = null,
        Dictionary<string, decimal?>? prices = null,
        Dictionary<string, bool>? stock = null)
        => new([.. entries], [.. mappings ?? []], [.. pantry ?? []],
               prices ?? [], stock ?? []);

    private static MealPlanEntry Entry(Recipe r, int servings) =>
        new() { Recipe = r, RecipeId = r.Id, Servings = servings, Date = new DateOnly(2026, 8, 24) };

    private static Recipe Recipe(int id, string title, int servings, params RecipeIngredient[] ings)
        => new() { Id = id, Title = title, Servings = servings, Ingredients = [.. ings] };

    private static RecipeIngredient Ing(Food food, double qty, Unit unit, string raw = "")
        => new() { Food = food, FoodId = food.Id, Quantity = qty, Unit = unit, UnitId = unit.Id, RawText = raw };

    [Fact]
    public void Samme_raavare_paa_tvaers_af_tre_opskrifter_bliver_EN_linje()
    {
        // Kravet ordret: "500 g hakket oksekød skal ikke ende som fem forskellige
        // varer på tværs af tre opskrifter i samme uge."
        var oksekoed = new Food { Id = 1, CanonicalName = "hakket oksekød" };
        var entries = new[]
        {
            Entry(Recipe(1, "Spaghetti", 4, Ing(oksekoed, 500, G)), 4),
            Entry(Recipe(2, "Frikadeller", 4, Ing(oksekoed, 400, G)), 4),
            Entry(Recipe(3, "Lasagne", 4, Ing(oksekoed, 0.3, Kg)), 4),
        };

        var list = new ShoppingListBuilder(AllUnits, []).Build(new MealPlan(), EmptyInput(entries));

        var line = Assert.Single(list.Lines);
        Assert.Equal(1200, line.NeededQuantity, 3); // 500 + 400 + 300
    }

    [Fact]
    public void Portioner_skaleres_pr_dag_ikke_pr_opskrift()
    {
        var ris = new Food { Id = 2, CanonicalName = "ris" };
        // Opskrift til 4, men vi laver den til 6 mandag og 2 onsdag.
        var r = Recipe(1, "Karry", 4, Ing(ris, 200, G));
        var entries = new[] { Entry(r, 6), Entry(r, 2) };

        var list = new ShoppingListBuilder(AllUnits, []).Build(new MealPlan(), EmptyInput(entries));

        // 200*(6/4) + 200*(2/4) = 300 + 100
        Assert.Equal(400, Assert.Single(list.Lines).NeededQuantity, 3);
    }

    [Fact]
    public void Dl_og_ml_lægges_sammen_inden_for_samme_enhedstype()
    {
        var floede = new Food { Id = 3, CanonicalName = "fløde" };
        var entries = new[]
        {
            Entry(Recipe(1, "Sovs", 4, Ing(floede, 2, Dl)), 4),
            Entry(Recipe(2, "Gratin", 4, Ing(floede, 150, Ml)), 4),
        };

        var list = new ShoppingListBuilder(AllUnits, []).Build(new MealPlan(), EmptyInput(entries));
        Assert.Equal(350, Assert.Single(list.Lines).NeededQuantity, 3); // 200 + 150
    }

    [Fact]
    public void Dl_mel_omregnes_til_gram_naar_densiteten_findes()
    {
        var mel = new Food { Id = 4, CanonicalName = "hvedemel" };
        // 1 dl mel ≈ 60 g. Uden denne kan de to linjer ikke lægges sammen.
        var densitet = new FoodUnitConversion
        {
            FoodId = mel.Id, FromUnitId = Dl.Id, FromUnit = Dl,
            ToUnitId = G.Id, ToUnit = G, Factor = 60,
        };

        var entries = new[]
        {
            Entry(Recipe(1, "Boller", 4, Ing(mel, 250, G)), 4),
            Entry(Recipe(2, "Pandekager", 4, Ing(mel, 2, Dl)), 4),
        };

        var list = new ShoppingListBuilder(AllUnits, [densitet]).Build(new MealPlan(), EmptyInput(entries));

        var line = Assert.Single(list.Lines);
        Assert.True(line.Status != LineStatus.KanIkkeBeregnes);
        Assert.Equal(370, line.NeededQuantity, 3); // 250 + 2*60
    }

    [Fact]
    public void Uden_densitet_naegter_vi_at_laegge_sammen_og_beder_om_hjaelp()
    {
        var hvidloeg = new Food { Id = 5, CanonicalName = "hvidløg" };
        var entries = new[]
        {
            Entry(Recipe(1, "Pasta", 4, Ing(hvidloeg, 2, Stk)), 4),
            Entry(Recipe(2, "Suppe", 4, Ing(hvidloeg, 1, Spsk)), 4),
        };

        var list = new ShoppingListBuilder(AllUnits, []).Build(new MealPlan(), EmptyInput(entries));

        var line = Assert.Single(list.Lines);
        Assert.Equal(LineStatus.KanIkkeBeregnes, line.Status);
        Assert.NotNull(line.Warning);
    }

    [Fact]
    public void Spisekammervarer_ryger_ikke_paa_listen()
    {
        var salt = new Food { Id = 6, CanonicalName = "salt", IsPantryStaple = true };
        var entries = new[] { Entry(Recipe(1, "Alt", 4, Ing(salt, 1, G)), 4) };

        var list = new ShoppingListBuilder(AllUnits, []).Build(new MealPlan(), EmptyInput(entries));

        Assert.Equal(LineStatus.Spisekammer, Assert.Single(list.Lines).Status);
        Assert.False(Assert.Single(list.Lines).Included);
    }

    [Fact]
    public void Spisekammervare_kommer_paa_listen_naar_vi_er_loebet_toer()
    {
        var mel = new Food { Id = 7, CanonicalName = "mel", IsPantryStaple = true };
        var mapping = new ProductMapping
        {
            Id = 1, FoodId = mel.Id, NemligProductId = "111", ProductName = "Hvedemel 1 kg",
            PackageSize = 1, PackageUnitId = Kg.Id, PackageUnit = Kg,
        };
        var pantry = new[] { new PantryItem { FoodId = mel.Id, State = PantryState.LoebetToer } };
        var entries = new[] { Entry(Recipe(1, "Boller", 4, Ing(mel, 500, G)), 4) };

        var list = new ShoppingListBuilder(AllUnits, []).Build(
            new MealPlan(), EmptyInput(entries, [mapping], pantry));

        var line = Assert.Single(list.Lines);
        Assert.Equal(LineStatus.Ok, line.Status);
        Assert.Equal(1, line.PackCount);
    }

    [Fact]
    public void Trehundrede_gram_pasta_bliver_til_EN_pose_aa_femhundrede()
    {
        // Kravet ordret.
        var pasta = new Food { Id = 8, CanonicalName = "pasta" };
        var mapping = new ProductMapping
        {
            Id = 1, FoodId = pasta.Id, NemligProductId = "222", ProductName = "Spaghetti 500 g",
            PackageSize = 500, PackageUnitId = G.Id, PackageUnit = G,
        };
        var entries = new[] { Entry(Recipe(1, "Pasta", 4, Ing(pasta, 300, G)), 4) };

        var list = new ShoppingListBuilder(AllUnits, []).Build(
            new MealPlan(), EmptyInput(entries, [mapping], prices: new() { ["222"] = 12.95m }));

        var line = Assert.Single(list.Lines);
        Assert.Equal(1, line.PackCount);
        Assert.Equal(12.95m, line.EstimatedPrice);
    }

    [Fact]
    public void Manglende_mapping_stopper_og_spoerger_i_stedet_for_at_gaette()
    {
        var noget = new Food { Id = 9, CanonicalName = "sesamolie" };
        var entries = new[] { Entry(Recipe(1, "Wok", 4, Ing(noget, 2, Spsk)), 4) };

        var list = new ShoppingListBuilder(AllUnits, []).Build(new MealPlan(), EmptyInput(entries));

        var line = Assert.Single(list.Lines);
        Assert.Equal(LineStatus.ManglerMapping, line.Status);
        Assert.Equal(0, line.PackCount);
        Assert.Null(line.EstimatedPrice);
    }

    [Fact]
    public void Ukendt_pris_er_null_ikke_nul_og_listen_siger_det()
    {
        var ris = new Food { Id = 10, CanonicalName = "ris" };
        var mapping = new ProductMapping
        {
            Id = 1, FoodId = ris.Id, NemligProductId = "333", ProductName = "Ris 1 kg",
            PackageSize = 1000, PackageUnitId = G.Id, PackageUnit = G,
        };
        var entries = new[] { Entry(Recipe(1, "Karry", 4, Ing(ris, 400, G)), 4) };

        // Ingen priser: nemlig er nede.
        var list = new ShoppingListBuilder(AllUnits, []).Build(
            new MealPlan(), EmptyInput(entries, [mapping]));

        var line = Assert.Single(list.Lines);
        Assert.Equal(1, line.PackCount);      // listen er stadig fuldt brugbar
        Assert.Null(line.EstimatedPrice);     // men prisen er ukendt
        Assert.True(list.HasUnknownPrices);
        Assert.Equal(0m, list.KnownTotal);
    }

    [Fact]
    public void Uparsede_linjer_forsvinder_ikke()
    {
        var r = Recipe(1, "Gryde", 4);
        r.Ingredients.Add(new RecipeIngredient { RawText = "salt og peber" }); // ingen Food/Quantity
        var entries = new[] { Entry(r, 4) };

        var list = new ShoppingListBuilder(AllUnits, []).Build(new MealPlan(), EmptyInput(entries));

        var line = Assert.Single(list.Lines);
        Assert.Equal("salt og peber", line.UnparsedText);
        Assert.Contains("Gryde", line.Warning);
    }

    [Fact]
    public void Udsolgt_vare_markeres_men_tælles_stadig_med()
    {
        var fisk = new Food { Id = 11, CanonicalName = "laks" };
        var mapping = new ProductMapping
        {
            Id = 1, FoodId = fisk.Id, NemligProductId = "444", ProductName = "Laksefilet 400 g",
            PackageSize = 400, PackageUnitId = G.Id, PackageUnit = G,
        };
        var entries = new[] { Entry(Recipe(1, "Laks", 4, Ing(fisk, 400, G)), 4) };

        var list = new ShoppingListBuilder(AllUnits, []).Build(
            new MealPlan(), EmptyInput(entries, [mapping], stock: new() { ["444"] = false }));

        Assert.Equal(LineStatus.Udsolgt, Assert.Single(list.Lines).Status);
    }
}

public class UnitMismatchTests
{
    private static readonly Unit G   = new() { Id = 1, Abbreviation = "g",   Type = UnitType.Mass,  ToBaseFactor = 1 };
    private static readonly Unit Stk = new() { Id = 6, Abbreviation = "stk", Type = UnitType.Count, ToBaseFactor = 1 };
    private static readonly Unit[] Units = [G, Stk];

    [Fact]
    public void Vare_opgjort_i_gram_mod_behov_i_styk_beregnes_ikke_men_forklares()
    {
        // Fundet ved at køre appen: "1 dåse flåede tomater" gav en mapning hvis
        // pakkestørrelse blev udledt til 400 g. Resultatet var beskeden
        // "Du køber 399,92 for at bruge 2" — vrøvl, fordi enhedstyperne ikke matcher.
        var tomat = new Food { Id = 1, CanonicalName = "flåede tomater" };
        var mapping = new ProductMapping
        {
            Id = 1, FoodId = tomat.Id, NemligProductId = "1", ProductName = "Flåede tomater",
            PackageSize = 400, PackageUnitId = G.Id, PackageUnit = G,   // gram
        };

        var recipe = new Recipe { Id = 1, Title = "Sovs", Servings = 4, Ingredients = [
            new RecipeIngredient { Food = tomat, FoodId = tomat.Id, Quantity = 2, Unit = Stk, UnitId = Stk.Id }
        ]};
        var entries = new[] { new MealPlanEntry { Recipe = recipe, RecipeId = 1, Servings = 4 } };

        var list = new ShoppingListBuilder(Units, []).Build(new MealPlan(),
            new ShoppingListBuilder.Input(entries, [mapping], [], new Dictionary<string, decimal?>(),
                                          new Dictionary<string, bool>()));

        var line = Assert.Single(list.Lines);
        Assert.Equal(LineStatus.KanIkkeBeregnes, line.Status);
        Assert.Equal(0, line.PackCount);
        Assert.Contains("styk", line.Warning);
        Assert.Contains("g", line.Warning);
    }

    [Fact]
    public void Matchende_enhedstyper_beregnes_som_foer()
    {
        var pasta = new Food { Id = 2, CanonicalName = "pasta" };
        var mapping = new ProductMapping
        {
            Id = 1, FoodId = pasta.Id, NemligProductId = "2", ProductName = "Spaghetti 500 g",
            PackageSize = 500, PackageUnitId = G.Id, PackageUnit = G,
        };
        var recipe = new Recipe { Id = 1, Title = "Pasta", Servings = 4, Ingredients = [
            new RecipeIngredient { Food = pasta, FoodId = pasta.Id, Quantity = 300, Unit = G, UnitId = G.Id }
        ]};
        var entries = new[] { new MealPlanEntry { Recipe = recipe, RecipeId = 1, Servings = 4 } };

        var list = new ShoppingListBuilder(Units, []).Build(new MealPlan(),
            new ShoppingListBuilder.Input(entries, [mapping], [], new Dictionary<string, decimal?>(),
                                          new Dictionary<string, bool>()));

        var line = Assert.Single(list.Lines);
        Assert.Equal(LineStatus.Ok, line.Status);
        Assert.Equal(1, line.PackCount);
    }
}
