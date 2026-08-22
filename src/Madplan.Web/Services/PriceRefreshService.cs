using Madplan.Core.Model;
using Madplan.Data;
using Madplan.Nemlig;
using Madplan.Nemlig.Contracts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Madplan.Web.Services;

/// <summary>Henter priser på de varer vi rent faktisk køber, én gang i døgnet.
///
/// Bemærk hvad den IKKE gør: den spejler ikke nemligs katalog. Der er titusindvis
/// af varer, og vi bruger nogle hundrede. At hente resten ville være tusindvis af
/// kald om dagen for data vi aldrig ser på — det ville gøre os til en crawler,
/// og krav 3 siger vi er én husstand. Vi henter det vi har mappet, og kun det.
///
/// Priserne gemmes som observationer i <see cref="ProductSnapshot"/> frem for at
/// overskrive. Det giver prishistorik gratis, og det betyder at indkøbslisten
/// kan vise gårsdagens pris når nemlig er nede i dag.</summary>
public class PriceRefreshService(
    IServiceScopeFactory scopes,
    IOptions<NemligOptions> options,
    ILogger<PriceRefreshService> log) : BackgroundService
{
    /// <summary>Kl. 04 lokal tid: nattaksterne er opdaterede, og ingen bruger appen.</summary>
    private static readonly TimeOnly RunAt = new(4, 0);

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        if (!options.Value.IsConfigured)
        {
            log.LogInformation("Prisopdatering springes over: nemlig er ikke konfigureret.");
            return;
        }

        // Kør én gang ved opstart, så en nystartet app ikke venter til i morgen.
        await SafeRefreshAsync("opstart", ct);

        while (!ct.IsCancellationRequested)
        {
            var wait = TimeUntilNextRun(DateTime.Now);
            log.LogInformation("Næste prisopdatering om {Hours:0.#} timer.", wait.TotalHours);

            try { await Task.Delay(wait, ct); }
            catch (OperationCanceledException) { return; }

            await SafeRefreshAsync("planlagt", ct);
        }
    }

    internal static TimeSpan TimeUntilNextRun(DateTime now)
    {
        var next = now.Date.Add(RunAt.ToTimeSpan());
        if (next <= now) next = next.AddDays(1);
        return next - now;
    }

    private async Task SafeRefreshAsync(string reason, CancellationToken ct)
    {
        try
        {
            var (checkedCount, changed) = await RefreshAsync(ct);
            log.LogInformation("Prisopdatering ({Reason}): {Checked} varer, {Changed} med ny pris.",
                reason, checkedCount, changed);
        }
        catch (NemligUnavailableException ex)
        {
            // Krav 4: en fejlet prisopdatering må ikke tage appen med sig.
            // Indkøbslisten viser bare den seneste kendte pris.
            log.LogWarning("Prisopdatering ({Reason}) fejlede: {Reason2}. Prøver igen i morgen.",
                reason, ex.Reason);
        }
        catch (Exception ex)
        {
            log.LogError(ex, "Uventet fejl under prisopdatering ({Reason}).", reason);
        }
    }

    /// <summary>Henter priser for alle mappede varer. Returnerer (tjekket, ændret).</summary>
    public async Task<(int Checked, int Changed)> RefreshAsync(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MadplanDbContext>();
        var catalog = scope.ServiceProvider.GetRequiredService<INemligCatalog>();

        var mappings = await db.ProductMappings
            .GroupBy(m => m.NemligProductId)
            .Select(g => new { Id = g.Key, Url = g.First().ProductUrl })
            .ToListAsync(ct);

        if (mappings.Count == 0) return (0, 0);

        var productIds = mappings.Select(m => m.Id).ToList();
        var urls = mappings.Where(m => m.Url is not null)
                           .ToDictionary(m => m.Id, m => m.Url!);

        // Seneste kendte pris pr. vare, så vi kan se hvad der faktisk ændrede sig.
        var seneste = await db.ProductSnapshots
            .GroupBy(s => s.NemligProductId)
            .Select(g => g.OrderByDescending(s => s.ObservedAt).First())
            .ToDictionaryAsync(s => s.NemligProductId, s => s.Price, ct);

        var changed = 0;
        var checkedCount = 0;

        foreach (var id in productIds)
        {
            ct.ThrowIfCancellationRequested();

            // forceRefresh: hele pointen med en daglig kørsel er friske priser.
            var detail = await catalog.GetProductAsync(id, urls.GetValueOrDefault(id), forceRefresh: true, ct);
            if (detail is null) continue;

            checkedCount++;
            var p = detail.Product;

            db.ProductSnapshots.Add(new ProductSnapshot
            {
                NemligProductId = id,
                Price = p.Price,
                UnitPrice = p.UnitPrice,
                UnitPriceLabel = p.UnitPriceLabel,
                InStock = p.InStock,
                Description = p.Description,
            });

            if (seneste.TryGetValue(id, out var foer) && foer != p.Price)
            {
                changed++;
                log.LogInformation("{Product}: {Before:N2} → {After:N2} kr.", p.Name, foer, p.Price);
            }
        }

        await db.SaveChangesAsync(ct);
        return (checkedCount, changed);
    }
}
