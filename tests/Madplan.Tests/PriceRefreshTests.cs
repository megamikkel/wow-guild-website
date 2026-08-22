using Madplan.Web.Services;

namespace Madplan.Tests;

/// <summary>Planlægningen af den daglige prisopdatering. Selve hentningen er
/// dækket af NemligContractTests og ProductSuggesterTests; her handler det om
/// at den rammer det rigtige tidspunkt og ikke sover et døgn for meget.</summary>
public class PriceRefreshTests
{
    [Fact]
    public void Foer_klokken_fire_ventes_der_til_i_dag()
    {
        var wait = PriceRefreshService.TimeUntilNextRun(new DateTime(2026, 8, 22, 1, 0, 0));
        Assert.Equal(TimeSpan.FromHours(3), wait);
    }

    [Fact]
    public void Efter_klokken_fire_ventes_der_til_i_morgen()
    {
        var wait = PriceRefreshService.TimeUntilNextRun(new DateTime(2026, 8, 22, 10, 0, 0));
        Assert.Equal(TimeSpan.FromHours(18), wait);
    }

    [Fact]
    public void Praecis_klokken_fire_venter_et_helt_doegn_frem_for_at_koere_to_gange()
    {
        var wait = PriceRefreshService.TimeUntilNextRun(new DateTime(2026, 8, 22, 4, 0, 0));
        Assert.Equal(TimeSpan.FromHours(24), wait);
    }

    [Fact]
    public void Ventetiden_er_aldrig_negativ_eller_over_et_doegn()
    {
        for (var h = 0; h < 24; h++)
            for (var m = 0; m < 60; m += 7)
            {
                var wait = PriceRefreshService.TimeUntilNextRun(new DateTime(2026, 8, 22, h, m, 0));
                Assert.InRange(wait, TimeSpan.Zero, TimeSpan.FromHours(24));
            }
    }
}
