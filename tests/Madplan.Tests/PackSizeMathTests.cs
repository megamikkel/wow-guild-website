using Madplan.Core.Planning;

namespace Madplan.Tests;

public class PackSizeMathTests
{
    [Theory]
    [InlineData(300, 500, 1)]   // 300 g pasta → én pose á 500 g
    [InlineData(500, 500, 1)]   // præcis én
    [InlineData(501, 500, 2)]   // lige over → to
    [InlineData(1200, 500, 3)]  // 1,2 kg hakket oksekød → tre bakker
    public void Pakkeantal_rundes_op(double needed, double package, int expected)
        => Assert.Equal(expected, PackSizeMath.Compute(needed, package).PackCount);

    [Fact]
    public void Nul_behov_giver_nul_pakker()
        => Assert.Equal(0, PackSizeMath.Compute(0, 500).PackCount);

    [Fact]
    public void To_spsk_olie_mappet_til_liter_fanges_af_rimelighedstjekket()
    {
        // Den klassiske fejl: 30 ml olie mod en flaske på 1 liter.
        var r = PackSizeMath.Compute(30, 1000);
        Assert.Equal(1, r.PackCount);
        Assert.NotNull(r.Warning);
    }

    [Fact]
    public void Mange_pakker_udloeser_en_advarsel_om_enheden()
    {
        var r = PackSizeMath.Compute(3000, 100);
        Assert.Equal(30, r.PackCount);
        Assert.Contains("ser meget ud", r.Warning);
    }

    [Fact]
    public void Ukendt_pakkestoerrelse_gaetter_ikke_men_advarer()
    {
        var r = PackSizeMath.Compute(500, 0);
        Assert.Equal(1, r.PackCount);
        Assert.Contains("ukendt", r.Warning);
    }

    [Fact]
    public void Rimeligt_koeb_giver_ingen_advarsel()
        => Assert.Null(PackSizeMath.Compute(400, 500).Warning);
}
