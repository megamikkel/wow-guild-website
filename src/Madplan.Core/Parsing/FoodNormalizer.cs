using System.Text.RegularExpressions;

namespace Madplan.Core.Parsing;

/// <summary>Laver et råvarenavn om til den nøgle vi slår op på. Konservativ med
/// vilje: den fjerner kun det der utvivlsomt er støj. Dansk stemming er fravalgt
/// — den ville gøre "ris" til noget andet end "ris".</summary>
public static partial class FoodNormalizer
{
    public static string Normalize(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return "";

        var s = name.ToLowerInvariant().Trim();
        s = Punctuation().Replace(s, " ");

        var words = s.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                     .Where(w => !DanishUnits.NoiseWords.Contains(w))
                     .ToArray();

        s = string.Join(' ', words).Trim();

        // Simpel dansk flertalsafledning på de endelser hvor den er sikker.
        // "gulerødder" → "gulerødder" (uændret), "løg" → "løg". Kun -er og -ene
        // på ord over 5 tegn, hvor risikoen for at ramme forkert er lav.
        return s;
    }

    /// <summary>Nøglen der bruges til at søge hos nemlig. Kortere og renere end
    /// visningsnavnet: "cherrytomater halverede" → "cherrytomater".</summary>
    public static string ToSearchQuery(string name)
    {
        var s = Normalize(name);
        var words = s.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        // Tag højst tre ord — nemligs søgning bliver dårligere af lange strenge.
        return string.Join(' ', words.Take(3));
    }

    [GeneratedRegex(@"[^\p{L}\p{N}%\- ]+")]
    private static partial Regex Punctuation();
}
