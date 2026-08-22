using Madplan.Core.Model;

namespace Madplan.Core.Units;

/// <summary>Omregning mellem enheder. To niveauer: inden for samme enhedstype
/// klares det af <see cref="Unit.ToBaseFactor"/>; på tværs af typer kræves en
/// densitet pr. råvare (2 dl mel → 120 g), som kun findes for de varer nogen har
/// oprettet en <see cref="FoodUnitConversion"/> for.</summary>
public class UnitConverter(IReadOnlyCollection<FoodUnitConversion> conversions)
{
    private readonly ILookup<int, FoodUnitConversion> _byFood =
        conversions.ToLookup(c => c.FoodId);

    /// <summary>Omregner til basisenheden for <paramref name="target"/>s type.
    /// Returnerer null når omregningen ikke er meningsfuld — det er et gyldigt
    /// svar, og kalderen skal vise to linjer frem for at lægge dem forkert sammen.</summary>
    public double? ToBase(double quantity, Unit from, UnitType target, int foodId)
    {
        if (!from.IsStandard) return null; // "en knivspids" indgår ikke i aritmetik

        if (from.Type == target)
            return quantity * from.ToBaseFactor;

        // Krydser vi enhedstyper, skal der en densitet til, og den er pr. råvare.
        foreach (var c in _byFood[foodId])
        {
            if (c.FromUnit is null || c.ToUnit is null) continue;
            if (c.FromUnit.Type != from.Type || c.ToUnit.Type != target) continue;

            // Normalisér til densitetens egen fra-enhed, gang, og gå til basis.
            var inFromUnit = quantity * from.ToBaseFactor / c.FromUnit.ToBaseFactor;
            return inFromUnit * c.Factor * c.ToUnit.ToBaseFactor;
        }

        return null;
    }

    /// <summary>Kan de to enheder overhovedet lægges sammen for denne råvare?</summary>
    public bool CanCombine(Unit a, Unit b, int foodId)
    {
        if (!a.IsStandard || !b.IsStandard) return false;
        if (a.Type == b.Type) return true;
        return _byFood[foodId].Any(c =>
            c.FromUnit is not null && c.ToUnit is not null &&
            ((c.FromUnit.Type == a.Type && c.ToUnit.Type == b.Type) ||
             (c.FromUnit.Type == b.Type && c.ToUnit.Type == a.Type)));
    }
}
