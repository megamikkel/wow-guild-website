using Madplan.Web.Services;

namespace Madplan.Tests;

public class DotEnvTests : IDisposable
{
    private readonly string _dir = Directory.CreateTempSubdirectory("dotenv").FullName;
    private readonly List<string> _sat = [];

    public void Dispose()
    {
        foreach (var k in _sat) Environment.SetEnvironmentVariable(k, null);
        Directory.Delete(_dir, recursive: true);
        GC.SuppressFinalize(this);
    }

    private string Skriv(string indhold)
    {
        var sti = Path.Combine(_dir, ".env");
        File.WriteAllText(sti, indhold);
        return sti;
    }

    private string Noegle(string navn)
    {
        var unik = $"{navn}_{Guid.NewGuid():N}";
        _sat.Add(unik);
        return unik;
    }

    [Fact]
    public void Almindelige_linjer_laeses()
    {
        var k = Noegle("BRUGER");
        DotEnv.Load(Skriv($"{k}=mikkel@example.dk"));
        Assert.Equal("mikkel@example.dk", Environment.GetEnvironmentVariable(k));
    }

    [Fact]
    public void Anfoerselstegn_hoerer_til_formatet_ikke_til_vaerdien()
    {
        // Uden dette ville et kodeord i citationstegn blive sendt til nemlig
        // MED citationstegnene, og login ville fejle uforklarligt.
        var a = Noegle("A");
        var b = Noegle("B");
        DotEnv.Load(Skriv($"{a}=\"hemmeligt kodeord\"\n{b}='også hemmeligt'"));

        Assert.Equal("hemmeligt kodeord", Environment.GetEnvironmentVariable(a));
        Assert.Equal("også hemmeligt", Environment.GetEnvironmentVariable(b));
    }

    [Fact]
    public void Kodeord_med_lighedstegn_klippes_ikke_over()
    {
        var k = Noegle("PW");
        DotEnv.Load(Skriv($"{k}=abc=def=ghi"));
        Assert.Equal("abc=def=ghi", Environment.GetEnvironmentVariable(k));
    }

    [Fact]
    public void Kommentarer_og_tomme_linjer_springes_over()
    {
        var k = Noegle("C");
        var antal = DotEnv.Load(Skriv($"# en kommentar\n\n{k}=vaerdi\n"));
        Assert.Equal(1, antal);
        Assert.Equal("vaerdi", Environment.GetEnvironmentVariable(k));
    }

    [Fact]
    public void Export_praefiks_accepteres()
    {
        var k = Noegle("E");
        DotEnv.Load(Skriv($"export {k}=vaerdi"));
        Assert.Equal("vaerdi", Environment.GetEnvironmentVariable(k));
    }

    [Fact]
    public void En_rigtig_miljoevariabel_vinder_over_filen()
    {
        // Så en container kan overstyre .env uden at redigere i den.
        var k = Noegle("F");
        Environment.SetEnvironmentVariable(k, "fra-miljoeet");
        DotEnv.Load(Skriv($"{k}=fra-filen"));
        Assert.Equal("fra-miljoeet", Environment.GetEnvironmentVariable(k));
    }

    [Fact]
    public void Manglende_fil_er_ikke_en_fejl()
        => Assert.Equal(0, DotEnv.Load(Path.Combine(_dir, "findes-ikke")));

    [Fact]
    public void Vroevlelinjer_ignoreres_uden_at_kaste()
    {
        var k = Noegle("G");
        DotEnv.Load(Skriv($"bare noget tekst\n=ingen noegle\n{k}=virker"));
        Assert.Equal("virker", Environment.GetEnvironmentVariable(k));
    }
}
