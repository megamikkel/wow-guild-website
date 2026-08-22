using Madplan.Core.Model;
using Madplan.Core.Parsing;
using Microsoft.EntityFrameworkCore;

namespace Madplan.Data;

/// <summary>Slår et parset råvarenavn op i alias-tabellen og opretter en
/// ubekræftet råvare hvis den er ny. Ubekræftede råvarer er synlige for
/// mennesket, netop fordi de er gættet af en maskine.</summary>
public class FoodResolver(MadplanDbContext db)
{
    public async Task<Food> ResolveOrCreateAsync(string rawFoodName, int? defaultUnitId = null)
    {
        var key = FoodNormalizer.Normalize(rawFoodName);
        if (key.Length == 0) key = rawFoodName.Trim().ToLowerInvariant();

        var alias = await db.FoodAliases.Include(a => a.Food)
            .FirstOrDefaultAsync(a => a.NormalizedAlias == key);
        if (alias?.Food is not null) return alias.Food;

        var food = new Food
        {
            CanonicalName = rawFoodName.Trim(),
            DefaultUnitId = defaultUnitId,
            IsUnconfirmed = true,
        };
        db.Foods.Add(food);
        await db.SaveChangesAsync();

        db.FoodAliases.Add(new FoodAlias
        {
            FoodId = food.Id, Alias = rawFoodName.Trim(), NormalizedAlias = key,
        });
        await db.SaveChangesAsync();
        return food;
    }

    /// <summary>Tilføjer en skrivemåde til en eksisterende råvare. Gør intet hvis
    /// nøglen allerede peger et sted hen — aliasser er unikke på tværs af alt.</summary>
    public async Task<bool> AddAliasAsync(int foodId, string alias)
    {
        var key = FoodNormalizer.Normalize(alias);
        if (key.Length == 0) return false;
        if (await db.FoodAliases.AnyAsync(a => a.NormalizedAlias == key)) return false;

        db.FoodAliases.Add(new FoodAlias { FoodId = foodId, Alias = alias.Trim(), NormalizedAlias = key });
        await db.SaveChangesAsync();
        return true;
    }

    /// <summary>Slår to råvarer sammen. Man opretter dubletter — "flødeost" og
    /// "flødeoste" — og uden en merge råddirer datamodellen stille over et halvt år.
    /// Mealie har PUT /foods/merge af nøjagtig samme grund.</summary>
    public async Task MergeAsync(int keepFoodId, int mergeFoodId)
    {
        if (keepFoodId == mergeFoodId) return;

        await db.FoodAliases.Where(a => a.FoodId == mergeFoodId)
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.FoodId, keepFoodId));
        await db.RecipeIngredients.Where(i => i.FoodId == mergeFoodId)
            .ExecuteUpdateAsync(s => s.SetProperty(i => i.FoodId, keepFoodId));

        // Mapninger og omregninger flyttes kun hvis modtageren ikke har dem i forvejen.
        var keepProducts = await db.ProductMappings.Where(m => m.FoodId == keepFoodId)
            .Select(m => m.NemligProductId).ToListAsync();
        foreach (var m in await db.ProductMappings.Where(m => m.FoodId == mergeFoodId).ToListAsync())
        {
            if (keepProducts.Contains(m.NemligProductId)) db.ProductMappings.Remove(m);
            else { m.FoodId = keepFoodId; m.IsPreferred = false; }
        }

        var keepPairs = await db.FoodUnitConversions.Where(c => c.FoodId == keepFoodId)
            .Select(c => new { c.FromUnitId, c.ToUnitId }).ToListAsync();
        foreach (var c in await db.FoodUnitConversions.Where(c => c.FoodId == mergeFoodId).ToListAsync())
        {
            if (keepPairs.Any(k => k.FromUnitId == c.FromUnitId && k.ToUnitId == c.ToUnitId))
                db.FoodUnitConversions.Remove(c);
            else c.FoodId = keepFoodId;
        }

        await db.PantryItems.Where(p => p.FoodId == mergeFoodId).ExecuteDeleteAsync();
        await db.Foods.Where(f => f.Id == mergeFoodId).ExecuteDeleteAsync();
        await db.SaveChangesAsync();
    }
}
