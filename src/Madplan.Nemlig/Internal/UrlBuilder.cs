namespace Madplan.Nemlig.Internal;

internal static class UrlBuilder
{
    /// <summary>Bygger den <c>timeslotUtc</c>-streng som søge-gatewayen kræver:
    /// <c>{yyyyMMddHH}-{minutterTilÅbning}-{minutterTilLukning}</c>.
    ///
    /// Værdien hentes normalt fra sidedata, men både hknielsen/nemlig-cli og
    /// mhattingpete/nemlig-shopper beregner den lokalt, og begge virker. Det
    /// tyder på at den er en tidsbaseret cache-nøgle frem for et valg af
    /// leveringsvindue. Vi bruger den kun som fallback når sidedata svigter —
    /// og tjek 5 i docs/nemlig-api.md §7 skal stadig bekræfte at en forældet
    /// værdi giver en fejl frem for stille forkerte priser.</summary>
    internal static string ComputeTimeslot(DateTime utcNow)
    {
        var prefix = utcNow.ToString("yyyyMMddHH");

        var open = new DateTime(utcNow.Year, utcNow.Month, utcNow.Day, 6, 0, 0, DateTimeKind.Utc);
        var close = new DateTime(utcNow.Year, utcNow.Month, utcNow.Day, 20, 0, 0, DateTimeKind.Utc);

        // Efter dagens vindue peger vi på morgendagens.
        if (utcNow >= close) { open = open.AddDays(1); close = close.AddDays(1); }

        var toOpen = Math.Max(0, (int)(open - utcNow).TotalMinutes);
        var toClose = Math.Max(0, (int)(close - utcNow).TotalMinutes);

        return $"{prefix}-{toOpen}-{toClose}";
    }
}
