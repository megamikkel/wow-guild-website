using System.Globalization;
using System.Text.Json.Nodes;
using AngleSharp.Dom;
using AngleSharp.Html.Parser;

namespace Madplan.Recipes;

/// <summary>Læser en schema.org-opskrift ud af HTML.
///
/// To lag, i denne rækkefølge:
///   1. JSON-LD  (madensverden.dk, sundpaabudget.dk og de fleste madblogs)
///   2. Microdata (valdemarsro.dk — vores primære kilde)
///
/// Lag 2 er ikke valgfrit. valdemarsros eneste ld+json-blok indeholder Article,
/// BreadcrumbList og Organization — men INGEN Recipe. En JSON-LD-only parser
/// ville fejle tavst på præcis den side vi helst vil have. Se
/// docs/opskriftskilder.md §0.
///
/// Klassen henter ikke selv HTML. Det gør <see cref="RecipeFetcher"/>, så
/// rate limiting og robots.txt ligger ét sted.</summary>
public class RecipeExtractor
{
    private readonly HtmlParser _parser = new();

    public async Task<ScrapedRecipe?> ExtractAsync(string html, string sourceUrl)
    {
        var doc = await _parser.ParseDocumentAsync(html);
        var host = Uri.TryCreate(sourceUrl, UriKind.Absolute, out var u) ? u.Host : "";
        var sourceName = host.StartsWith("www.") ? host[4..] : host;

        return FromJsonLd(doc, sourceUrl, sourceName)
            ?? FromMicrodata(doc, sourceUrl, sourceName);
    }

    // ---------- Lag 1: JSON-LD ----------

    private static ScrapedRecipe? FromJsonLd(IDocument doc, string sourceUrl, string sourceName)
    {
        foreach (var script in doc.QuerySelectorAll("script[type='application/ld+json']"))
        {
            JsonNode? root;
            try { root = JsonNode.Parse(script.TextContent); }
            catch { continue; }   // en enkelt ugyldig blok må ikke vælte siden

            var recipe = FindRecipeNode(root);
            if (recipe is null) continue;

            var ingredients = StringList(recipe["recipeIngredient"] ?? recipe["ingredients"]);
            if (ingredients.Count == 0) continue;

            return new ScrapedRecipe(
                Title: Text(recipe["name"]) ?? "",
                Ingredients: ingredients,
                Instructions: Instructions(recipe["recipeInstructions"]),
                Servings: ParseServings(recipe["recipeYield"]),
                TotalMinutes: ParseIsoDuration(Text(recipe["totalTime"]))
                              ?? ParseIsoDuration(Text(recipe["cookTime"])),
                ImageUrl: FirstImage(recipe["image"]),
                SourceUrl: sourceUrl,
                SourceName: sourceName,
                Author: Text(recipe["author"]?["name"]) ?? Text(recipe["author"]),
                Categories: StringList(recipe["recipeCategory"]));
        }

        return null;
    }

    /// <summary>schema.org-opskrifter gemmer sig i @graph, i arrays, og direkte.
    /// Alle tre former findes i naturen.</summary>
    private static JsonNode? FindRecipeNode(JsonNode? node)
    {
        switch (node)
        {
            case JsonArray arr:
                return arr.Select(FindRecipeNode).FirstOrDefault(n => n is not null);
            case JsonObject obj:
                if (IsRecipe(obj["@type"])) return obj;
                return FindRecipeNode(obj["@graph"]);
            default:
                return null;
        }
    }

    private static bool IsRecipe(JsonNode? type) => type switch
    {
        null => false,
        JsonArray arr => arr.Any(IsRecipe),
        _ => string.Equals(type.ToString(), "Recipe", StringComparison.OrdinalIgnoreCase),
    };

    // ---------- Lag 2: Microdata ----------

    private static ScrapedRecipe? FromMicrodata(IDocument doc, string sourceUrl, string sourceName)
    {
        var scope = doc.QuerySelectorAll("[itemtype]")
            .FirstOrDefault(e => (e.GetAttribute("itemtype") ?? "")
                .EndsWith("schema.org/Recipe", StringComparison.OrdinalIgnoreCase));
        if (scope is null) return null;

        var ingredients = Prop(scope, "recipeIngredient")
            .Concat(Prop(scope, "ingredients"))
            .Select(CleanText)
            .Where(s => s.Length > 0)
            .ToList();
        if (ingredients.Count == 0) return null;

        var instructions = Prop(scope, "recipeInstructions").Select(CleanText).ToList();

        return new ScrapedRecipe(
            Title: Prop(scope, "name").Select(CleanText).FirstOrDefault()
                   ?? CleanText(doc.QuerySelector("h1")?.TextContent ?? ""),
            Ingredients: ingredients,
            Instructions: instructions.Count > 0 ? string.Join("\n\n", instructions) : null,
            Servings: ParseServingsText(Prop(scope, "recipeYield").FirstOrDefault()),
            TotalMinutes: ParseIsoDuration(AttrOrText(scope, "totalTime")),
            ImageUrl: AttrOrText(scope, "image"),
            SourceUrl: sourceUrl,
            SourceName: sourceName,
            Author: Prop(scope, "author").Select(CleanText).FirstOrDefault(),
            Categories: [.. Prop(scope, "recipeCategory").Select(CleanText).Where(s => s.Length > 0)]);
    }

    private static IEnumerable<string> Prop(IElement scope, string name) =>
        scope.QuerySelectorAll($"[itemprop='{name}']")
             .Select(e => e.GetAttribute("content") ?? e.TextContent);

    private static string? AttrOrText(IElement scope, string name)
    {
        var e = scope.QuerySelector($"[itemprop='{name}']");
        if (e is null) return null;
        return e.GetAttribute("content")
            ?? e.GetAttribute("datetime")
            ?? e.GetAttribute("src")
            ?? e.GetAttribute("href")
            ?? CleanText(e.TextContent);
    }

    // ---------- Fælles ----------

    private static string CleanText(string s) =>
        string.Join(' ', s.Replace(' ', ' ').Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));

    private static string? Text(JsonNode? n) => n switch
    {
        null => null,
        JsonArray arr => Text(arr.FirstOrDefault()),
        JsonObject o => Text(o["name"]) ?? Text(o["@value"]),
        _ => CleanText(n.ToString()) is { Length: > 0 } s ? s : null,
    };

    private static List<string> StringList(JsonNode? n) => n switch
    {
        null => [],
        JsonArray arr => [.. arr.Select(Text).Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s!)],
        _ => Text(n) is { } s ? [s] : [],
    };

    private static string? Instructions(JsonNode? n)
    {
        if (n is null) return null;

        // Kan være én streng, en liste af strenge, eller HowToStep-objekter.
        var steps = n switch
        {
            JsonArray arr => arr.Select(step =>
                step is JsonObject o ? Text(o["text"]) ?? Text(o["name"]) : Text(step)).ToList(),
            _ => [Text(n)],
        };

        var text = string.Join("\n\n", steps.Where(s => !string.IsNullOrWhiteSpace(s)));
        return text.Length > 0 ? text : null;
    }

    private static string? FirstImage(JsonNode? n) => n switch
    {
        null => null,
        JsonArray arr => FirstImage(arr.FirstOrDefault()),
        JsonObject o => Text(o["url"]) ?? Text(o["contentUrl"]),
        _ => n.ToString(),
    };

    private static int? ParseServings(JsonNode? n) => ParseServingsText(Text(n));

    /// <summary>"4", "4 personer", "ca. 4-6 personer". Vi tager det første tal.</summary>
    internal static int? ParseServingsText(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        var digits = new string(s.SkipWhile(c => !char.IsDigit(c)).TakeWhile(char.IsDigit).ToArray());
        return int.TryParse(digits, out var v) && v is > 0 and < 100 ? v : null;
    }

    /// <summary>ISO 8601-varighed: PT45M, PT1H30M, PT2H.</summary>
    internal static int? ParseIsoDuration(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;

        // Et blot tal betyder MINUTTER. Bemærk fælden: TimeSpan.TryParse("45")
        // læser 45 som 45 DAGE og ville gøre en ret på tre kvarter til 64.800
        // minutter. Derfor tages heltalstilfældet først, og TimeSpan kun når
        // strengen faktisk ligner et klokkeslæt.
        if (int.TryParse(s, out var bare))
            return bare > 0 ? bare : null;

        if (s.Contains(':')
            && TimeSpan.TryParse(s, CultureInfo.InvariantCulture, out var plain)
            && plain > TimeSpan.Zero)
            return (int)plain.TotalMinutes;

        if (!s.StartsWith("PT", StringComparison.OrdinalIgnoreCase))
            return null;

        var body = s[2..].ToUpperInvariant();
        var minutes = 0;
        var number = "";

        foreach (var c in body)
        {
            if (char.IsDigit(c)) { number += c; continue; }
            if (!int.TryParse(number, out var v)) { number = ""; continue; }
            minutes += c switch { 'H' => v * 60, 'M' => v, _ => 0 };
            number = "";
        }

        return minutes > 0 ? minutes : null;
    }
}
