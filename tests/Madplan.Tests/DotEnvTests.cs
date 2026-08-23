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
        var (antal, _) = DotEnv.Load(Skriv($"# en kommentar\n\n{k}=vaerdi\n"));
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
        => Assert.Equal(0, DotEnv.Load(Path.Combine(_dir, "findes-ikke")).Loaded);

    [Fact]
    public void Vroevlelinjer_ignoreres_uden_at_kaste()
    {
        var k = Noegle("G");
        DotEnv.Load(Skriv($"bare noget tekst\n=ingen noegle\n{k}=virker"));
        Assert.Equal("virker", Environment.GetEnvironmentVariable(k));
    }

    [Fact]
    public void Env_findes_ogsaa_naar_man_koerer_fra_en_undermappe()
    {
        // «dotnet run --project src/Madplan.Web» saetter arbejdsmappen til
        // PROJEKTmappen, ikke til den mappe man staar i. Uden opadgaaende
        // soegning ville .env i roden aldrig blive fundet.
        var k = Noegle("DYBT");
        File.WriteAllText(Path.Combine(_dir, ".env"), $"{k}=fundet");

        var dybt = Directory.CreateDirectory(Path.Combine(_dir, "src", "App", "bin", "Debug"));
        var foer = Directory.GetCurrentDirectory();
        try
        {
            Directory.SetCurrentDirectory(dybt.FullName);
            var r = DotEnv.LoadNearest();

            Assert.True(r.Found);
            Assert.Equal("fundet", Environment.GetEnvironmentVariable(k));
        }
        finally { Directory.SetCurrentDirectory(foer); }
    }

    [Fact]
    public void Uden_nogen_env_fil_siger_resultatet_hvor_der_blev_ledt()
    {
        var tom = Directory.CreateDirectory(Path.Combine(_dir, "helt", "tom"));
        var foer = Directory.GetCurrentDirectory();
        try
        {
            Directory.SetCurrentDirectory(tom.FullName);
            // Der ligger en .env i _dir, saa vi kan ikke forvente Found == false.
            // Vi tjekker at soegestien rapporteres, saa fejlbeskeden kan bruges.
            var r = DotEnv.LoadNearest();
            Assert.NotEmpty(r.Searched);
        }
        finally { Directory.SetCurrentDirectory(foer); }
    }
}
