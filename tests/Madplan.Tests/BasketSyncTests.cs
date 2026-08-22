using Madplan.Core.Model;
using Madplan.Data;
using Madplan.Nemlig.Contracts;
using Madplan.Web.Services;
using Microsoft.EntityFrameworkCore;

namespace Madplan.Tests;

/// <summary>En kurv i hukommelsen der opfører sig som nemligs: SetQuantity er
/// ABSOLUT og idempotent, og 0 fjerner linjen.</summary>
file sealed class FakeBasket : INemligBasket
{
    private readonly Dictionary<string, (string Name, int Qty)> _lines = [];
    public List<(string ProductId, int Quantity)> Calls { get; } = [];

    public FakeBasket(params (string Id, string Name, int Qty)[] initial)
    {
        foreach (var (id, name, qty) in initial) _lines[id] = (name, qty);
    }

    public Task<NemligBasket> GetAsync(CancellationToken ct = default) =>
        Task.FromResult(new NemligBasket("fake", [.. _lines.Select(kv =>
            new NemligBasketLine(kv.Key, kv.Value.Name, kv.Value.Qty, 10m, 10m * kv.Value.Qty))]));

    public Task<NemligBasket> SetQuantityAsync(string productId, int quantity, CancellationToken ct = default)
    {
        Calls.Add((productId, quantity));
        if (quantity == 0) _lines.Remove(productId);
        else _lines[productId] = (_lines.TryGetValue(productId, out var e) ? e.Name : productId, quantity);
        return GetAsync(ct);
    }
}

public class BasketSyncTests : IDisposable
{
    private readonly MadplanDbContext _db;

    public BasketSyncTests()
    {
        _db = new MadplanDbContext(new DbContextOptionsBuilder<MadplanDbContext>()
            .UseSqlite($"Data Source=file:sync{Guid.NewGuid():N}?mode=memory&cache=shared").Options);
        _db.Database.OpenConnection();
        _db.Database.EnsureCreated();
    }

    public void Dispose() { _db.Database.CloseConnection(); _db.Dispose(); GC.SuppressFinalize(this); }

    private static ShoppingList Liste(params (string ProductId, string Name, int Packs)[] items)
    {
        var list = new ShoppingList { Id = 1 };
        var id = 1;
        foreach (var (productId, name, packs) in items)
            list.Lines.Add(new ShoppingListLine
            {
                Status = LineStatus.Ok,
                PackCount = packs,
                ProductMappingId = id,
                ProductMapping = new ProductMapping
                {
                    Id = id++, NemligProductId = productId, ProductName = name,
                },
            });
        return list;
    }

    [Fact]
    public async Task Tom_kurv_giver_praecis_de_varer_listen_beder_om()
    {
        var basket = new FakeBasket();
        var sync = new BasketSyncService(basket, _db);
        var list = Liste(("111", "Pasta", 1), ("222", "Oksekød", 3));

        var preview = await sync.PreviewAsync(list);
        Assert.Equal(2, preview.Actionable.Count);

        await sync.ApplyAsync(list, preview, userId: null);
        Assert.Equal([("111", 1), ("222", 3)], [.. basket.Calls.OrderBy(c => c.ProductId)]);
    }

    [Fact]
    public async Task Anden_koersel_aendrer_intet()
    {
        // Kernen i at gøre knappen sikker: kurv-sync er en synkronisering, ikke
        // en tilføjelse. Trykker man to gange, fordobles indkøbet ikke.
        var basket = new FakeBasket();
        var sync = new BasketSyncService(basket, _db);
        var list = Liste(("111", "Pasta", 2));

        await sync.ApplyAsync(list, await sync.PreviewAsync(list), null);
        var efterFoerste = basket.Calls.Count;

        var anden = await sync.PreviewAsync(list);
        Assert.False(anden.HasChanges);

        await sync.ApplyAsync(list, anden, null);
        Assert.Equal(efterFoerste, basket.Calls.Count); // ingen nye kald
    }

    [Fact]
    public async Task Eksisterende_maengde_rettes_til_den_rigtige_ikke_lagt_oveni()
    {
        var basket = new FakeBasket(("111", "Pasta", 1));
        var sync = new BasketSyncService(basket, _db);
        var list = Liste(("111", "Pasta", 3));

        var preview = await sync.PreviewAsync(list);
        await sync.ApplyAsync(list, preview, null);

        // 3, ikke 4. Mængden er absolut.
        Assert.Equal(("111", 3), Assert.Single(basket.Calls));
    }

    [Fact]
    public async Task Varer_de_selv_har_lagt_i_kurven_roeres_ikke()
    {
        // Kurven kan indeholde vaskepulver og vin. Det er ikke vores at rydde op i.
        var basket = new FakeBasket(("999", "Vaskepulver", 1));
        var sync = new BasketSyncService(basket, _db);
        var list = Liste(("111", "Pasta", 1));

        var preview = await sync.PreviewAsync(list);
        await sync.ApplyAsync(list, preview, null);

        Assert.DoesNotContain(basket.Calls, c => c.ProductId == "999");
    }

    [Fact]
    public async Task Forhaandsvisning_sender_ingenting()
    {
        var basket = new FakeBasket();
        var sync = new BasketSyncService(basket, _db);

        var preview = await sync.PreviewAsync(Liste(("111", "Pasta", 1)));

        Assert.True(preview.HasChanges);
        Assert.Empty(basket.Calls); // intet er sendt før brugeren har set det
    }

    [Fact]
    public async Task Linjer_uden_mapping_kommer_aldrig_i_kurven()
    {
        var basket = new FakeBasket();
        var sync = new BasketSyncService(basket, _db);

        var list = new ShoppingList { Id = 1 };
        list.Lines.Add(new ShoppingListLine { Status = LineStatus.ManglerMapping, PackCount = 0 });

        var preview = await sync.PreviewAsync(list);
        Assert.False(preview.HasChanges);
    }

    [Fact]
    public async Task Synkronisering_efterlader_et_spor()
    {
        var sync = new BasketSyncService(new FakeBasket(), _db);
        var list = Liste(("111", "Pasta", 2));

        var log = await sync.ApplyAsync(list, await sync.PreviewAsync(list), userId: 7);

        Assert.Equal("Ok", log.Outcome);
        Assert.Equal(1, log.LinesPosted);
        Assert.Equal(7, log.UserId);
        Assert.Single(await _db.BasketSyncLogs.ToListAsync());
    }

    [Fact]
    public async Task En_vare_der_fejler_stopper_ikke_resten()
    {
        var sync = new BasketSyncService(new FejlendeKurv(failOn: "222"), _db);
        var list = Liste(("111", "Pasta", 1), ("222", "Oksekød", 1), ("333", "Mælk", 1));

        var log = await sync.ApplyAsync(list, await sync.PreviewAsync(list), null);

        Assert.Equal("Delvist", log.Outcome);
        Assert.Equal(2, log.LinesPosted);
        Assert.Contains("Oksekød", log.Details);
    }

    private sealed class FejlendeKurv(string failOn) : INemligBasket
    {
        public Task<NemligBasket> GetAsync(CancellationToken ct = default) =>
            Task.FromResult(new NemligBasket("x", []));

        public Task<NemligBasket> SetQuantityAsync(string productId, int quantity, CancellationToken ct = default)
            => productId == failOn
                ? throw new NemligUnavailableException(NemligFailure.ProductNotFound, "Varen findes ikke.")
                : GetAsync(ct);
    }
}
