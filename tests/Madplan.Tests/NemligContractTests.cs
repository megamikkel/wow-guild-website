using System.Text.Json.Nodes;
using Madplan.Nemlig;
using Madplan.Nemlig.Contracts;

namespace Madplan.Tests;

/// <summary>Kontrakttests mod gemte, anonymiserede svar fra nemlig.
///
/// De beviser ikke at nemligs API ser sådan ud i dag — det kan kun en live-session
/// (docs/nemlig-api.md §7). De beviser at VORES mapping matcher de skemaer vi har
/// dokumenteret, og de er stedet man opdaterer den dag nemlig ændrer sig.</summary>
public class NemligContractTests
{
    private static JsonNode Load(string name) =>
        JsonNode.Parse(File.ReadAllText(Path.Combine("Fixtures", name)))!;

    [Fact]
    public void Kurvsvar_mappes_til_vores_type()
    {
        var basket = NemligClient.MapBasket(Load("basket.json"));

        Assert.Equal("e34fc914-0000-0000-0000-000000000000", basket.BasketGuid);
        Assert.Equal(2, basket.Lines.Count);

        var koed = basket.Lines.First(l => l.ProductId == "5070417");
        Assert.Equal("Hakket oksekød 8-12%", koed.Name);
        Assert.Equal(2, koed.Quantity);
        Assert.Equal(41.75m, koed.ItemPrice);
        Assert.Equal(83.50m, koed.LinePrice);
        Assert.Equal(133.45m, basket.Total);
    }

    [Fact]
    public void Tom_kurv_giver_ingen_linjer_og_kaster_ikke()
    {
        var basket = NemligClient.MapBasket(JsonNode.Parse("""{"BasketGuid":"x","Lines":[]}"""));
        Assert.Empty(basket.Lines);
        Assert.Equal(0m, basket.Total);
    }

    [Fact]
    public void Manglende_felter_faar_os_ikke_til_at_kaste()
    {
        // Nemlig kan fjerne et felt uden varsel. Vi skal degradere, ikke vælte.
        var basket = NemligClient.MapBasket(JsonNode.Parse("""{"Lines":[{"Id":"1","Name":"X"}]}"""));
        var line = Assert.Single(basket.Lines);
        Assert.Equal(0, line.Quantity);
        Assert.Equal(0m, line.LinePrice);
    }

    [Theory]
    // Pris / enhedspris giver pakkestørrelsen. 41,75 / 83,50 kr/kg = 0,5 kg = 500 g.
    [InlineData(41.75, 83.50, "kr/kg", 500, "g")]
    [InlineData(12.00, 12.00, "kr/l", 1000, "ml")]
    [InlineData(23.75, 23.75, "kr/stk", 1, "stk")]
    public void Pakkestoerrelse_udledes_af_pris_og_enhedspris(
        decimal price, decimal unitPrice, string label, double size, string unit)
    {
        var p = Produkt(price, unitPrice, label);
        var guess = p.GuessPackageSize();

        Assert.NotNull(guess);
        Assert.Equal(size, guess!.Value.Size, 1);
        Assert.Equal(unit, guess.Value.Unit);
    }

    [Fact]
    public void Ukendt_enhedspris_giver_intet_gaet_frem_for_et_daarligt()
    {
        Assert.Null(Produkt(41.75m, null, "kr/kg").GuessPackageSize());
        Assert.Null(Produkt(41.75m, 83.50m, null).GuessPackageSize());
        Assert.Null(Produkt(41.75m, 83.50m, "kr/pakke").GuessPackageSize());
    }

    [Fact]
    public void Token_fixturen_har_de_felter_auth_flowet_laeser()
    {
        var token = Load("token.json");
        Assert.False(string.IsNullOrEmpty(token["access_token"]?.GetValue<string>()));
        Assert.Equal(300, token["expires_in"]!.GetValue<int>());
    }

    [Fact]
    public void Session_regnes_for_udloebet_i_god_tid_foer_den_faktisk_er_det()
    {
        // 300 sekunders levetid med 30 sekunders margen: et kald der starter
        // lige før udløb skal ikke nå at fejle undervejs.
        var fresh = new NemligSession("t", "x", DateTimeOffset.UtcNow.AddSeconds(300));
        var expiring = new NemligSession("t", "x", DateTimeOffset.UtcNow.AddSeconds(20));
        var expired = new NemligSession("t", "x", DateTimeOffset.UtcNow.AddSeconds(-1));

        Assert.True(fresh.IsTokenFresh);
        Assert.False(expiring.IsTokenFresh);
        Assert.False(expired.IsTokenFresh);
    }

    private static NemligProduct Produkt(decimal price, decimal? unitPrice, string? label) =>
        new("1", "X", null, null, null, null, price, unitPrice, label, true, true, false, null);
}
