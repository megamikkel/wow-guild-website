using Madplan.Nemlig.Contracts;

namespace Madplan.Nemlig;

/// <summary>Bruges når der ikke er sat credentials. Appen skal kunne bruges til
/// madplanlægning uden nemlig — prisen bliver bare ukendt (krav 4). At have en
/// eksplicit implementering frem for null-checks spredt ud i UI'et betyder at
/// den tilstand er testet frem for underforstået.</summary>
public sealed class OfflineNemlig : INemligAuth, INemligCatalog, INemligBasket
{
    public bool IsConfigured => false;

    private static NemligUnavailableException NotConfigured() =>
        new(NemligFailure.NotConfigured,
            "Nemlig-integrationen er ikke konfigureret. Madplan, opskrifter og " +
            "indkøbsliste virker; priser og kurv gør ikke. Sæt NEMLIG_USERNAME og " +
            "NEMLIG_PASSWORD — se .env.example.");

    public Task<NemligSession> GetSessionAsync(CancellationToken ct = default) => throw NotConfigured();

    // Søgning returnerer tomt frem for at kaste: en tom forslagsliste er en
    // rimelig ting at vise i mapping-UI'et, og den vælter ikke siden.
    public Task<IReadOnlyList<NemligProduct>> SearchAsync(string query, int take = 10, CancellationToken ct = default)
        => Task.FromResult<IReadOnlyList<NemligProduct>>([]);

    public Task<NemligProductDetail?> GetProductAsync(string productId, CancellationToken ct = default)
        => Task.FromResult<NemligProductDetail?>(null);

    // Kurven kaster derimod. Trykker nogen på knappen, skal de få at vide hvorfor
    // der ikke skete noget.
    public Task<NemligBasket> GetAsync(CancellationToken ct = default) => throw NotConfigured();
    public Task<NemligBasket> SetQuantityAsync(string productId, int quantity, CancellationToken ct = default)
        => throw NotConfigured();
}
