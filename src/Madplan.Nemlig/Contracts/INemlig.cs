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
    /// <param name="productUrl">Varens sti hos nemlig. Er den kendt, hentes
    /// detaljer direkte via GetAsJson — den dokumenterede vej. Uden den må vi
    /// falde tilbage på at søge, og en søgning på et varenummer er ikke en
    /// pålidelig måde at finde netop den vare.</param>
    /// <param name="forceRefresh">Forbigå cachen. Den daglige prisopdatering
    /// skal hente friske priser, ikke gårsdagens fra cachen.</param>
    Task<NemligProductDetail?> GetProductAsync(string productId, string? productUrl = null,
                                               bool forceRefresh = false, CancellationToken ct = default);
}

// Der er BEVIDST intet kurv-interface her.
//
// Appen skriver ikke til nemlig. Den læser priser og produkter, og producerer en
// indkøbsliste som et menneske handler efter. Det var oprindeligt tænkt som "fyld
// kurven, men bestil aldrig"; kravet blev siden strammet til slet ikke at røre
// kurven. Konsekvensen er at HELE nemlig-laget er læsende — der findes ikke et
// kald i denne løsning der ændrer noget som helst hos nemlig.
//
// NemligIsReadOnlyTests håndhæver det.

public enum NemligFailure { AuthFailed, RateLimited, SchemaChanged, Network, ProductNotFound, NotConfigured }

/// <summary>Én fejltype ud af hele laget. Resten af appen har præcis én ting at
/// forholde sig til, og degraderer i stedet for at gå ned.</summary>
public class NemligUnavailableException(NemligFailure reason, string message, Exception? inner = null)
    : Exception(message, inner)
{
    public NemligFailure Reason { get; } = reason;
}
