namespace Madplan.Core.Planning;

/// <summary>Hvor mange pakker skal der til, og ser resultatet fornuftigt ud?
/// Det er her "300 g pasta bliver til én pose á 500 g" afgøres.</summary>
public static class PackSizeMath
{
    /// <summary>Advar over dette antal pakker — så er enheden nok forkert mappet.</summary>
    public const int SuspiciousPackCount = 5;
    /// <summary>Advar når vi køber mere end dette gange behovet.</summary>
    public const double SuspiciousOvershootRatio = 3.0;

    public record PackResult(int PackCount, double Overshoot, string? Warning);

    public static PackResult Compute(double neededQuantity, double packageSize)
    {
        if (neededQuantity <= 0)
            return new PackResult(0, 0, null);

        if (packageSize <= 0)
            return new PackResult(1, 0, "Pakkestørrelsen er ukendt — tjek mapningen.");

        var packs = (int)Math.Ceiling(neededQuantity / packageSize);
        var bought = packs * packageSize;
        var overshoot = bought - neededQuantity;

        string? warning = null;
        if (packs > SuspiciousPackCount)
            warning = $"{packs} pakker ser meget ud — er enheden rigtig?";
        else if (neededQuantity > 0 && bought / neededQuantity > SuspiciousOvershootRatio)
            warning = $"Du køber {Format(bought)} for at bruge {Format(neededQuantity)}.";

        return new PackResult(packs, overshoot, warning);
    }

    private static string Format(double v) =>
        v >= 1000 ? $"{v / 1000:0.##} kg/l" : $"{v:0.##}";
}
