namespace Madplan.Core.Model;

/// <summary>Noten om hvad man gør anderledes til den etårige.
///
/// Den har ikke sin egen kolonne. Opskrifterne kom ind gennem den samme vej som
/// alle andre — via en fremgangsmåde — og noten blev sat i enden af den. Det er
/// stadig det rigtige sted: står man med opskriften i hånden, vil man have den
/// med.
///
/// Men to steder i koden skal være enige om ordlyden: det ene skriver den, det
/// andet læser den ud igen til forsiden. Var mærket skrevet i hånden begge
/// steder, ville en rettelse det ene sted få noten til at forsvinde fra
/// forsiden uden at noget fejlede. Derfor står ordene ét sted.</summary>
public static class Barnenote
{
    public const string Maerke = "Til den etårige:";

    /// <summary>Sætter noten i enden af fremgangsmåden.</summary>
    public static string Tilfoej(string? fremgangsmaade, string? note) =>
        string.IsNullOrWhiteSpace(note)
            ? fremgangsmaade ?? ""
            : $"{fremgangsmaade}\n\n{Maerke} {note.Trim()}";

    /// <summary>Læser noten ud igen. Null når der ikke er nogen — og null
    /// betyder at forsiden helt lader være med at vise feltet, frem for at
    /// vise en tom kasse.</summary>
    public static string? Laes(string? fremgangsmaade)
    {
        var i = fremgangsmaade?.IndexOf(Maerke, StringComparison.OrdinalIgnoreCase) ?? -1;
        if (i < 0) return null;

        var note = fremgangsmaade![(i + Maerke.Length)..].Trim();
        return note.Length == 0 ? null : note;
    }
}
