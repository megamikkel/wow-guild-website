using System.Reflection;
using Madplan.Nemlig.Contracts;

namespace Madplan.Tests;

/// <summary>Krav 1 er ufravigeligt: appen fylder kurven, mennesket bestiller.
///
/// Den robuste tolkning af "byg ikke engang funktionen" er at koden ikke kender
/// adressen. Disse tests håndhæver det. De lyder paranoide indtil den dag nogen
/// — et menneske eller en assistent — "hjælper" med at gøre flowet færdigt.</summary>
public class CheckoutIsNotBuiltTests
{
    /// <summary>Endpoints hos nemlig der gennemfører et køb. Ingen af dem må
    /// optræde nogen steder i vores kildekode.</summary>
    private static readonly string[] ForbiddenEndpoints =
    [
        "PlaceOrderLoggedIn",
        "RegisterNewPaymentTransaction",
        "GetCreditCards",
        "GetCardsFees",
    ];

    private static DirectoryInfo RepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !dir.GetFiles("Madplan.sln").Any()) dir = dir.Parent;
        return dir ?? throw new InvalidOperationException("Fandt ikke roden af repoet.");
    }

    [Fact]
    public void Ingen_checkout_endpoints_findes_i_kildekoden()
    {
        var root = RepoRoot();
        var sources = new[] { "src", "tests" }
            .Select(d => new DirectoryInfo(Path.Combine(root.FullName, d)))
            .Where(d => d.Exists)
            .SelectMany(d => d.EnumerateFiles("*.*", SearchOption.AllDirectories))
            .Where(f => f.Extension is ".cs" or ".razor")
            .Where(f => !f.FullName.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}")
                     && !f.FullName.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}"))
            // Denne fil nævner dem nødvendigvis — det er hele dens formål.
            .Where(f => f.Name != "CheckoutIsNotBuiltTests.cs");

        var hits = new List<string>();
        foreach (var file in sources)
        {
            var text = File.ReadAllText(file.FullName);
            foreach (var endpoint in ForbiddenEndpoints)
                if (text.Contains(endpoint, StringComparison.OrdinalIgnoreCase))
                    hits.Add($"{Path.GetRelativePath(root.FullName, file.FullName)} nævner '{endpoint}'");
        }

        Assert.True(hits.Count == 0,
            "Checkout-endpoints må ikke findes i koden — appen fylder kurven, " +
            "mennesket bestiller. Fundet:\n  " + string.Join("\n  ", hits));
    }

    [Fact]
    public void Kurv_interfacet_kan_kun_laese_og_saette_maengder()
    {
        var methods = typeof(INemligBasket).GetMethods(BindingFlags.Public | BindingFlags.Instance)
            .Select(m => m.Name).ToArray();

        Assert.Equal(["GetAsync", "SetQuantityAsync"], [.. methods.Order()]);
    }

    [Fact]
    public void Ingen_offentlig_type_i_nemlig_laget_ligner_en_bestilling()
    {
        var suspicious = typeof(INemligBasket).Assembly.GetTypes()
            .SelectMany(t => t.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static)
                              .Select(m => $"{t.Name}.{m.Name}"))
            .Where(n => n.Contains("PlaceOrder", StringComparison.OrdinalIgnoreCase)
                     || n.Contains("Checkout", StringComparison.OrdinalIgnoreCase)
                     || n.Contains("Payment", StringComparison.OrdinalIgnoreCase))
            .ToList();

        Assert.True(suspicious.Count == 0, "Fundet: " + string.Join(", ", suspicious));
    }
}
