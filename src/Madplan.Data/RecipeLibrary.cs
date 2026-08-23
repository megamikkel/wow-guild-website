using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;
using Madplan.Core.Model;
using Madplan.Core.Parsing;
using Microsoft.EntityFrameworkCore;

namespace Madplan.Data;

/// <summary>Et startbibliotek af danske hverdagsretter, indlejret i programmet.
///
/// Hvorfor det findes: en tom app er ubrugelig, og at bede folk kopiere links
/// ind én ad gangen er ikke et bibliotek — det er en opgave. Retterne er skrevet
/// til dette projekt, så der er hverken netværk eller ophavsret involveret.
///
/// Alle retter er skrevet med en etårig ved bordet: meget lidt salt, bløde
/// konsistenser, og ingen hele runde ting. Hver ret har en note om hvad man gør
/// anderledes til den mindste. Rådene følger den almindelige vejledning fra
/// Fødevarestyrelsen — spørg jeres sundhedsplejerske hvis noget er i tvivl.</summary>
public static class RecipeLibrary
{
    private record Entry(
        string Title,
        int Servings,
        int Minutes,
        bool Vegetarian,
        [property: JsonPropertyName("ingredients")] string[] Ingredients,
        string Instructions,
        [property: JsonPropertyName("childNote")] string ChildNote);

    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public static int Count => Load().Length;

    private static Entry[] Load()
    {
        var assembly = Assembly.GetExecutingAssembly();
        var navn = assembly.GetManifestResourceNames()
            .FirstOrDefault(n => n.EndsWith("startbibliotek.json", StringComparison.Ordinal));
        if (navn is null) return [];

        using var stream = assembly.GetManifestResourceStream(navn)!;
        return JsonSerializer.Deserialize<Entry[]>(stream, Options) ?? [];
    }

    /// <summary>Lægger biblioteket i databasen. Springer retter over der allerede
    /// findes, så den kan køres igen uden at lave dubletter.</summary>
    public static async Task<int> SeedAsync(MadplanDbContext db, CancellationToken ct = default)
    {
        var entries = Load();
        if (entries.Length == 0) return 0;

        var household = await db.Households.OrderBy(h => h.Id).FirstAsync(ct);
        var units = await db.Units.ToListAsync(ct);
        var stkId = units.First(u => u.Abbreviation == "stk").Id;
        var resolver = new FoodResolver(db);

        var eksisterende = await db.Recipes.Select(r => r.Title).ToListAsync(ct);
        var tilføjet = 0;

        foreach (var e in entries)
        {
            if (eksisterende.Contains(e.Title)) continue;

            var recipe = new Recipe
            {
                HouseholdId = household.Id,
                Title = e.Title,
                Servings = e.Servings,
                TotalTimeMinutes = e.Minutes,
                // Noten til den mindste hører til i fremgangsmåden — det er dér
                // man læser den, mens man laver maden.
                Instructions = Barnenote.Tilfoej(e.Instructions, e.ChildNote),
                IsVegetarian = e.Vegetarian,
                IsChildFriendly = true,
                IsOwn = true,
                SourceName = "Startbibliotek",
                Attribution = "Skrevet til madplan-nemlig",
            };

            db.Recipes.Add(recipe);
            await db.SaveChangesAsync(ct);

            var order = 0;
            foreach (var raw in e.Ingredients)
            {
                var parsed = IngredientParser.Parse(raw);
                var unit = parsed.UnitAbbrev is null
                    ? null
                    : units.FirstOrDefault(u => u.Abbreviation == parsed.UnitAbbrev);

                Food? food = null;
                if (parsed.HasQuantity && parsed.FoodName.Length > 0)
                    food = await resolver.ResolveOrCreateAsync(parsed.FoodName, unit?.Id);

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
            tilføjet++;
        }

        return tilføjet;
    }
}
