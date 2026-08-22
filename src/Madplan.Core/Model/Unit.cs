namespace Madplan.Core.Model;

public enum UnitType
{
    /// <summary>Basisenhed: gram.</summary>
    Mass,
    /// <summary>Basisenhed: milliliter.</summary>
    Volume,
    /// <summary>Basisenhed: styk. Dækker også "fed", "bakke", "dåse".</summary>
    Count
}

public class Unit
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Abbreviation { get; set; } = "";
    public UnitType Type { get; set; }

    /// <summary>Gange med denne for at nå basisenheden. 1 kg → 1000 g, 1 dl → 100 ml.</summary>
    public double ToBaseFactor { get; set; } = 1;

    /// <summary>Falsk for uldne mål som "knivspids" og "håndfuld". De må ikke
    /// indgå i aritmetik — de vises som de er og lægges ikke sammen.</summary>
    public bool IsStandard { get; set; } = true;
}

/// <summary>Densitet pr. råvare. Danske opskrifter måler tørvarer i decilitre,
/// så uden denne kan "2 dl mel" og "250 g mel" ikke lægges sammen.</summary>
public class FoodUnitConversion
{
    public int Id { get; set; }
    public int FoodId { get; set; }
    public Food? Food { get; set; }

    public int FromUnitId { get; set; }
    public Unit? FromUnit { get; set; }
    public int ToUnitId { get; set; }
    public Unit? ToUnit { get; set; }

    /// <summary>Antal ToUnit pr. FromUnit. 1 dl mel → 60 g giver Factor = 60.</summary>
    public double Factor { get; set; }
}
