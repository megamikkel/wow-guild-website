using System.Reflection;
using Madplan.Nemlig.Contracts;

namespace Madplan.Tests;

/// <summary>Appen læser hos nemlig. Den skriver ikke.
///
/// Kravet var oprindeligt "fyld kurven, men bestil aldrig". Det blev siden
/// strammet til slet ikke at røre kurven, og det gør hele nemlig-laget læsende.
/// Det er en stærkere garanti og en nemmere at håndhæve: der findes ikke ét
/// kald i løsningen der ændrer noget hos nemlig.
///
/// Testene lyder paranoide indtil den dag nogen — et menneske eller en assistent
/// — "hjælper" med at gøre flowet færdigt.</summary>
public class NemligIsReadOnlyTests
{
    /// <summary>Endpoints der ændrer noget hos nemlig. Ingen af dem må optræde
    /// i vores kildekode. AddToBasket og UpdateBasketLine er med, fordi de
    /// skriver til kurven; PlaceOrder og betalingskaldene, fordi de køber.</summary>
    private static readonly string[] ForbiddenEndpoints =
    [
        "AddToBasket",
        "UpdateBasketLine",
        "RemoveMealBox",
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

    private static IEnumerable<FileInfo> SourceFiles() =>
        new[] { "src", "tests" }
            .Select(d => new DirectoryInfo(Path.Combine(RepoRoot().FullName, d)))
            .Where(d => d.Exists)
            .SelectMany(d => d.EnumerateFiles("*.*", SearchOption.AllDirectories))
            .Where(f => f.Extension is ".cs" or ".razor")
            .Where(f => !f.FullName.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}")
                     && !f.FullName.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}"))
            // Denne fil nævner dem nødvendigvis — det er hele dens formål.
            .Where(f => f.Name != "NemligIsReadOnlyTests.cs");

    [Fact]
    public void Ingen_skrivende_nemlig_endpoints_findes_i_kildekoden()
    {
        var root = RepoRoot();
        var hits = new List<string>();

        foreach (var file in SourceFiles())
        {
            var text = File.ReadAllText(file.FullName);
            foreach (var endpoint in ForbiddenEndpoints)
                if (text.Contains(endpoint, StringComparison.OrdinalIgnoreCase))
                    hits.Add($"{Path.GetRelativePath(root.FullName, file.FullName)} nævner '{endpoint}'");
        }

        Assert.True(hits.Count == 0,
            "Nemlig-laget skal være rent læsende. Fundet:\n  " + string.Join("\n  ", hits));
    }

    [Fact]
    public void Der_findes_intet_kurv_interface()
    {
        var types = typeof(INemligCatalog).Assembly.GetTypes()
            .Where(t => t.Name.Contains("Basket", StringComparison.OrdinalIgnoreCase))
            .Select(t => t.Name)
            .ToList();

        Assert.True(types.Count == 0, "Fundet kurv-typer: " + string.Join(", ", types));
    }

    [Fact]
    public void Katalog_interfacet_kan_kun_soege_og_slaa_op()
    {
        var methods = typeof(INemligCatalog)
            .GetMethods(BindingFlags.Public | BindingFlags.Instance)
            .Select(m => m.Name).Order().ToArray();

        Assert.Equal(["GetProductAsync", "SearchAsync"], methods);
    }

    [Fact]
    public void Kun_login_bruger_POST()
    {
        // Alt andet er GET. Ændrer nogen det, skal det være et bevidst valg med
        // en god grund — ikke noget der glider ind.
        var client = Path.Combine(RepoRoot().FullName, "src", "Madplan.Nemlig", "NemligClient.cs");
        var text = File.ReadAllText(client);

        var postCalls = text.Split('\n')
            .Select((line, i) => (Line: line.Trim(), Number: i + 1))
            .Where(l => l.Line.Contains("HttpMethod.Post"))
            .ToList();

        Assert.All(postCalls, p => Assert.Contains("/webapi/login", p.Line));
    }
}
