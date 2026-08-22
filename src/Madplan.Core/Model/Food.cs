namespace Madplan.Core.Model;

/// <summary>En råvare som begreb — "hakket oksekød" — uafhængigt af hvordan den
/// staves i en opskrift og af hvilket nemlig-varenummer der dækker den.
/// Modellen er lånt fra Mealies Food-entitet; se docs/opskriftskilder.md §6.</summary>
public class Food
{
    public int Id { get; set; }
    public string CanonicalName { get; set; } = "";

    /// <summary>Spisekammervare: salt, mel, olie. Ryger ikke på indkøbslisten
    /// medmindre den er markeret som løbet tør i <see cref="PantryItem"/>.</summary>
    public bool IsPantryStaple { get; set; }

    /// <summary>Butiksafdeling. Bruges til at sortere indkøbslisten og til at
    /// straffe kategorimismatch når produktforslag rangeres.</summary>
    public string? AisleLabel { get; set; }

    public int? DefaultUnitId { get; set; }
    public Unit? DefaultUnit { get; set; }

    /// <summary>Sat af parseren når den oprettede rækken selv. Et menneske skal
    /// se den, før den bruges til noget der ender i en kurv.</summary>
    public bool IsUnconfirmed { get; set; }

    public string? Notes { get; set; }

    public List<FoodAlias> Aliases { get; set; } = [];
    public List<ProductMapping> Mappings { get; set; } = [];
}

/// <summary>Én af de mange måder en råvare skrives på. "oksefars" og
/// "hakkekød af okse" peger på samme Food.</summary>
public class FoodAlias
{
    public int Id { get; set; }
    public int FoodId { get; set; }
    public Food? Food { get; set; }

    public string Alias { get; set; } = "";
    /// <summary>Opslagsnøglen. Unik på tværs af alle Foods.</summary>
    public string NormalizedAlias { get; set; } = "";
}
