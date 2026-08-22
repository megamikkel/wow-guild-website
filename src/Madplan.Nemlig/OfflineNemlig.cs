using Madplan.Nemlig.Contracts;

namespace Madplan.Nemlig;

/// <summary>Bruges når der ikke er sat credentials. Appen skal kunne bruges til
/// madplanlægning uden nemlig — priserne bliver bare ukendte (krav 4). At have en
/// eksplicit implementering frem for null-checks spredt ud i UI'et betyder at
/// den tilstand er testet frem for underforstået.</summary>
public sealed class OfflineNemlig : INemligAuth, INemligCatalog
{
    public bool IsConfigured => false;

    public Task<NemligSession> GetSessionAsync(CancellationToken ct = default) =>
        throw new NemligUnavailableException(NemligFailure.NotConfigured,
            "Nemlig-integrationen er ikke konfigureret. Madplan, opskrifter og " +
            "indkøbsliste virker; priser gør ikke. Sæt NEMLIG_USERNAME og " +
            "NEMLIG_PASSWORD — se .env.example.");

    // Tomt frem for at kaste: en indkøbsliste uden priser er stadig en brugbar
    // indkøbsliste, og en tom forslagsliste vælter ikke en side.
    public Task<IReadOnlyList<NemligProduct>> SearchAsync(string query, int take = 10, CancellationToken ct = default)
        => Task.FromResult<IReadOnlyList<NemligProduct>>([]);

    public Task<NemligProductDetail?> GetProductAsync(string productId, string? productUrl = null,
                                                      bool forceRefresh = false, CancellationToken ct = default)
        => Task.FromResult<NemligProductDetail?>(null);
}
