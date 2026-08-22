using System.Globalization;
using System.Text.RegularExpressions;

namespace Madplan.Core.Parsing;

/// <summary>Resultatet af at læse én ingredienslinje. Alle felter kan være tomme:
/// en linje vi ikke forstår er en gyldig tilstand, ikke en fejl. Den havner på
/// indkøbslisten med sin råtekst og et flag, hvilket er bedre end et gæt.</summary>
public record ParsedIngredient(
    double? Quantity,
    string? UnitAbbrev,
    string FoodName,
    string? Note,
    string RawText)
{
    public bool HasQuantity => Quantity is > 0;
}

public static partial class IngredientParser
{
    public static ParsedIngredient Parse(string rawText)
    {
        var raw = rawText?.Trim() ?? "";
        if (raw.Length == 0) return new ParsedIngredient(null, null, "", null, rawText ?? "");

        var work = raw;
        string? note = null;

        // Parentesnoter først: "hvidløg (finthakket)".
        var paren = ParenNote().Match(work);
        if (paren.Success)
        {
            note = paren.Groups[1].Value.Trim();
            work = work.Remove(paren.Index, paren.Length).Trim();
        }

        // Mængde og enhed læses FØR komma-noten adskilles. Ellers ville decimaltal
        // som "2,5 dl" blive læst som mængden 2 med noten "5 dl".
        var (quantity, rest) = ReadQuantity(work);
        var (unit, remainder) = ReadUnit(rest);

        // Resten kan indeholde en komma-note: "løg, i tern".
        var comma = remainder.IndexOf(',');
        if (comma >= 0)
        {
            var after = remainder[(comma + 1)..].Trim();
            if (after.Length > 0)
                note = note is null ? after : $"{note}, {after}";
            remainder = remainder[..comma].Trim();
        }

        var name = CleanName(remainder);

        // "1 lille løg": adjektivet er ikke en enhed, men det er værd at bevare.
        if (unit is null && quantity is not null && name.Length == 0 && note is not null)
            name = note;

        return new ParsedIngredient(quantity, unit, name, string.IsNullOrWhiteSpace(note) ? null : note, raw);
    }

    /// <summary>Læser en mængde forrest i teksten. Håndterer heltal, decimaltal med
    /// både komma og punktum, unicode-brøker, skråstregsbrøker, blandede tal som
    /// "1½" og "1 1/2", og intervaller som "2-3".</summary>
    internal static (double? Quantity, string Remainder) ReadQuantity(string text)
    {
        var s = text.TrimStart();
        if (s.Length == 0) return (null, "");

        double total = 0;
        var consumed = 0;
        var sawAny = false;

        while (consumed < s.Length)
        {
            var slice = s[consumed..].TrimStart();
            var skipped = s.Length - consumed - slice.Length;

            // Interval: tag det højeste. Hellere en gulerod for meget end en for lidt.
            var range = RangeToken().Match(slice);
            if (range.Success && !sawAny)
            {
                total = ParseNumber(range.Groups[2].Value);
                consumed += skipped + range.Length;
                sawAny = true;
                break;
            }

            var frac = SlashFraction().Match(slice);
            if (frac.Success)
            {
                var denom = ParseNumber(frac.Groups[2].Value);
                if (denom != 0) total += ParseNumber(frac.Groups[1].Value) / denom;
                consumed += skipped + frac.Length;
                sawAny = true;
                continue;
            }

            var num = NumberToken().Match(slice);
            if (num.Success)
            {
                total += ParseNumber(num.Value);
                consumed += skipped + num.Length;
                sawAny = true;
                // "1½" står klistret sammen; løkken tager brøken i næste runde.
                continue;
            }

            if (DanishUnits.Fractions.TryGetValue(slice.Length > 0 ? slice[..1] : "", out var unicodeFrac))
            {
                total += unicodeFrac;
                consumed += skipped + 1;
                sawAny = true;
                continue;
            }

            break;
        }

        return sawAny ? (total, s[consumed..].TrimStart()) : (null, s);
    }

    private static double ParseNumber(string token) =>
        double.Parse(token.Replace(',', '.'), CultureInfo.InvariantCulture);

    /// <summary>Læser en enhed forrest i teksten, hvis der står en. Prøver to ord
    /// før ét, så "efter smag" ikke bliver til "efter".</summary>
    internal static (string? Unit, string Remainder) ReadUnit(string text)
    {
        var s = text.TrimStart();
        if (s.Length == 0) return (null, "");

        var words = s.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (words.Length >= 2)
        {
            var two = $"{words[0]} {words[1]}";
            if (DanishUnits.Synonyms.TryGetValue(two, out var twoHit))
                return (twoHit, string.Join(' ', words.Skip(2)));
        }

        if (words.Length >= 1 && DanishUnits.Synonyms.TryGetValue(words[0].TrimEnd('.'), out var oneHit))
            return (oneHit, string.Join(' ', words.Skip(1)));

        return (null, s);
    }

    /// <summary>Fjerner "af", "med" og lignende bindeord forrest, samt overflødigt
    /// whitespace. Støjord fjernes IKKE her — det hører til normaliseringen, hvor
    /// råvarenavnet skal slås op, ikke vises.</summary>
    private static string CleanName(string text)
    {
        var s = Whitespace().Replace(text.Trim(), " ");
        foreach (var lead in new[] { "af ", "med ", "à ", "a " })
            if (s.StartsWith(lead, StringComparison.OrdinalIgnoreCase))
                s = s[lead.Length..];
        return s.Trim(' ', '-', ':', '.');
    }

    [GeneratedRegex(@"\(([^)]*)\)")]
    private static partial Regex ParenNote();

    [GeneratedRegex(@"^(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)")]
    private static partial Regex RangeToken();

    [GeneratedRegex(@"^(\d+)\s*/\s*(\d+)")]
    private static partial Regex SlashFraction();

    [GeneratedRegex(@"^\d+(?:[.,]\d+)?")]
    private static partial Regex NumberToken();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();
}
