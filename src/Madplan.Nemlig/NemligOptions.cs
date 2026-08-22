namespace Madplan.Nemlig;

public class NemligOptions
{
    public const string SectionName = "Nemlig";

    /// <summary>Læses fra miljøvariabler. Aldrig fra kode, aldrig fra git.</summary>
    public string? Username { get; set; }
    public string? Password { get; set; }

    public string BaseUrl { get; set; } = "https://www.nemlig.com";
    public string SearchGatewayUrl { get; set; } = "https://webapi.prod.knl.nemlig.it/searchgateway/api";

    /// <summary>Webshoppens frontend-version. nemlig_cli's egne noter siger at den
    /// kan kræve opdatering, så den hører til i konfiguration frem for i koden.</summary>
    public string AppVersion { get; set; } = "11.201.0";

    public string UserAgent { get; set; } =
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

    /// <summary>Ét kald i sekundet. Samme takt som schourode/nemlig brugte i 2019,
    /// og den klient fik lov at leve i syv år.</summary>
    public int MinMillisecondsBetweenRequests { get; set; } = 1000;

    public TimeSpan ProductCacheDuration { get; set; } = TimeSpan.FromHours(24);
    public TimeSpan PriceCacheDuration { get; set; } = TimeSpan.FromHours(6);

    /// <summary>Tre fejl i træk → pause. Hamrer vi løs på et API der har det
    /// skidt, bliver vi blokeret, og med rette.</summary>
    public int CircuitBreakerThreshold { get; set; } = 3;
    public TimeSpan CircuitBreakerCooldown { get; set; } = TimeSpan.FromMinutes(15);

    public bool IsConfigured => !string.IsNullOrWhiteSpace(Username) && !string.IsNullOrWhiteSpace(Password);
}
