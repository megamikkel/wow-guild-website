using Madplan.Core.Model;
using Madplan.Core.Parsing;
using Madplan.Nemlig.Contracts;

namespace Madplan.Web.Services;

/// <summary>Foreslår nemlig-varer til en råvare der endnu ikke er mappet.
///
/// Fuzzy matching bruges ALDRIG til at vælge — kun til at rangere de forslag et
/// menneske ser. Det er forskellen på et system man kan stole på og et man skal
/// kontrollere hver uge.</summary>
public class ProductSuggester(INemligCatalog catalog)
{
    public record Suggestion(NemligProduct Product, double Score, string? Reason);

    public async Task<IReadOnlyList<Suggestion>> SuggestAsync(
        Food food, IReadOnlyCollection<string> previouslyOrderedIds, CancellationToken ct = default)
    {
        var query = FoodNormalizer.ToSearchQuery(food.CanonicalName);
        if (query.Length == 0) return [];

        var products = await catalog.SearchAsync(query, take: 12, ct);
        if (products.Count == 0) return [];

        var wanted = Tokenise(food.CanonicalName);

        return [.. products
            .Select(p => Score(p, wanted, food, previouslyOrderedIds))
            .OrderByDescending(s => s.Score)
            .Take(5)];
    }

    private static Suggestion Score(NemligProduct p, HashSet<string> wanted, Food food,
                                    IReadOnlyCollection<string> previouslyOrdered)
    {
        double score = 0;
        string? reason = null;

        // 1. Købt før slår alt. Adfærd er en bedre kilde end strenglighed.
        if (previouslyOrdered.Contains(p.Id))
        {
            score += 100;
            reason = "Købt før";
        }

        // 2. Token-set-lighed, ikke Levenshtein: "oksekød, hakket 8-12%" skal
        //    matche "hakket oksekød" på trods af ordstillingen.
        var have = Tokenise($"{p.Name} {p.Brand}");
        var overlap = wanted.Count == 0 ? 0 : (double)wanted.Count(have.Contains) / wanted.Count;
        score += overlap * 50;

        // 2b. Dansk sætter ord sammen. «letmælk» og «kokosmælk» deler ikke ét
        //     helt ord med «mælk», så begge ville score 0, og et vilkårligt
        //     kriterium ville afgøre valget. Delvist match vægter lavere end
        //     et helt ord — så «Løg» stadig slår «Hvidløg» — men nok til at
        //     bringe kandidaterne på niveau, hvor enhedsprisen kan afgøre.
        var partial = wanted.Count == 0 ? 0 : (double)wanted
            .Count(w => !have.Contains(w) && have.Any(h => h.Contains(w, StringComparison.Ordinal)))
            / wanted.Count;
        score += partial * 15;

        // 3. Kategorien passer. Fanger at "smør" ikke er "smørbart pålæg".
        if (food.AisleLabel is not null && p.Category is not null &&
            p.Category.Contains(food.AisleLabel, StringComparison.OrdinalIgnoreCase))
            score += 10;

        // 4. På lager. Udsolgte nedprioriteres, men skjules ikke.
        if (!p.InStock) score -= 25;

        // 5. Billigst pr. enhed ved ellers lige kandidater.
        if (p.UnitPrice is > 0) score += Math.Max(0, 5 - (double)p.UnitPrice.Value / 20);

        // 6. Straf lange brandede navne. "Änglamark Økologisk Hakket Oksekød
        //    8-12% 400g" er ofte rigtigt, men det korte navn er oftere det man mener.
        // Straffen skal nudge, ikke afgøre. Var den større, kunne et brandnavn
        //     alene vælte et ellers korrekt match.
        var extraWords = Math.Max(0, have.Count - wanted.Count);
        score -= extraWords * 0.75;

        if (reason is null && !p.InStock) reason = "Udsolgt";
        else if (reason is null && p.IsDiscounted) reason = "På tilbud";

        return new Suggestion(p, score, reason);
    }

    private static HashSet<string> Tokenise(string s) =>
        [.. FoodNormalizer.Normalize(s).Split(' ', StringSplitOptions.RemoveEmptyEntries)];
}
