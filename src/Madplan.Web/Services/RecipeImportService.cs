using Madplan.Core.Model;
using Madplan.Core.Parsing;
using Madplan.Data;
using Madplan.Recipes;
using Microsoft.EntityFrameworkCore;

namespace Madplan.Web.Services;

/// <summary>Gemmer hentede opskrifter i databasen og opretter de råvarer der
/// mangler undervejs.
///
/// Attribution gemmes altid: kilde-URL, sidens navn og forfatteren. Vi cacher
/// til privat husholdningsbrug og publicerer intet — se docs/opskriftskilder.md §7.</summary>
public class RecipeImportService(
    MadplanDbContext db,
    RecipeFetcher fetcher,
    FoodResolver foods,
    ILogger<RecipeImportService> log)
{
    public record ImportResult(string Url, string? Title, string? Error, bool Skipped)
    {
        public bool Ok => Error is null && !Skipped;
    }

    public async Task<IReadOnlyList<ImportResult>> ImportAsync(
        IEnumerable<string> urls,
        IProgress<ImportResult>? progress = null,
        CancellationToken ct = default)
    {
        var results = new List<ImportResult>();

        foreach (var url in urls.Select(u => u.Trim()).Where(u => u.Length > 0).Distinct())
        {
            ct.ThrowIfCancellationRequested();

            // Allerede importeret? Så lader vi kilden være i fred.
            if (await db.Recipes.AnyAsync(r => r.SourceUrl == url, ct))
            {
                var eksisterende = await db.Recipes
                    .Where(r => r.SourceUrl == url).Select(r => r.Title).FirstAsync(ct);
                var skip = new ImportResult(url, eksisterende, null, Skipped: true);
                results.Add(skip);
                progress?.Report(skip);
                continue;
            }

            var fetched = await fetcher.FetchAsync(url, ct);
            if (!fetched.Ok)
            {
                var fail = new ImportResult(url, null, fetched.Error, false);
                results.Add(fail);
                progress?.Report(fail);
                continue;
            }

            try
            {
                var recipe = await SaveAsync(fetched.Recipe!, ct);
                var ok = new ImportResult(url, recipe.Title, null, false);
                results.Add(ok);
                progress?.Report(ok);
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Kunne ikke gemme opskrift fra {Url}", url);
                var fail = new ImportResult(url, fetched.Recipe!.Title, $"Kunne ikke gemmes: {ex.Message}", false);
                results.Add(fail);
                progress?.Report(fail);
            }
        }

        return results;
    }

    private async Task<Recipe> SaveAsync(ScrapedRecipe scraped, CancellationToken ct)
    {
        var householdId = await db.Households.Select(h => h.Id).FirstAsync(ct);
        var units = await db.Units.ToListAsync(ct);
        var stkId = units.First(u => u.Abbreviation == "stk").Id;

        var recipe = new Recipe
        {
            HouseholdId = householdId,
            Title = scraped.Title,
            Servings = scraped.Servings ?? 4,
            TotalTimeMinutes = scraped.TotalMinutes,
            Instructions = scraped.Instructions,
            ImageUrl = scraped.ImageUrl,
            SourceUrl = scraped.SourceUrl,
            SourceName = scraped.SourceName,
            Attribution = scraped.Attribution,
            IsOwn = false,
            CachedAt = DateTime.UtcNow,
            IsChildFriendly = LooksChildFriendly(scraped.Categories),
            IsVegetarian = LooksVegetarian(scraped.Categories),
        };

        db.Recipes.Add(recipe);
        await db.SaveChangesAsync(ct);

        var order = 0;
        foreach (var raw in scraped.Ingredients)
        {
            var parsed = IngredientParser.Parse(raw);
            var unit = parsed.UnitAbbrev is null
                ? null
                : units.FirstOrDefault(u => u.Abbreviation == parsed.UnitAbbrev);

            // Uden mængde eller navn er linjen ikke beregnelig. Den gemmes
            // alligevel med sin råtekst — den skal ikke forsvinde.
            Food? food = null;
            if (parsed.HasQuantity && parsed.FoodName.Length > 0)
                food = await foods.ResolveOrCreateAsync(parsed.FoodName, unit?.Id);

            db.RecipeIngredients.Add(new RecipeIngredient
            {
                RecipeId = recipe.Id,
                RawText = raw,
                Quantity = food is null ? null : parsed.Quantity,
                UnitId = food is null ? null : unit?.Id ?? stkId,
                FoodId = food?.Id,
                Note = parsed.Note,
                SortOrder = order++,
            });
        }

        await db.SaveChangesAsync(ct);
        return recipe;
    }

    // Kategorierne er sidernes egne ord. Heuristikken er grov med vilje — den
    // sætter et flag man kan rette i hånden, ikke en sandhed.
    private static bool LooksChildFriendly(IReadOnlyList<string> categories) =>
        categories.Any(c => c.Contains("børn", StringComparison.OrdinalIgnoreCase)
                         || c.Contains("familie", StringComparison.OrdinalIgnoreCase)
                         || c.Contains("hverdag", StringComparison.OrdinalIgnoreCase));

    private static bool LooksVegetarian(IReadOnlyList<string> categories) =>
        categories.Any(c => c.Contains("vegetar", StringComparison.OrdinalIgnoreCase)
                         || c.Contains("vegan", StringComparison.OrdinalIgnoreCase));
}
