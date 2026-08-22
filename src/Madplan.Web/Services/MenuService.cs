using Madplan.Core.Model;
using Madplan.Core.Planning;
using Madplan.Data;
using Microsoft.EntityFrameworkCore;

namespace Madplan.Web.Services;

/// <summary>Binder budgetgeneratoren sammen med databasen: henter opskrifter,
/// mapninger og priser, kører <see cref="MenuPlanner"/>, og kan lægge resultatet
/// på ugeplanen.</summary>
public class MenuService(MadplanDbContext db)
{
    public async Task<MenuPlanner.Menu> SuggestAsync(
        decimal budget, int meals, int servings,
        int? maxMinutes, bool childFriendly, bool vegetarian,
        CancellationToken ct = default)
    {
        var recipes = await db.Recipes
            .Include(r => r.Ingredients).ThenInclude(i => i.Food)
            .Include(r => r.Ingredients).ThenInclude(i => i.Unit)
            .AsSplitQuery()
            .ToListAsync(ct);

        var units = await db.Units.ToListAsync(ct);
        var conversions = await db.FoodUnitConversions
            .Include(c => c.FromUnit).Include(c => c.ToUnit).ToListAsync(ct);
        var mappings = await db.ProductMappings.Include(m => m.PackageUnit).ToListAsync(ct);
        var pantry = await db.PantryItems.ToListAsync(ct);

        // Seneste kendte pris pr. vare. Vi henter IKKE nye priser her: generatoren
        // prissætter dusinvis af kandidatmenuer, og at ringe til nemlig for hver
        // ville være både langsomt og uhøfligt. Den daglige opdatering holder
        // tallene friske nok.
        var prices = new Dictionary<string, decimal?>();
        var stock = new Dictionary<string, bool>();
        foreach (var s in await db.ProductSnapshots
                     .GroupBy(s => s.NemligProductId)
                     .Select(g => g.OrderByDescending(x => x.ObservedAt).First())
                     .ToListAsync(ct))
        {
            prices[s.NemligProductId] = s.Price;
            stock[s.NemligProductId] = s.InStock;
        }

        // Retter fra de fire seneste uger nedprioriteres.
        var cutoff = DateOnly.FromDateTime(DateTime.Today.AddDays(-28));
        var recent = await db.MealPlanEntries
            .Where(e => e.Date >= cutoff).Select(e => e.RecipeId).Distinct().ToListAsync(ct);

        var builder = new ShoppingListBuilder(units, conversions);
        var ctx = new ShoppingListBuilder.Input([], mappings, pantry, prices, stock);

        return new MenuPlanner(builder).Plan(
            new MenuPlanner.Request(budget, meals, servings, recipes, recent,
                                    maxMinutes, childFriendly, vegetarian),
            ctx);
    }

    /// <summary>Lægger en foreslået menu på ugeplanen, fra mandag og frem.
    /// Rører ikke dage der allerede har en ret.</summary>
    public async Task<int> ApplyToWeekAsync(
        MenuPlanner.Menu menu, int householdId, int isoYear, int isoWeek, int servings,
        CancellationToken ct = default)
    {
        var plan = await db.MealPlans
            .Include(p => p.Entries)
            .FirstOrDefaultAsync(p => p.HouseholdId == householdId
                                   && p.IsoYear == isoYear && p.IsoWeek == isoWeek, ct);

        if (plan is null)
        {
            plan = new MealPlan { HouseholdId = householdId, IsoYear = isoYear, IsoWeek = isoWeek };
            db.MealPlans.Add(plan);
            await db.SaveChangesAsync(ct);
        }

        var monday = MealPlanService.MondayOf(isoYear, isoWeek);
        var optagne = plan.Entries.Select(e => e.Date).ToHashSet();
        var lagt = 0;

        foreach (var recipe in menu.Recipes)
        {
            var dag = Enumerable.Range(0, 7).Select(monday.AddDays)
                .FirstOrDefault(d => !optagne.Contains(d));
            if (dag == default) break;

            db.MealPlanEntries.Add(new MealPlanEntry
            {
                MealPlanId = plan.Id, Date = dag, RecipeId = recipe.Id, Servings = servings,
            });
            optagne.Add(dag);
            lagt++;
        }

        await db.SaveChangesAsync(ct);
        return lagt;
    }
}
