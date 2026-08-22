namespace Madplan.Nemlig.Contracts;

/// <summary>Auth. Den skrøbeligste flade: omskrevet mindst én gang siden 2019,
/// involverer nu Keycloak, XSRF og Cloudflare. Se docs/nemlig-api.md §6.</summary>
public interface INemligAuth
{
    Task<NemligSession> GetSessionAsync(CancellationToken ct = default);
    bool IsConfigured { get; }
}

/// <summary>Katalog: søgning og produktdetaljer. Den mest volatile flade — egen
/// vært, versioneret gateway, kontekstparametre vi ikke helt kender.
/// Går den ned, bliver priser ukendte og resten af appen kører videre.</summary>
public interface INemligCatalog
{
    Task<IReadOnlyList<NemligProduct>> SearchAsync(string query, int take = 10, CancellationToken ct = default);
    Task<NemligProductDetail?> GetProductAsync(string productId, CancellationToken ct = default);
}

/// <summary>Kurven. Den mest stabile flade: uændret sti og payload siden 2019.
///
/// Metoden hedder SetQuantity og ikke Add med vilje — nemligs AddToBasket tager
/// en ABSOLUT mængde, ikke et delta, og er idempotent. Et forkert navn her ville
/// invitere til præcis den fejl der fordobler ugens indkøb.</summary>
public interface INemligBasket
{
    Task<NemligBasket> GetAsync(CancellationToken ct = default);
    Task<NemligBasket> SetQuantityAsync(string productId, int quantity, CancellationToken ct = default);
}

// Bemærk hvad der IKKE er her: ingen PlaceOrder, ingen Checkout, ingen
// RegisterPayment. Krav 1 er ufravigeligt, og den robuste tolkning er at koden
// ikke kender adressen. Se docs/arkitektur.md §7 og CheckoutIsNotBuiltTests.

public enum NemligFailure { AuthFailed, RateLimited, SchemaChanged, Network, ProductNotFound, NotConfigured }

/// <summary>Én fejltype ud af hele laget. Resten af appen har præcis én ting at
/// forholde sig til, og degraderer i stedet for at gå ned.</summary>
public class NemligUnavailableException(NemligFailure reason, string message, Exception? inner = null)
    : Exception(message, inner)
{
    public NemligFailure Reason { get; } = reason;
}
