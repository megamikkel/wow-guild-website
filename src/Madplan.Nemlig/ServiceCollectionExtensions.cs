using Madplan.Nemlig.Contracts;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Madplan.Nemlig;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddNemlig(this IServiceCollection services, IConfiguration config)
    {
        services.Configure<NemligOptions>(o =>
        {
            config.GetSection(NemligOptions.SectionName).Bind(o);
            // Miljøvariabler vinder. Kodeordet må aldrig stå i appsettings.json.
            o.Username = config["NEMLIG_USERNAME"] ?? o.Username;
            o.Password = config["NEMLIG_PASSWORD"] ?? o.Password;
        });

        services.AddMemoryCache();

        var configured = !string.IsNullOrWhiteSpace(config["NEMLIG_USERNAME"])
                      && !string.IsNullOrWhiteSpace(config["NEMLIG_PASSWORD"]);

        if (configured)
        {
            // CookieContainer: .ASPXAUTH lever et år, og sessionen skal genbruges
            // på tværs af kald frem for at logge ind hver gang.
            services.AddHttpClient<NemligClient>()
                .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
                {
                    UseCookies = true,
                    CookieContainer = new System.Net.CookieContainer(),
                    AutomaticDecompression = System.Net.DecompressionMethods.All,
                });

            services.TryAddSingleton<INemligAuth>(sp => sp.GetRequiredService<NemligClient>());
            services.TryAddSingleton<INemligCatalog>(sp => sp.GetRequiredService<NemligClient>());
        }
        else
        {
            var offline = new OfflineNemlig();
            services.TryAddSingleton<INemligAuth>(offline);
            services.TryAddSingleton<INemligCatalog>(offline);
        }

        return services;
    }
}
