namespace Madplan.Core.Parsing;

using Madplan.Core.Model;

/// <summary>Enhedsordbogen. Formen er inspireret af den MIT-licenserede ordbog i
/// mhattingpete/nemlig-shopper (docs/opskriftskilder.md §5); indholdet er skrevet
/// om til vores egen model og udvidet med danske mål.</summary>
public static class DanishUnits
{
    public record UnitDef(string Name, string Abbrev, UnitType Type, double ToBase, bool IsStandard = true);

    public static readonly UnitDef[] All =
    [
        // Vægt — basis: gram
        new("gram",      "g",    UnitType.Mass,   1),
        new("kilogram",  "kg",   UnitType.Mass,   1000),

        // Volumen — basis: milliliter
        new("milliliter","ml",   UnitType.Volume, 1),
        new("centiliter","cl",   UnitType.Volume, 10),
        new("deciliter", "dl",   UnitType.Volume, 100),
        new("liter",     "l",    UnitType.Volume, 1000),
        new("spiseskefuld","spsk",UnitType.Volume, 15),
        new("teskefuld", "tsk",  UnitType.Volume, 5),

        // Antal — basis: styk
        new("styk",      "stk",  UnitType.Count,  1),
        new("fed",       "fed",  UnitType.Count,  1),
        new("bakke",     "bakke",UnitType.Count,  1),
        new("dåse",      "dåse", UnitType.Count,  1),
        new("pose",      "pose", UnitType.Count,  1),
        new("bundt",     "bundt",UnitType.Count,  1),
        new("skive",     "skive",UnitType.Count,  1),

        // Uldne mål. IsStandard = false, så de aldrig indgår i aritmetik.
        new("knivspids", "knivspids", UnitType.Count, 1, IsStandard: false),
        new("håndfuld",  "håndfuld",  UnitType.Count, 1, IsStandard: false),
        new("efter smag","efter smag",UnitType.Count, 1, IsStandard: false),
    ];

    /// <summary>Alle skrivemåder → den kanoniske forkortelse. Rækkefølgen betyder
    /// intet; opslaget sker på hele ord.</summary>
    public static readonly Dictionary<string, string> Synonyms = new(StringComparer.OrdinalIgnoreCase)
    {
        ["g"] = "g", ["gram"] = "g", ["gr"] = "g",
        ["kg"] = "kg", ["kilo"] = "kg", ["kilogram"] = "kg",
        ["ml"] = "ml", ["milliliter"] = "ml",
        ["cl"] = "cl", ["centiliter"] = "cl",
        ["dl"] = "dl", ["deciliter"] = "dl",
        ["l"] = "l", ["liter"] = "l", ["ltr"] = "l",
        ["spsk"] = "spsk", ["spiseske"] = "spsk", ["spiseskefuld"] = "spsk",
        ["spiseskefulde"] = "spsk", ["spsk."] = "spsk",
        ["tsk"] = "tsk", ["teske"] = "tsk", ["teskefuld"] = "tsk",
        ["teskefulde"] = "tsk", ["tsk."] = "tsk",
        ["stk"] = "stk", ["stk."] = "stk", ["styk"] = "stk", ["stykker"] = "stk",
        ["fed"] = "fed",
        ["bakke"] = "bakke", ["bakker"] = "bakke",
        ["dåse"] = "dåse", ["dåser"] = "dåse", ["daase"] = "dåse",
        ["pose"] = "pose", ["poser"] = "pose",
        ["bundt"] = "bundt",
        ["skive"] = "skive", ["skiver"] = "skive",
        ["knivspids"] = "knivspids",
        ["håndfuld"] = "håndfuld", ["haandfuld"] = "håndfuld", ["neve"] = "håndfuld",
    };

    /// <summary>Unicode-brøker og skråstregsformer. Danske opskrifter bruger begge.</summary>
    public static readonly Dictionary<string, double> Fractions = new()
    {
        ["½"] = 0.5, ["⅓"] = 1.0 / 3, ["⅔"] = 2.0 / 3, ["¼"] = 0.25, ["¾"] = 0.75,
        ["⅕"] = 0.2, ["⅖"] = 0.4, ["⅗"] = 0.6, ["⅘"] = 0.8,
        ["⅙"] = 1.0 / 6, ["⅚"] = 5.0 / 6, ["⅛"] = 0.125, ["⅜"] = 0.375,
        ["⅝"] = 0.625, ["⅞"] = 0.875,
    };

    /// <summary>Ord der fjernes når et råvarenavn normaliseres. Listen er bevidst
    /// kort og konservativ: "hakket" står IKKE her, fordi hakket oksekød og
    /// oksekød er forskellige varer. To Food-rækker der skal merges er et mindre
    /// onde end to varer der fejlagtigt blev til én.</summary>
    public static readonly string[] NoiseWords =
    [
        "frisk", "friske", "friskkværnet", "økologisk", "økologiske", "øko",
        "ca", "ca.", "cirka", "evt", "evt.", "eventuelt",
        "god", "godt", "lidt", "gerne", "helst",
        "til servering", "til pynt", "til stegning", "til kogning",
    ];
}
