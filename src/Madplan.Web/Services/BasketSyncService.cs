using Madplan.Core.Model;
using Madplan.Data;
using Madplan.Nemlig.Contracts;

namespace Madplan.Web.Services;

/// <summary>Fylder nemlig-kurven ud fra en indkøbsliste.
///
/// Det er en SYNKRONISERING, ikke en serie tilføjelser: vi læser den nuværende
/// kurv, regner diffen ud, og poster absolutte mængder. Kør den to gange og
/// resultatet er det samme. Det er muligt fordi nemligs AddToBasket tager en
/// absolut mængde og er idempotent — se docs/nemlig-api.md §2.3.
///
/// Klassen gennemfører ALDRIG et køb. Det sidste klik sker hos nemlig, af et
/// menneske. Se docs/arkitektur.md §7.</summary>
public class BasketSyncService(INemligBasket basket, MadplanDbContext db)
{
    public record PlannedChange(string ProductId, string Name, int CurrentQuantity, int TargetQuantity)
    {
        public int Delta => TargetQuantity - CurrentQuantity;
        public bool IsNoOp => Delta == 0;
        public string Description => CurrentQuantity switch
        {
            0 => $"Læg {TargetQuantity} × {Name} i kurven",
            _ when TargetQuantity == 0 => $"Fjern {Name} fra kurven",
            _ => $"Ret {Name} fra {CurrentQuantity} til {TargetQuantity}",
        };
    }

    public record Preview(IReadOnlyList<PlannedChange> Changes, decimal CurrentBasketTotal)
    {
        public IReadOnlyList<PlannedChange> Actionable => [.. Changes.Where(c => !c.IsNoOp)];
        public bool HasChanges => Actionable.Count > 0;
    }

    /// <summary>Regner ud hvad der VILLE ske. Intet sendes. Brugeren ser dette
    /// før noget som helst rører kurven.</summary>
    public async Task<Preview> PreviewAsync(ShoppingList list, CancellationToken ct = default)
    {
        var current = await basket.GetAsync(ct);
        var currentByProduct = current.Lines.ToDictionary(l => l.ProductId, l => l.Quantity);

        var wanted = list.Lines
            .Where(l => l.Included && l.ProductMapping is not null && l.PackCount > 0)
            .GroupBy(l => l.ProductMapping!.NemligProductId)
            .ToDictionary(
                g => g.Key,
                g => (Name: g.First().ProductMapping!.ProductName, Qty: g.Sum(x => x.PackCount)));

        var changes = new List<PlannedChange>();

        foreach (var (productId, want) in wanted)
        {
            currentByProduct.TryGetValue(productId, out var have);
            changes.Add(new PlannedChange(productId, want.Name, have, want.Qty));
        }

        // Bemærk: vi fjerner IKKE varer der ligger i kurven men ikke på listen.
        // Kurven kan indeholde ting de har lagt i selv — vaskepulver, vin — og
        // det er ikke vores at rydde op i.

        return new Preview(changes, current.Total);
    }

    /// <summary>Udfører de planlagte ændringer. Hver ændring er ét idempotent kald,
    /// så en halvt gennemført synkronisering kan bare køres igen.</summary>
    public async Task<BasketSyncLog> ApplyAsync(ShoppingList list, Preview preview, int? userId,
                                                CancellationToken ct = default)
    {
        var applied = 0;
        var failures = new List<string>();

        foreach (var change in preview.Actionable)
        {
            try
            {
                await basket.SetQuantityAsync(change.ProductId, change.TargetQuantity, ct);
                applied++;
            }
            catch (NemligUnavailableException ex)
            {
                failures.Add($"{change.Name}: {ex.Message}");
            }
        }

        var log = new BasketSyncLog
        {
            ShoppingListId = list.Id,
            UserId = userId,
            LinesPosted = applied,
            Outcome = failures.Count == 0 ? "Ok" : "Delvist",
            Details = failures.Count == 0
                ? string.Join("; ", preview.Actionable.Select(c => $"{c.ProductId}={c.TargetQuantity}"))
                : string.Join(" | ", failures),
        };

        db.BasketSyncLogs.Add(log);
        await db.SaveChangesAsync(ct);
        return log;
    }
}
