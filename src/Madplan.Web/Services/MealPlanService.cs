using System.Globalization;
using Madplan.Core.Model;
using Madplan.Core.Planning;
using Madplan.Data;
using Madplan.Nemlig.Contracts;
using Microsoft.EntityFrameworkCore;

namespace Madplan.Web.Services;

/// <summary>Binder madplanen sammen med prisopslag. Bemærk at prisdelen er
/// valgfri hele vejen igennem: fejler nemlig, bygges listen alligevel og
/// priserne er null.</summary>
public class MealPlanService(MadplanDbContext db, INemligCatalog catalog, ILogger<MealPlanService> log)
{
    public static (int Year, int Week) CurrentIsoWeek(DateOnly? date = null)
    {
        var d = (date ?? DateOnly.FromDateTime(DateTime.Today)).ToDateTime(TimeOnly.MinValue);
        return (ISOWeek.GetYear(d), ISOWeek.GetWeekOfYear(d));
    }

    public static DateOnly MondayOf(int isoYear, int isoWeek) =>
        DateOnly.FromDateTime(ISOWeek.ToDateTime(isoYear, isoWeek, DayOfWeek.Monday));

    public async Task<MealPlan> GetOrCreateAsync(int householdId, int isoYear, int isoWeek)
    {
        var plan = await db.MealPlans
            .Include(p => p.Entries).ThenInclude(e => e.Recipe).ThenInclude(r => r!.Ingredients)
            .FirstOrDefaultAsync(p => p.HouseholdId == householdId
                                   && p.IsoYear == isoYear && p.IsoWeek == isoWeek);
        if (plan is not null) return plan;

        plan = new MealPlan { HouseholdId = householdId, IsoYear = isoYear, IsoWeek = isoWeek };
        db.MealPlans.Add(plan);
        await db.SaveChangesAsync();
        return plan;
    }

    /// <summary>Bygger ugens indkøbsliste. Slår priser op hvis nemlig svarer;
    /// gør den ikke, er listen stadig komplet og korrekt — bare uden priser.</summary>
    public async Task<ShoppingList> BuildShoppingListAsync(MealPlan plan, CancellationToken ct = default)
    {
        var entries = await db.MealPlanEntries
            .Include(e => e.Recipe).ThenInclude(r => r!.Ingredients).ThenInclude(i => i.Food)
            .Include(e => e.Recipe).ThenInclude(r => r!.Ingredients).ThenInclude(i => i.Unit)
            .Where(e => e.MealPlanId == plan.Id)
            .ToListAsync(ct);

        var units = await db.Units.ToListAsync(ct);
        var conversions = await db.FoodUnitConversions
            .Include(c => c.FromUnit).Include(c => c.ToUnit).ToListAsync(ct);
        var mappings = await db.ProductMappings.Include(m => m.PackageUnit).ToListAsync(ct);
        var pantry = await db.PantryItems.ToListAsync(ct);

        var neededProductIds = mappings.Select(m => m.NemligProductId).Distinct().ToList();
        var (prices, stock) = await LookUpPricesAsync(neededProductIds, mappings, ct);

        var builder = new ShoppingListBuilder(units, conversions);
        return builder.Build(plan, new ShoppingListBuilder.Input(
            entries, mappings, pantry, prices, stock));
    }

    private async Task<(Dictionary<string, decimal?>, Dictionary<string, bool>)> LookUpPricesAsync(
        IReadOnlyCollection<string> productIds, IReadOnlyCollection<ProductMapping> mappings, CancellationToken ct)
    {
        var mappingsById = mappings
            .GroupBy(m => m.NemligProductId)
            .ToDictionary(g => g.Key, g => g.First());

        var prices = new Dictionary<string, decimal?>();
        var stock = new Dictionary<string, bool>();
        if (productIds.Count == 0) return (prices, stock);

        // Først de priser vi allerede har observeret. Så slipper vi for at
        // spørge nemlig om noget vi lige har spurgt om.
        var cutoff = DateTime.UtcNow.AddHours(-6);
        var recent = await db.ProductSnapshots
            .Where(s => productIds.Contains(s.NemligProductId) && s.ObservedAt >= cutoff)
            .GroupBy(s => s.NemligProductId)
            .Select(g => g.OrderByDescending(s => s.ObservedAt).First())
            .ToListAsync(ct);

        foreach (var s in recent)
        {
            prices[s.NemligProductId] = s.Price;
            stock[s.NemligProductId] = s.InStock;
        }

        var missing = productIds.Where(id => !prices.ContainsKey(id)).ToList();
        if (missing.Count == 0) return (prices, stock);

        try
        {
            foreach (var id in missing)
            {
                var mapping = mappingsById.GetValueOrDefault(id);
                var detail = await catalog.GetProductAsync(id, mapping?.ProductUrl, ct: ct);
                if (detail is null) continue;

                var p = detail.Product;
                prices[id] = p.Price;
                stock[id] = p.InStock;

                // Observationer gemmes frem for at overskrive — grundlaget for
                // prishistorik senere, uden en migration nu.
                db.ProductSnapshots.Add(new ProductSnapshot
                {
                    NemligProductId = id, Price = p.Price, UnitPrice = p.UnitPrice,
                    UnitPriceLabel = p.UnitPriceLabel, InStock = p.InStock, Description = p.Description,
                });
            }
            await db.SaveChangesAsync(ct);
        }
        catch (NemligUnavailableException ex)
        {
            // Krav 4: madplanen virker uden nemlig. Prisen bliver bare ukendt.
            log.LogWarning("Kunne ikke hente priser fra nemlig: {Reason}. " +
                           "Indkøbslisten bygges videre uden priser.", ex.Reason);
        }

        return (prices, stock);
    }
}
