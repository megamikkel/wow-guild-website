using Madplan.Core.Model;
using Madplan.Core.Planning;

namespace Madplan.Tests;

/// <summary>Rester: en stor portion mandag der også dækker tirsdag og onsdag.
///
/// Modelleret som ét tal på én række frem for rester-rækker på de følgende dage.
/// Rester-rækker ville skulle udelades fra indkøbslisten for ikke at købe ind
/// tre gange til samme måltid — og den slags «tæl ikke den her med»-regler er
/// præcis hvor stille fejl bor.</summary>
public class LeftoverTests
{
    private static readonly Unit G = new() { Id = 1, Abbreviation = "g", Type = UnitType.Mass, ToBaseFactor = 1 };

    private static MealPlanEntry Entry(Recipe r, int servings, int coversDays, DateOnly date) =>
        new() { Recipe = r, RecipeId = r.Id, Servings = servings, CoversDays = coversDays, Date = date };

    private static Recipe Fisk(Food fisk) => new()
    {
        Id = 1, Title = "Fiskefrikadeller", Servings = 4,
        Ingredients = [new RecipeIngredient { Food = fisk, FoodId = fisk.Id, Quantity = 500, Unit = G, UnitId = G.Id }],
    };

    [Fact]
    public void En_ret_der_holder_tre_dage_daekker_de_tre_dage()
    {
        var mandag = new DateOnly(2026, 8, 24);
        var e = Entry(Fisk(new Food { Id = 1 }), 3, 3, mandag);

        Assert.Equal([mandag, mandag.AddDays(1), mandag.AddDays(2)], e.Dates);
        Assert.False(e.IsLeftoverOn(mandag));           // mandag laves den
        Assert.True(e.IsLeftoverOn(mandag.AddDays(1)));
        Assert.True(e.IsLeftoverOn(mandag.AddDays(2)));
        Assert.False(e.IsLeftoverOn(mandag.AddDays(3)));
    }

    [Fact]
    public void Der_koebes_ind_til_alle_dagene_paa_een_gang()
    {
        // 500 g fisk til 4 portioner. 3 personer i 3 dage = 9 portioner.
        var fisk = new Food { Id = 1, CanonicalName = "torskefilet" };
        var e = Entry(Fisk(fisk), servings: 3, coversDays: 3, new DateOnly(2026, 8, 24));

        var list = new ShoppingListBuilder([G], []).Build(new MealPlan(),
            new ShoppingListBuilder.Input([e], [], [], new Dictionary<string, decimal?>(),
                                          new Dictionary<string, bool>()));

        // 500 g × 9/4 = 1125 g
        Assert.Equal(1125, Assert.Single(list.Lines).NeededQuantity, 1);
    }

    [Fact]
    public void En_almindelig_aften_koeber_kun_til_een_dag()
    {
        var fisk = new Food { Id = 1, CanonicalName = "torskefilet" };
        var e = Entry(Fisk(fisk), servings: 3, coversDays: 1, new DateOnly(2026, 8, 24));

        var list = new ShoppingListBuilder([G], []).Build(new MealPlan(),
            new ShoppingListBuilder.Input([e], [], [], new Dictionary<string, decimal?>(),
                                          new Dictionary<string, bool>()));

        Assert.Equal(375, Assert.Single(list.Lines).NeededQuantity, 1);   // 500 × 3/4
    }

    [Fact]
    public void Nul_eller_negative_dage_behandles_som_een()
    {
        // Robusthed mod gamle rækker og forkert input: CoversDays = 0 må ikke
        // betyde at der ikke købes ind til retten.
        var fisk = new Food { Id = 1, CanonicalName = "torskefilet" };
        var e = Entry(Fisk(fisk), servings: 4, coversDays: 0, new DateOnly(2026, 8, 24));

        var list = new ShoppingListBuilder([G], []).Build(new MealPlan(),
            new ShoppingListBuilder.Input([e], [], [], new Dictionary<string, decimal?>(),
                                          new Dictionary<string, bool>()));

        Assert.Equal(500, Assert.Single(list.Lines).NeededQuantity, 1);
        Assert.Single(e.Dates);
    }

    [Fact]
    public void To_retter_der_deler_en_raavare_laegges_stadig_sammen_paa_tvaers_af_rester()
    {
        var koed = new Food { Id = 1, CanonicalName = "hakket oksekød" };
        RecipeIngredient Ing(double q) => new() { Food = koed, FoodId = 1, Quantity = q, Unit = G, UnitId = 1 };

        var a = new Recipe { Id = 1, Title = "A", Servings = 4, Ingredients = [Ing(400)] };
        var b = new Recipe { Id = 2, Title = "B", Servings = 4, Ingredients = [Ing(400)] };

        var entries = new[]
        {
            Entry(a, 4, 2, new DateOnly(2026, 8, 24)),   // 8 portioner
            Entry(b, 4, 1, new DateOnly(2026, 8, 26)),   // 4 portioner
        };

        var list = new ShoppingListBuilder([G], []).Build(new MealPlan(),
            new ShoppingListBuilder.Input(entries, [], [], new Dictionary<string, decimal?>(),
                                          new Dictionary<string, bool>()));

        // 400×2 + 400×1 = 1200 g, som ÉN linje
        Assert.Equal(1200, Assert.Single(list.Lines).NeededQuantity, 1);
    }
}
