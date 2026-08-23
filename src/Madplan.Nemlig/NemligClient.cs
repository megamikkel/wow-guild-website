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
/// Læsende. Det eneste POST-kald er login; alt andet er GET. Appen ændrer ikke
/// noget hos nemlig — hverken kurv, ordre eller kontooplysninger.
///
/// Skemaerne stammer fra eisbaw/nemlig_cli's nemlig_api.md, krydstjekket mod
/// schourode/nemlig (2019) og hknielsen/nemlig-cli (C#, 2026). De er IKKE
/// live-verificeret — se docs/nemlig-api.md §7 for tjeklisten der skal køres.</summary>
public sealed class NemligClient : INemligAuth, INemligCatalog, INemligRecipes
{
    private readonly HttpClient _http;
    private readonly NemligOptions _options;
    private readonly IMemoryCache _cache;
    private readonly ILogger<NemligClient> _log;
    private readonly RequestGate _gate;
    private readonly SemaphoreSlim _loginLock = new(1, 1);

    private NemligSession? _session;
    private PageContext? _context;

    /// <summary>Feltnavne sendes ORDRET som dokumenteret. System.Net.Http.Json
    /// bruger som standard JsonSerializerDefaults.Web, der camelCaser alt — så
    /// «ProductId» ville gå på tråden som «productId». ASP.NET binder ganske vist
    /// case-insensitivt, så det ville formentlig virke; men «formentlig» er ikke
    /// godt nok for det kald der fylder kurven, og det koster os intet at ramme
    /// skemaet præcist.</summary>
    private static readonly JsonSerializerOptions WireJson = new()
    {
        PropertyNamingPolicy = null,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.Never,
    };

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
        var xsrf = Str(Prop(anti, "Value"))
            ?? throw new NemligUnavailableException(NemligFailure.SchemaChanged,
                "AntiForgery svarede uden feltet 'Value'.");

        // Trin 2: Bearer-token. Bemærk: dette trin kræver IKKE login, så
        // katalogopslag kan i princippet køre helt uden vores credentials.
        var token = await SendAsync(HttpMethod.Get, "/webapi/Token", null, null, ct);
        var bearer = Str(Prop(token, "access_token"))
            ?? throw new NemligUnavailableException(NemligFailure.SchemaChanged,
                "Token svarede uden feltet 'access_token'.");
        var expiresIn = (int?)Dec(Prop(token, "expires_in")) ?? 300;

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

        var s = Prop(page, "Settings");
        _context = new PageContext(
            Str(Prop(settings, "CombinedProductsAndSitecoreTimestamp")) ?? "",
            Str(Prop(s, "TimeslotUtc")) ?? UrlBuilder.ComputeTimeslot(DateTime.UtcNow),
            (int?)Dec(Prop(s, "DeliveryZoneId")) ?? 1,
            Str(Prop(s, "UserId")));
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

        var products = (Prop(Prop(json, "Products"), "Products") as JsonArray ?? [])
            .Select(MapProduct).Where(p => p is not null).Select(p => p!).ToList();

        _cache.Set(cacheKey, (IReadOnlyList<NemligProduct>)products, _options.PriceCacheDuration);
        return products;
    }

    public async Task<NemligProductDetail?> GetProductAsync(
        string productId, string? productUrl = null, bool forceRefresh = false, CancellationToken ct = default)
    {
        var cacheKey = $"nemlig:product:{productId}";
        if (!forceRefresh && _cache.TryGetValue<NemligProductDetail>(cacheKey, out var hit) && hit is not null)
            return hit;

        var detail = productUrl is { Length: > 0 }
            ? await GetProductByUrlAsync(productId, productUrl, ct)
            : await FindProductBySearchAsync(productId, ct);

        if (detail is not null) _cache.Set(cacheKey, detail, _options.PriceCacheDuration);
        return detail;
    }

    /// <summary>Henter en produktsides rå JSON. Kun til diagnose: når mapningen
    /// fejler, er det formen på svaret man har brug for at se, og nemligs sider
    /// er ikke dokumenteret dybere end ét eksempel.</summary>
    internal async Task<JsonNode?> FetchProductPageAsync(string productUrl, CancellationToken ct = default)
    {
        var session = await GetSessionAsync(ct);
        var ctx = await GetContextAsync(ct);
        var path = productUrl.StartsWith('/') ? productUrl : "/" + productUrl;

        return await SendAsync(HttpMethod.Get,
            $"{path}?GetAsJson=1&t={Uri.EscapeDataString(ctx.TimeslotUtc)}&d=1",
            null, AuthHeaders(session), ct);
    }

    /// <summary>Den dokumenterede vej til produktdetaljer: GetAsJson på varens
    /// egen sti. Det er også den eneste pålidelige — se fallbacken nedenfor.</summary>
    private async Task<NemligProductDetail?> GetProductByUrlAsync(string productId, string url, CancellationToken ct)
    {
        var session = await GetSessionAsync(ct);
        var ctx = await GetContextAsync(ct);
        var path = url.StartsWith('/') ? url : "/" + url;

        var json = await SendAsync(HttpMethod.Get,
            $"{path}?GetAsJson=1&t={Uri.EscapeDataString(ctx.TimeslotUtc)}&d=1",
            null, AuthHeaders(session), ct);

        // Vi LEDER efter varen frem for at gætte hvor den ligger.
        //
        // Nemligs produktsider er Sitecore-sider: varen kan ligge i roden, under
        // «Product», eller nede i en «content»-liste af spots. Da siden ikke er
        // dokumenteret dybere end ét eksempel, ville enhver fast placering være
        // et gæt der holder indtil de flytter rundt. At søge efter objektet med
        // det rigtige Id koster ingenting og holder uanset opbygning.
        var node = FindProductNode(json, productId, url);
        if (node is null) return null;

        var product = MapProduct(node);
        if (product is null) return null;

        var alternatives = (Prop(node, "AlternativeProducts") as JsonArray ?? [])
            .Select(MapProduct).Where(p => p is not null).Select(p => p!).ToList();

        var attributes = new Dictionary<string, string>();
        foreach (var a in Prop(node, "Attributes") as JsonArray ?? [])
        {
            var key = Str(Prop(a, "Name")) ?? Str(Prop(a, "Key"));
            var value = Str(Prop(a, "Value"));
            if (key is not null && value is not null) attributes[key] = value;
        }

        return new NemligProductDetail(product, alternatives, attributes);
    }

    /// <summary>Fallback når vi ikke kender varens sti. Bemærk at en søgning på
    /// et varenummer IKKE er en pålidelig måde at finde netop den vare — nemligs
    /// søgning er lavet til produktnavne. Derfor gemmer vi stien på mapningen,
    /// og denne vej bruges kun til gamle rækker der mangler den.</summary>
    private async Task<NemligProductDetail?> FindProductBySearchAsync(string productId, CancellationToken ct)
    {
        var found = (await SearchAsync(productId, 5, ct)).FirstOrDefault(p => p.Id == productId);
        return found is null ? null : new NemligProductDetail(found, [], new Dictionary<string, string>());
    }

    /// <summary>Finder objektet i svaret der beskriver netop denne vare.
    ///
    /// Tre kendetegn, fordi ét ikke er nok: nemlig bruger «Id» forskelligt alt
    /// efter kontekst — på en Sitecore-side kan det være sidens eget id, mens
    /// varenummeret står i «VkNumber». Og URL'en kender vi allerede, fordi det
    /// var den vi bad om. Alle tre kræver desuden et «Name», så et Sitecore-spot
    /// med et tilfældigt sammenfaldende id ikke bliver læst som en vare.
    ///
    /// Bredde-først, så en relateret vare langt nede på siden ikke forveksles
    /// med den vi bad om.</summary>
    internal static JsonNode? FindProductNode(JsonNode? root, string productId, string? productUrl = null)
    {
        if (root is null) return null;

        var ønsketSti = Normalise(productUrl);

        var kø = new Queue<JsonNode>();
        kø.Enqueue(root);
        var besøgte = 0;

        while (kø.Count > 0 && besøgte++ < 5000)
        {
            var node = kø.Dequeue();

            switch (node)
            {
                case JsonObject obj:
                    if (obj.ContainsKey("Name") && Matcher(obj, productId, ønsketSti)) return obj;

                    foreach (var (_, value) in obj)
                        if (value is not null) kø.Enqueue(value);
                    break;

                case JsonArray arr:
                    foreach (var item in arr)
                        if (item is not null) kø.Enqueue(item);
                    break;
            }
        }

        return null;
    }

    private static bool Matcher(JsonObject obj, string productId, string? ønsketSti)
    {
        if (Text(obj, "Id") == productId) return true;
        if (Text(obj, "VkNumber") == productId) return true;

        return ønsketSti is not null && Normalise(Text(obj, "Url")) == ønsketSti;
    }

    private static string? Text(JsonObject obj, string key) =>
        obj.TryGetPropertyValue(key, out var v) ? v?.ToString() : null;

    private static string? Normalise(string? url) =>
        string.IsNullOrWhiteSpace(url) ? null : url.Trim('/').ToLowerInvariant();

    // ---------- Sikker læsning af nemligs JSON ----------
    //
    // GetValue<T>() KASTER hvis feltet ikke er den type man forventer. Nemligs
    // søgesvar og produktsider bruger ikke samme form for de samme felter — et
    // rigtigt kald mod nemlig væltede her med «The node must be of type
    // JsonValue» — og de kan ændre en streng til et objekt uden varsel.
    //
    // Vi læser derfor tolerant: forkert form giver null, ikke en exception.
    // En manglende pris er noget appen kan vise som «ukendt»; et nedbrud er det ikke.

    /// <summary>Læser et felt uden at antage at noden er et objekt.
    ///
    /// Selve indekseringen «node["Felt"]» kaster hvis noden er en værdi eller en
    /// liste — så et felt der uventet er en streng vælter opslaget FØR vi når at
    /// læse tolerant. Det er samme fælde som GetValue, bare et lag tidligere.</summary>
    private static JsonNode? Prop(JsonNode? n, string key) =>
        n is JsonObject o && o.TryGetPropertyValue(key, out var v) ? v : null;

    private static string? Str(JsonNode? n) => n switch
    {
        JsonValue v => v.ToString(),
        null => null,
        // Et objekt kan bære teksten i et underfelt — det gør nemlig fx for brands.
        JsonObject o => Str(Prop(o, "Name")) ?? Str(Prop(o, "Value")),
        _ => null,
    };

    private static decimal? Dec(JsonNode? n) =>
        n is JsonValue v && decimal.TryParse(v.ToString(),
            System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture, out var d) ? d : null;

    private static bool? Bool(JsonNode? n) => n switch
    {
        JsonValue v when bool.TryParse(v.ToString(), out var b) => b,
        JsonValue v when v.ToString() is "1" => true,
        JsonValue v when v.ToString() is "0" => false,
        _ => null,
    };

    private static NemligProduct? MapProduct(JsonNode? n)
    {
        if (n is null) return null;

        var id = Str(Prop(n, "Id")) ?? Str(Prop(n, "VkNumber"));
        if (string.IsNullOrEmpty(id)) return null;

        var availability = Prop(n, "Availability");
        return new NemligProduct(
            Id: id,
            Name: Str(Prop(n, "Name")) ?? "",
            Url: Str(Prop(n, "Url")),
            Brand: Str(Prop(n, "Brand")),
            Category: Str(Prop(n, "Category")),
            SubCategory: Str(Prop(n, "SubCategory")),
            Description: Str(Prop(n, "Description")),
            Price: Dec(Prop(n, "Price")) ?? Dec(Prop(n, "UnitPrice")) ?? 0m,
            UnitPrice: Dec(Prop(n, "UnitPriceCalc")),
            UnitPriceLabel: Str(Prop(n, "UnitPriceLabel")),
            InStock: Bool(Prop(availability, "IsAvailableInStock")) ?? true,
            DeliveryAvailable: Bool(Prop(availability, "IsDeliveryAvailable")) ?? true,
            IsDiscounted: Bool(Prop(n, "DiscountItem")) ?? false,
            ImageUrl: Str(Prop(n, "PrimaryImage")));
    }

    // ---------- Nemligs opskrifter ----------

    public async Task<IReadOnlyList<NemligRecipe>> SearchRecipesAsync(
        string query, int take = 20, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(query)) return [];

        var session = await GetSessionAsync(ct);
        var ctx = await GetContextAsync(ct);

        // Samme gateway som produktsøgningen, men vi beder om opskrifter i
        // stedet: recipeCount styrer hvor mange der kommer med.
        var url = $"{_options.SearchGatewayUrl}/search" +
                  $"?query={Uri.EscapeDataString(query)}&take=1&skip=0&recipeCount={take}" +
                  $"&timestamp={Uri.EscapeDataString(ctx.Timestamp)}" +
                  $"&timeslotUtc={Uri.EscapeDataString(ctx.TimeslotUtc)}" +
                  $"&deliveryZoneId={ctx.DeliveryZoneId}";

        var json = await SendAsync(HttpMethod.Get, url, null, new Dictionary<string, string>
        {
            ["Authorization"] = $"Bearer {session.BearerToken}",
            ["Referer"] = $"{_options.BaseUrl}/",
        }, ct);

        return [.. (Prop(json, "Recipes") as JsonArray ?? [])
            .Select(MapRecipeIndex).Where(r => r is not null).Select(r => r!)];
    }

    private static NemligRecipe? MapRecipeIndex(JsonNode? n)
    {
        var id = Str(Prop(n, "Id"));
        if (string.IsNullOrEmpty(id)) return null;

        return new NemligRecipe(
            Id: id,
            Name: Str(Prop(n, "Name")) ?? "",
            Url: Str(Prop(n, "Url")),
            Servings: (int?)Dec(Prop(n, "NumberOfPersons")),
            TotalTime: Str(Prop(n, "TotalTime")),
            Lines: [],
            Instructions: null);
    }

    public async Task<NemligRecipe?> GetRecipeAsync(string recipeUrl, CancellationToken ct = default)
    {
        var session = await GetSessionAsync(ct);
        var ctx = await GetContextAsync(ct);
        var path = recipeUrl.StartsWith('/') ? recipeUrl : "/" + recipeUrl;

        var json = await SendAsync(HttpMethod.Get,
            $"{path}?GetAsJson=1&t={Uri.EscapeDataString(ctx.TimeslotUtc)}&d=1",
            null, AuthHeaders(session), ct);
        if (json is null) return null;

        // Vi LEDER efter opskriften i stedet for at gætte hvor den ligger —
        // samme lære som produktsiderne gav os. Kendetegnet er et objekt med
        // et navn og en ingrediensliste.
        var node = FindRecipeNode(json);
        if (node is null) return null;

        var linjer = LæsIngredienser(node);

        return new NemligRecipe(
            Id: Str(Prop(node, "Id")) ?? recipeUrl,
            Name: Str(Prop(node, "Name")) ?? Str(Prop(node, "Title")) ?? "",
            Url: recipeUrl,
            Servings: (int?)Dec(Prop(node, "NumberOfPersons")) ?? (int?)Dec(Prop(node, "Persons")),
            TotalTime: Str(Prop(node, "TotalTime")),
            Lines: linjer,
            Instructions: Str(Prop(node, "Description")) ?? Str(Prop(node, "Text")));
    }

    /// <summary>Finder opskriften i en Sitecore-side: et objekt der både har et
    /// navn og noget der ligner en ingrediensliste.</summary>
    internal static JsonObject? FindRecipeNode(JsonNode? root)
    {
        if (root is null) return null;

        var kø = new Queue<JsonNode>();
        kø.Enqueue(root);
        var besøgte = 0;

        while (kø.Count > 0 && besøgte++ < 5000)
        {
            var node = kø.Dequeue();
            switch (node)
            {
                case JsonObject obj:
                    var harNavn = obj.ContainsKey("Name") || obj.ContainsKey("Title");
                    var harIngredienser = IngrediensListe(obj) is not null;
                    if (harNavn && harIngredienser) return obj;

                    foreach (var (_, v) in obj) if (v is not null) kø.Enqueue(v);
                    break;

                case JsonArray arr:
                    foreach (var item in arr) if (item is not null) kø.Enqueue(item);
                    break;
            }
        }

        return null;
    }

    /// <summary>Nemlig kan kalde listen flere ting. Vi accepterer dem alle frem
    /// for at binde os til ét navn vi ikke har set bekræftet.</summary>
    private static JsonArray? IngrediensListe(JsonObject obj)
    {
        foreach (var navn in new[] { "Ingredients", "IngredientLines", "RecipeIngredients", "Lines" })
            if (Prop(obj, navn) is JsonArray a && a.Count > 0) return a;
        return null;
    }

    /// <summary>Læser ingredienslinjerne i kildens rækkefølge. Tekst og varenummer
    /// holdes sammen på hver linje; en linje uden varenummer bliver en linje med
    /// null, ikke en linje der forsvinder. Ellers ville de efterfølgende linjer
    /// rykke op og arve hinandens varer.</summary>
    internal static IReadOnlyList<NemligRecipeLine> LæsIngredienser(JsonObject node)
    {
        var linjer = new List<NemligRecipeLine>();

        foreach (var linje in IngrediensListe(node) ?? [])
        {
            if (linje is JsonValue)
            {
                var raa = linje.ToString();
                if (!string.IsNullOrWhiteSpace(raa)) linjer.Add(new NemligRecipeLine(raa, null));
                continue;
            }

            if (linje is not JsonObject o) continue;

            var beskrivelse = Str(Prop(o, "Text")) ?? Str(Prop(o, "Description"))
                           ?? Str(Prop(o, "Name")) ?? Str(Prop(o, "Title"));
            if (string.IsNullOrWhiteSpace(beskrivelse)) continue;

            // Det er DEN HER linje hele hypotesen handler om.
            var varenummer = Str(Prop(o, "ProductId")) ?? Str(Prop(o, "Id"))
                          ?? Str(Prop(o, "VkNumber"));

            // Adressen er guld værd: med den hentes varen ad den dokumenterede
            // vej i stedet for ved at søge på sit eget varenummer.
            var adresse = Str(Prop(o, "Url")) ?? Str(Prop(o, "ProductUrl"));

            linjer.Add(new NemligRecipeLine(
                beskrivelse,
                string.IsNullOrWhiteSpace(varenummer) ? null : varenummer,
                string.IsNullOrWhiteSpace(adresse) ? null : adresse));
        }

        return linjer;
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

        if (body is not null) req.Content = JsonContent.Create(body, options: WireJson);

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
