using System.Diagnostics;
using Madplan.Nemlig;
using Madplan.Nemlig.Contracts;
using Madplan.Nemlig.Internal;

namespace Madplan.Tests;

/// <summary>Krav 3: vær en høflig gæst. Reglen skal være håndhævet ét sted, så
/// ingen forretningskode kan glemme den.</summary>
public class RequestGateTests
{
    [Fact]
    public async Task Kald_holdes_adskilt_af_det_konfigurerede_interval()
    {
        var gate = new RequestGate(new NemligOptions { MinMillisecondsBetweenRequests = 120 });
        var sw = Stopwatch.StartNew();

        for (var i = 0; i < 4; i++) await gate.WaitTurnAsync(default);

        // Tre ventetider mellem fire kald. Lidt slæk for planlæggeren.
        Assert.True(sw.ElapsedMilliseconds >= 300,
            $"Kaldene tog kun {sw.ElapsedMilliseconds} ms — rate limiteren slap dem for hurtigt igennem.");
    }

    [Fact]
    public async Task Samtidige_kald_deler_samme_vindue()
    {
        // Én global takt, ikke én pr. kaldsted.
        var gate = new RequestGate(new NemligOptions { MinMillisecondsBetweenRequests = 100 });
        var sw = Stopwatch.StartNew();

        await Task.WhenAll(Enumerable.Range(0, 4).Select(_ => gate.WaitTurnAsync(default)));

        Assert.True(sw.ElapsedMilliseconds >= 250,
            $"Fire parallelle kald tog {sw.ElapsedMilliseconds} ms — de omgik køen.");
    }

    [Fact]
    public async Task Tre_fejl_i_traek_aabner_afbryderen()
    {
        var gate = new RequestGate(new NemligOptions
        {
            MinMillisecondsBetweenRequests = 0,
            CircuitBreakerThreshold = 3,
            CircuitBreakerCooldown = TimeSpan.FromMinutes(5),
        });

        gate.RecordFailure();
        gate.RecordFailure();
        Assert.False(gate.IsOpen);

        gate.RecordFailure();
        Assert.True(gate.IsOpen);

        var ex = await Assert.ThrowsAsync<NemligUnavailableException>(() => gate.WaitTurnAsync(default));
        Assert.Equal(NemligFailure.RateLimited, ex.Reason);
        Assert.Contains("Madplanen virker stadig", ex.Message);
    }

    [Fact]
    public void En_succes_nulstiller_taelleren()
    {
        var gate = new RequestGate(new NemligOptions
        {
            MinMillisecondsBetweenRequests = 0, CircuitBreakerThreshold = 3,
        });

        gate.RecordFailure();
        gate.RecordFailure();
        gate.RecordSuccess();   // enkeltstående fejl skal ikke akkumulere
        gate.RecordFailure();
        gate.RecordFailure();

        Assert.False(gate.IsOpen);
    }
}

/// <summary>Krav 4: appen skal kunne bruges til madplanlægning når nemlig er nede.</summary>
public class OfflineNemligTests
{
    [Fact]
    public void Rapporterer_aerligt_at_den_ikke_er_konfigureret()
        => Assert.False(new OfflineNemlig().IsConfigured);

    [Fact]
    public async Task Soegning_giver_tomt_frem_for_at_vaelte_siden()
    {
        // Et tomt forslagsfelt er en rimelig ting at vise i mapping-UI'et.
        Assert.Empty(await new OfflineNemlig().SearchAsync("oksekød"));
        Assert.Null(await new OfflineNemlig().GetProductAsync("111"));
    }

    [Fact]
    public async Task Session_forklarer_hvorfor_der_ikke_er_nogen_priser()
    {
        var ex = await Assert.ThrowsAsync<NemligUnavailableException>(
            () => new OfflineNemlig().GetSessionAsync());

        Assert.Equal(NemligFailure.NotConfigured, ex.Reason);
        Assert.Contains("NEMLIG_USERNAME", ex.Message);
    }
}
