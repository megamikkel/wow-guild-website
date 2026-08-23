namespace Madplan.Web.Services;

/// <summary>Læser en .env-fil ind som miljøvariabler ved opstart.
///
/// Hvorfor appen gør det selv, frem for at et script gør det: at bede nogen
/// sætte miljøvariabler i hånden i en terminal er en invitation til at taste
/// et kodeord det forkerte sted. En fil man redigerer én gang er både nemmere
/// og sikrere — den vises ikke på skærmen og havner ikke i shell-historikken.
///
/// Format:
///   NOEGLE=vaerdi
///   NOEGLE="vaerdi med mellemrum"
///   # kommentar
///
/// Rigtige miljøvariabler vinder over filen, så en container kan overstyre den.</summary>
public static class DotEnv
{
    public static int Load(string path)
    {
        if (!File.Exists(path)) return 0;

        var loaded = 0;
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
            // ville et kodeord i citationstegn blive sendt til nemlig MED dem.
            if (value.Length >= 2 &&
                ((value[0] == '"' && value[^1] == '"') || (value[0] == '\'' && value[^1] == '\'')))
                value = value[1..^1];

            if (key.Length == 0) continue;

            // Sat i forvejen? Så vinder den — en container skal kunne overstyre.
            if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable(key))) continue;

            Environment.SetEnvironmentVariable(key, value);
            loaded++;
        }

        return loaded;
    }
}
