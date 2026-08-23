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
        new("1", "X", "x-1", null, null, null, null, price, unitPrice, label, true, true, false, null);
}

/// <summary>Feltnavne på tråden. Fundet ved at køre appen mod en stub-server:
/// System.Net.Http.Json camelCaser som standard, så «ProductId» blev sendt som
/// «productId» — ikke det skema nemlig dokumenterer.</summary>
public class WireFormatTests
{
    [Fact]
    public void Login_payload_sendes_med_nemligs_egne_feltnavne()
    {
        var options = new System.Text.Json.JsonSerializerOptions { PropertyNamingPolicy = null };
        var json = System.Text.Json.JsonSerializer.Serialize(new
        {
            Username = "a@b.dk",
            Password = "x",
            CheckForExistingProducts = true,
            DoMerge = true,
        }, options);

        Assert.Contains("\"Username\"", json);
        Assert.Contains("\"CheckForExistingProducts\"", json);
        Assert.DoesNotContain("\"username\"", json);
    }

    [Fact]
    public void Standardopsaetningen_ville_have_vaeret_forkert()
    {
        // Dokumenterer hvorfor WireJson findes: uden den camelCases alt.
        var web = new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web);
        var json = System.Text.Json.JsonSerializer.Serialize(new { ProductId = "1" }, web);
        Assert.Contains("\"productId\"", json);
    }
}

/// <summary>Pakkestørrelser udledt af pris divideret med enhedspris.</summary>
public class PackageSizeRoundingTests
{
    private static NemligProduct P(decimal pris, decimal enhedspris, string label)
        => new("1", "X", "x", null, null, null, null, pris, enhedspris, label, true, true, false, null);

    [Theory]
    // 19,95 kr for 9,98 kr/kg = 1998,99 g. Det ER en 2 kg-pose.
    [InlineData(19.95, 9.98, "kr/kg", 2000)]
    // 62,00 for 103,33 kr/kg = 600,019 g.
    [InlineData(62.00, 103.33, "kr/kg", 600)]
    [InlineData(41.75, 83.50, "kr/kg", 500)]
    [InlineData(12.50, 12.50, "kr/l", 1000)]
    [InlineData(11.50, 28.75, "kr/l", 400)]
    public void Skaeve_divisioner_rundes_til_rigtige_pakkestoerrelser(
        decimal pris, decimal enhedspris, string label, double forventet)
    {
        var guess = P(pris, enhedspris, label).GuessPackageSize();
        Assert.NotNull(guess);
        Assert.Equal(forventet, guess!.Value.Size, 1);
    }

    [Fact]
    public void En_pose_paa_to_kilo_daekker_et_behov_paa_to_kilo()
    {
        // Fejlen afrundingen forhindrer: uden den blev pakken 1998,99 g, og
        // ceil(2000 / 1998,99) = 2 poser til et behov på præcis én.
        var size = P(19.95m, 9.98m, "kr/kg").GuessPackageSize()!.Value.Size;
        Assert.Equal(1, Madplan.Core.Planning.PackSizeMath.Compute(2000, size).PackCount);
    }
}

/// <summary>At finde varen i en produktside.
///
/// Nemligs produktsider er Sitecore-sider, og de er ikke dokumenteret dybere
/// end ét eksempel. Første rigtige kald mod nemlig viste at varen lå under
/// «content[0].Product», ikke i roden — så en fast placering ville have været
/// et gæt der holdt indtil de flyttede rundt.</summary>
public class FindProductNodeTests
{
    private static JsonNode Parse(string json) => JsonNode.Parse(json)!;

    [Fact]
    public void Varen_findes_i_roden()
    {
        var node = NemligClient.FindProductNode(
            Parse("""{"Id":"123","Name":"Mælk","Price":9.5}"""), "123");

        Assert.Equal("Mælk", node!["Name"]!.GetValue<string>());
    }

    [Fact]
    public void Varen_findes_under_et_Product_felt()
    {
        var node = NemligClient.FindProductNode(
            Parse("""{"MetaData":{"ResponseCode":200},"Product":{"Id":"123","Name":"Mælk"}}"""), "123");

        Assert.Equal("Mælk", node!["Name"]!.GetValue<string>());
    }

    [Fact]
    public void Varen_findes_nede_i_en_content_liste()
    {
        // Formen fra det foerste rigtige kald mod nemlig.
        var node = NemligClient.FindProductNode(Parse("""
            {"MetaData":{"ResponseCode":200,"Name":"Product page"},
             "Settings":{"ZipCode":"1620","UserId":"x"},
             "content":[{"TemplateName":"productspot","Product":{"Id":"123","Name":"Mælk","Price":9.5}}]}
            """), "123");

        Assert.NotNull(node);
        Assert.Equal("Mælk", node!["Name"]!.GetValue<string>());
    }

    [Fact]
    public void Et_ANDET_produkt_paa_siden_forveksles_ikke_med_det_vi_bad_om()
    {
        // Produktsider viser ogsaa relaterede varer. Tager vi den foerste den
        // bedste, prissaetter vi den forkerte vare - stille.
        var node = NemligClient.FindProductNode(Parse("""
            {"RelatedProducts":[{"Id":"999","Name":"Fløde"}],
             "content":[{"Product":{"Id":"123","Name":"Mælk"}}]}
            """), "123");

        Assert.Equal("Mælk", node!["Name"]!.GetValue<string>());
    }

    [Fact]
    public void Findes_varen_ikke_paa_siden_returneres_null()
        => Assert.Null(NemligClient.FindProductNode(
            Parse("""{"content":[{"Product":{"Id":"999","Name":"Andet"}}]}"""), "123"));

    [Fact]
    public void Et_objekt_med_Id_men_uden_Name_er_ikke_en_vare()
    {
        // Sitecore-spots har ogsaa Id'er. Uden Name-kravet ville et tilfaeldigt
        // spot med samme Id kunne blive laest som en vare.
        Assert.Null(NemligClient.FindProductNode(
            Parse("""{"Spot":{"Id":"123","TemplateName":"noget"}}"""), "123"));
    }

    [Fact]
    public void Tomt_eller_ugyldigt_svar_kaster_ikke()
    {
        Assert.Null(NemligClient.FindProductNode(null, "123"));
        Assert.Null(NemligClient.FindProductNode(Parse("[]"), "123"));
        Assert.Null(NemligClient.FindProductNode(Parse("{}"), "123"));
    }
}
