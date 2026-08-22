using Madplan.Nemlig.Contracts;

namespace Madplan.Nemlig.Internal;

/// <summary>At være en høflig gæst, håndhævet ét sted. Alle kald i hele appen
/// deler dette ene vindue — der er ingen vej udenom, og ingen forretningskode
/// kan glemme det.</summary>
public sealed class RequestGate(NemligOptions options)
{
    private readonly SemaphoreSlim _gate = new(1, 1);
    private DateTimeOffset _lastRequest = DateTimeOffset.MinValue;

    private int _consecutiveFailures;
    private DateTimeOffset _openUntil = DateTimeOffset.MinValue;

    public async Task WaitTurnAsync(CancellationToken ct)
    {
        if (DateTimeOffset.UtcNow < _openUntil)
            throw new NemligUnavailableException(NemligFailure.RateLimited,
                $"Nemlig-integrationen holder pause indtil {_openUntil.LocalDateTime:HH:mm} " +
                "efter gentagne fejl. Madplanen virker stadig; priser er ukendte.");

        await _gate.WaitAsync(ct);
        try
        {
            var wait = TimeSpan.FromMilliseconds(options.MinMillisecondsBetweenRequests)
                       - (DateTimeOffset.UtcNow - _lastRequest);
            if (wait > TimeSpan.Zero) await Task.Delay(wait, ct);
            _lastRequest = DateTimeOffset.UtcNow;
        }
        finally { _gate.Release(); }
    }

    public void RecordSuccess() => Interlocked.Exchange(ref _consecutiveFailures, 0);

    public void RecordFailure()
    {
        if (Interlocked.Increment(ref _consecutiveFailures) >= options.CircuitBreakerThreshold)
        {
            _openUntil = DateTimeOffset.UtcNow + options.CircuitBreakerCooldown;
            Interlocked.Exchange(ref _consecutiveFailures, 0);
        }
    }

    public bool IsOpen => DateTimeOffset.UtcNow < _openUntil;
    public DateTimeOffset OpenUntil => _openUntil;
}
