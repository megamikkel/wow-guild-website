namespace Madplan.Web.Services;

/// <summary>Finder og læser en .env-fil ved opstart.
///
/// Hvorfor appen gør det selv, frem for at et script gør det: at bede nogen
/// sætte miljøvariabler i hånden i en terminal er en invitation til at taste
/// et kodeord det forkerte sted — og så står det på skærmen og i historikken.
/// En fil man redigerer én gang er både nemmere og sikrere.
///
/// Format:
///   NOEGLE=vaerdi
///   NOEGLE="vaerdi med mellemrum"
///   # kommentar
///
/// Rigtige miljøvariabler vinder over filen, så en container kan overstyre den.</summary>
public static class DotEnv
{
    public record Result(string? Path, int Loaded, IReadOnlyList<string> Keys, IReadOnlyList<string> Searched)
    {
        public bool Found => Path is not null;
    }

    /// <summary>Leder efter .env opad fra både arbejdsmappen og programmappen.
    ///
    /// Begge dele er nødvendige: «dotnet run --project src/Madplan.Web» sætter
    /// arbejdsmappen til PROJEKTmappen, ikke til den mappe man står i, mens en
    /// udgivet binær kører fra sin egen mappe. At gå opad dækker begge uden at
    /// gætte på et bestemt antal niveauer.</summary>
    public static Result LoadNearest()
    {
        var searched = new List<string>();

        foreach (var start in new[] { Directory.GetCurrentDirectory(), AppContext.BaseDirectory })
        {
            var dir = new DirectoryInfo(start);
            while (dir is not null)
            {
                var candidate = System.IO.Path.Combine(dir.FullName, ".env");
                if (!searched.Contains(candidate)) searched.Add(candidate);

                if (File.Exists(candidate))
                {
                    var (loaded, keys) = Load(candidate);
                    return new Result(candidate, loaded, keys, searched);
                }

                dir = dir.Parent;
            }
        }

        return new Result(null, 0, [], searched);
    }

    public static (int Loaded, IReadOnlyList<string> Keys) Load(string path)
    {
        if (!File.Exists(path)) return (0, []);

        var keys = new List<string>();
        foreach (var raw in File.ReadAllLines(path))
        {
            var line = raw.Trim();
            if (line.Length == 0 || line.StartsWith('#')) continue;

            // «export FOO=bar» er en almindelig vane fra bash-verdenen.
            if (line.StartsWith("export ", StringComparison.Ordinal)) line = line[7..].TrimStart();

            var eq = line.IndexOf('=');
            if (eq <= 0) continue;

            var key = line[..eq].Trim();
            var value = line[(eq + 1)..].Trim();

            // Anførselstegn hører til filformatet, ikke til værdien. Uden dette
            // ville et kodeord i citationstegn blive sendt til nemlig MED dem,
            // og login ville fejle uforklarligt.
            if (value.Length >= 2 &&
                ((value[0] == '"' && value[^1] == '"') || (value[0] == '\'' && value[^1] == '\'')))
                value = value[1..^1];

            if (key.Length == 0) continue;

            // Sat i forvejen? Så vinder den — en container skal kunne overstyre.
            if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable(key))) continue;

            Environment.SetEnvironmentVariable(key, value);
            if (value.Length > 0) keys.Add(key);
        }

        return (keys.Count, keys);
    }
}
