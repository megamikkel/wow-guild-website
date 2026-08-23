using System.Collections.Concurrent;

namespace Madplan.Recipes;

/// <summary>Henter HTML fra opskriftssider. Samme høflighedsregler som over for
/// nemlig: én forespørgsel ad gangen pr. vært, robots.txt læses først, og der
/// caches så en genimport ikke koster et nyt kald.
///
/// recipe-scrapers omgår bevidst ikke bot-beskyttelse, og det gør vi heller
/// ikke. Bliver vi afvist, er svaret at lade være — ikke at forklæde os.</summary>
public class RecipeFetcher(HttpClient http, RecipeExtractor extractor)
{
    /// <summary>Ét sekund mellem kald til samme vært. En familie der importerer
    /// tredive opskrifter er ikke en crawler, men den skal heller ikke opføre
    /// sig som en.</summary>
    public TimeSpan MinDelayPerHost { get; set; } = TimeSpan.FromSeconds(1);

    private readonly ConcurrentDictionary<string, DateTimeOffset> _lastRequest = new();
    private readonly ConcurrentDictionary<string, RobotsRules> _robots = new();
    private readonly SemaphoreSlim _gate = new(1, 1);

    public record FetchResult(string Url, ScrapedRecipe? Recipe, string? Error)
    {
        public bool Ok => Recipe is not null;
    }

    public async Task<FetchResult> FetchAsync(string url, CancellationToken ct = default)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            return new FetchResult(url, null, "Ikke en gyldig http(s)-adresse.");

        try
        {
            var robots = await GetRobotsAsync(uri, ct);
            if (!robots.IsAllowed(uri.AbsolutePath))
                return new FetchResult(url, null,
                    "robots.txt beder os lade være med at hente denne side.");

            var html = await GetStringAsync(uri, ct);
            var recipe = await extractor.ExtractAsync(html, url);

            return recipe is null
                ? new FetchResult(url, null, "Fandt ingen opskriftsdata på siden.")
                : recipe.LooksUsable
                    ? new FetchResult(url, recipe, null)
                    : new FetchResult(url, null, "Opskriften manglede titel eller ingredienser.");
        }
        catch (HttpRequestException ex)
        {
            return new FetchResult(url, null, $"Kunne ikke hente siden: {ex.StatusCode?.ToString() ?? ex.Message}");
        }
        catch (TaskCanceledException)
        {
            return new FetchResult(url, null, "Siden svarede ikke i tide.");
        }
    }

    /// <summary>Finder alle opskriftslinks på en oversigtsside. Henter ikke
    /// opskrifterne — det er et separat skridt, så man kan se hvad man går i
    /// gang med, før tredive kald sættes i sving.</summary>
    public async Task<(IReadOnlyList<string> Links, string? Error)> FindLinksAsync(
        string pageUrl, CancellationToken ct = default)
    {
        if (!Uri.TryCreate(pageUrl, UriKind.Absolute, out var uri))
            return ([], "Ikke en gyldig adresse.");

        try
        {
            var robots = await GetRobotsAsync(uri, ct);
            if (!robots.IsAllowed(uri.AbsolutePath))
                return ([], "robots.txt beder os lade være med at hente denne side.");

            var html = await GetStringAsync(uri, ct);
            var links = await new RecipeLinkFinder().FindAsync(html, pageUrl);

            return links.Count == 0
                ? ([], "Fandt ingen opskriftslinks på siden.")
                : (links, null);
        }
        catch (HttpRequestException ex)
        {
            return ([], $"Kunne ikke hente siden: {ex.StatusCode?.ToString() ?? ex.Message}");
        }
        catch (TaskCanceledException)
        {
            return ([], "Siden svarede ikke i tide.");
        }
    }

    /// <summary>Henter mange sider efter hinanden. Sekventielt med vilje —
    /// parallel import ville være hurtigere og en dårlig måde at behandle
    /// en gratis kilde på.</summary>
    public async Task<IReadOnlyList<FetchResult>> FetchManyAsync(
        IEnumerable<string> urls, IProgress<FetchResult>? progress = null, CancellationToken ct = default)
    {
        var results = new List<FetchResult>();
        foreach (var url in urls.Select(u => u.Trim()).Where(u => u.Length > 0).Distinct())
        {
            ct.ThrowIfCancellationRequested();
            var result = await FetchAsync(url, ct);
            results.Add(result);
            progress?.Report(result);
        }
        return results;
    }

    private async Task<string> GetStringAsync(Uri uri, CancellationToken ct)
    {
        await WaitTurnAsync(uri.Host, ct);
        using var req = new HttpRequestMessage(HttpMethod.Get, uri);
        req.Headers.TryAddWithoutValidation("Accept", "text/html,application/xhtml+xml");
        req.Headers.TryAddWithoutValidation("Accept-Language", "da-DK,da;q=0.9");
        using var resp = await http.SendAsync(req, ct);
        resp.EnsureSuccessStatusCode();
        return await resp.Content.ReadAsStringAsync(ct);
    }

    private async Task WaitTurnAsync(string host, CancellationToken ct)
    {
        await _gate.WaitAsync(ct);
        try
        {
            if (_lastRequest.TryGetValue(host, out var last))
            {
                var wait = MinDelayPerHost - (DateTimeOffset.UtcNow - last);
                if (wait > TimeSpan.Zero) await Task.Delay(wait, ct);
            }
            _lastRequest[host] = DateTimeOffset.UtcNow;
        }
        finally { _gate.Release(); }
    }

    private async Task<RobotsRules> GetRobotsAsync(Uri uri, CancellationToken ct)
    {
        if (_robots.TryGetValue(uri.Host, out var cached)) return cached;

        RobotsRules rules;
        try
        {
            await WaitTurnAsync(uri.Host, ct);
            var text = await http.GetStringAsync(new Uri(uri, "/robots.txt"), ct);
            rules = RobotsRules.Parse(text);
        }
        catch
        {
            // Ingen robots.txt, eller den kunne ikke hentes. Standarden siger at
            // fravær betyder "alt er tilladt"; vi lader den fortolkning stå.
            rules = RobotsRules.AllowAll;
        }

        _robots[uri.Host] = rules;
        return rules;
    }
}

/// <summary>En bevidst minimal robots.txt-læser: kun Disallow-stier for `*`.
/// Den forstår ikke Allow-undtagelser eller wildcards, og fortolker derfor
/// strengere end nødvendigt. Det er den rigtige vej at fejle.</summary>
public sealed class RobotsRules
{
    private readonly List<string> _disallowed;

    private RobotsRules(List<string> disallowed) => _disallowed = disallowed;

    public static RobotsRules AllowAll { get; } = new([]);

    public static RobotsRules Parse(string text)
    {
        var disallowed = new List<string>();
        var inWildcardGroup = false;

        foreach (var raw in text.Split('\n'))
        {
            var line = raw.Split('#')[0].Trim();
            if (line.Length == 0) continue;

            var colon = line.IndexOf(':');
            if (colon < 0) continue;

            var key = line[..colon].Trim().ToLowerInvariant();
            var value = line[(colon + 1)..].Trim();

            if (key == "user-agent") inWildcardGroup = value == "*";
            else if (key == "disallow" && inWildcardGroup && value.Length > 0) disallowed.Add(value);
        }

        return new RobotsRules(disallowed);
    }

    public bool IsAllowed(string path) =>
        !_disallowed.Any(d => path.StartsWith(d.TrimEnd('*'), StringComparison.OrdinalIgnoreCase));
}
