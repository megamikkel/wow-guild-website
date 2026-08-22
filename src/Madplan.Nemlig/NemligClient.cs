using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Madplan.Nemlig.Contracts;
using Madplan.Nemlig.Internal;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Madplan.Nemlig;

/// <summary>Den ENESTE klasse i løsningen der kender nemligs HTTP-flade.
///
/// Skemaerne stammer fra eisbaw/nemlig_cli's nemlig_api.md, krydstjekket mod
/// schourode/nemlig (2019) og hknielsen/nemlig-cli (C#, 2026). De er IKKE
/// live-verificeret — se docs/nemlig-api.md §7 for tjeklisten der skal køres.</summary>
public sealed class NemligClient : INemligAuth, INemligCatalog, INemligBasket
{
    private readonly HttpClient _http;
    private readonly NemligOptions _options;
    private readonly IMemoryCache _cache;
    private readonly ILogger<NemligClient> _log;
    private readonly RequestGate _gate;
    private readonly SemaphoreSlim _loginLock = new(1, 1);

    private NemligSession? _session;
    private PageContext? _context;

    public NemligClient(HttpClient http, IOptions<NemligOptions> options,
                        IMemoryCache cache, ILogger<NemligClient> log)
    {
        _options = options.Value;
        _http = http;
        _cache = cache;
        _log = log;
        _gate = new RequestGate(_options);

        _http.BaseAddress ??= new Uri(_options.BaseUrl);
        _http.Timeout = TimeSpan.FromSeconds(30);
    }

    public bool IsConfigured => _options.IsConfigured;

    /// <summary>Kontekstparametrene søge-gatewayen kræver. nemlig_cli henter dem
    /// med to ekstra HTTP-kald ved HVER søgning; vi cacher dem pr. session.</summary>
    private record PageContext(string Timestamp, string TimeslotUtc, int DeliveryZoneId, string? UserId);

    // ---------- Auth: 3 trin ----------

    public async Task<NemligSession> GetSessionAsync(CancellationToken ct = default)
    {
        if (!IsConfigured)
            throw new NemligUnavailableException(NemligFailure.NotConfigured,
                "NEMLIG_USERNAME og NEMLIG_PASSWORD er ikke sat. Se .env.example.");

        if (_session?.IsTokenFresh == true) return _session;

        await _loginLock.WaitAsync(ct);
        try
        {
            if (_session?.IsTokenFresh == true) return _session;
            _session = await LoginAsync(ct);
            return _session;
        }
        finally { _loginLock.Release(); }
    }

    private async Task<NemligSession> LoginAsync(CancellationToken ct)
    {
        // Trin 1: XSRF-token.
        var anti = await SendAsync(HttpMethod.Get, "/webapi/AntiForgery", null, null, ct);
        var xsrf = anti?["Value"]?.GetValue<string>()
            ?? throw new NemligUnavailableException(NemligFailure.SchemaChanged,
                "AntiForgery svarede uden feltet 'Value'.");

        // Trin 2: Bearer-token. Bemærk: dette trin kræver IKKE login, så
        // katalogopslag kan i princippet køre helt uden vores credentials.
        var token = await SendAsync(HttpMethod.Get, "/webapi/Token", null, null, ct);
        var bearer = token?["access_token"]?.GetValue<string>()
            ?? throw new NemligUnavailableException(NemligFailure.SchemaChanged,
                "Token svarede uden feltet 'access_token'.");
        var expiresIn = token["expires_in"]?.GetValue<int>() ?? 300;

        // Trin 3: login.
        var body = new
        {
            Username = _options.Username,
            Password = _options.Password,
            CheckForExistingProducts = true,
            DoMerge = true,
            AppInstalled = false,
            SaveExistingBasket = false,
        };
        var headers = new Dictionary<string, string>
        {
            ["X-XSRF-TOKEN"] = xsrf,
            ["Authorization"] = $"Bearer {bearer}",
            ["Referer"] = $"{_options.BaseUrl}/login?returnUrl=%2F",
        };
        await SendAsync(HttpMethod.Post, "/webapi/login", body, headers, ct);

        _log.LogInformation("Logget ind hos nemlig. Bearer-token udløber om {Seconds}s.", expiresIn);
        return new NemligSession(bearer, xsrf, DateTimeOffset.UtcNow.AddSeconds(expiresIn));
    }

    private async Task<PageContext> GetContextAsync(CancellationToken ct)
    {
        if (_context is not null) return _context;

        var session = await GetSessionAsync(ct);
        var auth = AuthHeaders(session);

        var settings = await SendAsync(HttpMethod.Get, "/webapi/v2/AppSettings/Website", null, auth, ct);
        var page = await SendAsync(HttpMethod.Get, "/?GetAsJson=1&d=1", null, auth, ct);

        var s = page?["Settings"];
        _context = new PageContext(
            settings?["CombinedProductsAndSitecoreTimestamp"]?.GetValue<string>() ?? "",
            s?["TimeslotUtc"]?.GetValue<string>() ?? UrlBuilder.ComputeTimeslot(DateTime.UtcNow),
            s?["DeliveryZoneId"]?.GetValue<int>() ?? 1,
            s?["UserId"]?.GetValue<string>());
        return _context;
    }

    private Dictionary<string, string> AuthHeaders(NemligSession s) => new()
    {
        ["Authorization"] = $"Bearer {s.BearerToken}",
        ["X-XSRF-TOKEN"] = s.XsrfToken,
    };

    // ---------- Katalog ----------

    public async Task<IReadOnlyList<NemligProduct>> SearchAsync(string query, int take = 10, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(query)) return [];

        var cacheKey = $"nemlig:search:{query.ToLowerInvariant()}:{take}";
        if (_cache.TryGetValue<IReadOnlyList<NemligProduct>>(cacheKey, out var hit) && hit is not null)
            return hit;

        var session = await GetSessionAsync(ct);
        var ctx = await GetContextAsync(ct);

        var url = $"{_options.SearchGatewayUrl}/search" +
                  $"?query={Uri.EscapeDataString(query)}&take={take}&skip=0&recipeCount=0" +
                  $"&timestamp={Uri.EscapeDataString(ctx.Timestamp)}" +
                  $"&timeslotUtc={Uri.EscapeDataString(ctx.TimeslotUtc)}" +
                  $"&deliveryZoneId={ctx.DeliveryZoneId}" +
                  (ctx.UserId is null ? "" : $"&includeFavorites={Uri.EscapeDataString(ctx.UserId)}");

        var json = await SendAsync(HttpMethod.Get, url, null, new Dictionary<string, string>
        {
            ["Authorization"] = $"Bearer {session.BearerToken}",
            ["Referer"] = $"{_options.BaseUrl}/",
        }, ct);

        var products = (json?["Products"]?["Products"] as JsonArray ?? [])
            .Select(MapProduct).Where(p => p is not null).Select(p => p!).ToList();

        _cache.Set(cacheKey, (IReadOnlyList<NemligProduct>)products, _options.PriceCacheDuration);
        return products;
    }

    public async Task<NemligProductDetail?> GetProductAsync(string productId, CancellationToken ct = default)
    {
        var cacheKey = $"nemlig:product:{productId}";
        if (_cache.TryGetValue<NemligProductDetail>(cacheKey, out var hit) && hit is not null) return hit;

        // Produktdetaljer hentes via GetAsJson på produktets egen URL. Vi kender
        // ikke sluggen, kun id'et — søgningen er den pålidelige vej dertil.
        var found = (await SearchAsync(productId, 5, ct)).FirstOrDefault(p => p.Id == productId);
        if (found is null) return null;

        var detail = new NemligProductDetail(found, [], new Dictionary<string, string>());
        _cache.Set(cacheKey, detail, _options.ProductCacheDuration);
        return detail;
    }

    private static NemligProduct? MapProduct(JsonNode? n)
    {
        if (n is null) return null;
        var id = n["Id"]?.GetValue<string>();
        if (string.IsNullOrEmpty(id)) return null;

        var availability = n["Availability"];
        return new NemligProduct(
            Id: id,
            Name: n["Name"]?.GetValue<string>() ?? "",
            Brand: n["Brand"]?.GetValue<string>(),
            Category: n["Category"]?.GetValue<string>(),
            SubCategory: n["SubCategory"]?.GetValue<string>(),
            Description: n["Description"]?.GetValue<string>(),
            Price: n["Price"]?.GetValue<decimal>() ?? 0m,
            UnitPrice: n["UnitPriceCalc"]?.GetValue<decimal>(),
            UnitPriceLabel: n["UnitPriceLabel"]?.GetValue<string>(),
            InStock: availability?["IsAvailableInStock"]?.GetValue<bool>() ?? true,
            DeliveryAvailable: availability?["IsDeliveryAvailable"]?.GetValue<bool>() ?? true,
            IsDiscounted: n["DiscountItem"]?.GetValue<bool>() ?? false,
            ImageUrl: n["PrimaryImage"]?.GetValue<string>());
    }

    // ---------- Kurv ----------

    public async Task<NemligBasket> GetAsync(CancellationToken ct = default)
    {
        var session = await GetSessionAsync(ct);
        var json = await SendAsync(HttpMethod.Get, "/webapi/basket/GetBasket", null, AuthHeaders(session), ct);
        return MapBasket(json);
    }

    /// <summary>Sætter den ABSOLUTTE mængde. 0 fjerner varen; der findes ikke et
    /// separat remove-endpoint. Kaldet er idempotent, hvilket er grunden til at
    /// kurv-synkronisering kan køres to gange uden at fordoble noget.</summary>
    public async Task<NemligBasket> SetQuantityAsync(string productId, int quantity, CancellationToken ct = default)
    {
        if (quantity < 0) throw new ArgumentOutOfRangeException(nameof(quantity));

        var session = await GetSessionAsync(ct);
        var body = new
        {
            ProductId = productId,
            quantity,
            AffectPartialQuantity = false,
            disableQuantityValidation = false,
        };
        var headers = AuthHeaders(session);
        headers["Referer"] = $"{_options.BaseUrl}/";

        var json = await SendAsync(HttpMethod.Post, "/webapi/basket/AddToBasket", body, headers, ct);
        return MapBasket(json);
    }

    internal static NemligBasket MapBasket(JsonNode? json)
    {
        var lines = (json?["Lines"] as JsonArray ?? [])
            .Select(l => new NemligBasketLine(
                ProductId: l?["Id"]?.GetValue<string>() ?? "",
                Name: l?["Name"]?.GetValue<string>() ?? "",
                Quantity: l?["Quantity"]?.GetValue<int>() ?? 0,
                ItemPrice: l?["ItemPrice"]?.GetValue<decimal>() ?? 0m,
                LinePrice: l?["Price"]?.GetValue<decimal>() ?? 0m))
            .Where(l => l.ProductId.Length > 0)
            .ToList();

        return new NemligBasket(json?["BasketGuid"]?.GetValue<string>(), lines);
    }

    // ---------- Transport ----------

    private async Task<JsonNode?> SendAsync(HttpMethod method, string url, object? body,
                                            Dictionary<string, string>? headers, CancellationToken ct)
    {
        await _gate.WaitTurnAsync(ct);

        using var req = new HttpRequestMessage(method, url);
        req.Headers.TryAddWithoutValidation("Accept", "application/json, text/plain, */*");
        req.Headers.TryAddWithoutValidation("User-Agent", _options.UserAgent);
        req.Headers.TryAddWithoutValidation("Device-Size", "desktop");
        req.Headers.TryAddWithoutValidation("Platform", "web");
        req.Headers.TryAddWithoutValidation("Version", _options.AppVersion);
        req.Headers.TryAddWithoutValidation("X-Correlation-Id", Guid.NewGuid().ToString());

        foreach (var (k, v) in headers ?? [])
            req.Headers.TryAddWithoutValidation(k, v);

        if (body is not null) req.Content = JsonContent.Create(body);

        HttpResponseMessage resp;
        try
        {
            resp = await _http.SendAsync(req, ct);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _gate.RecordFailure();
            throw new NemligUnavailableException(NemligFailure.Network,
                "Kunne ikke få forbindelse til nemlig.", ex);
        }

        using (resp)
        {
            if (!resp.IsSuccessStatusCode)
            {
                _gate.RecordFailure();
                throw resp.StatusCode switch
                {
                    HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden =>
                        new NemligUnavailableException(NemligFailure.AuthFailed,
                            "Nemlig afviste vores login. Tjek NEMLIG_USERNAME/NEMLIG_PASSWORD, " +
                            "og om der er kommet to-faktor på kontoen."),
                    HttpStatusCode.TooManyRequests =>
                        new NemligUnavailableException(NemligFailure.RateLimited,
                            "Nemlig bad os om at sætte farten ned."),
                    HttpStatusCode.NotFound =>
                        new NemligUnavailableException(NemligFailure.ProductNotFound,
                            $"Nemlig kender ikke {url}."),
                    _ => new NemligUnavailableException(NemligFailure.Network,
                            $"Nemlig svarede {(int)resp.StatusCode}."),
                };
            }

            _gate.RecordSuccess();

            var text = await resp.Content.ReadAsStringAsync(ct);
            if (string.IsNullOrWhiteSpace(text)) return null;

            try { return JsonNode.Parse(text); }
            catch (JsonException ex)
            {
                throw new NemligUnavailableException(NemligFailure.SchemaChanged,
                    "Nemlig svarede med noget der ikke er JSON. Skemaet er nok ændret.", ex);
            }
        }
    }
}
