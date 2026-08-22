namespace Madplan.Core.Model;

/// <summary>Bindeleddet mellem en råvare og en konkret vare hos nemlig.
/// Projektets vigtigste tabel: den lærer over tid, så et valg kun træffes én gang.</summary>
public class ProductMapping
{
    public int Id { get; set; }
    public int FoodId { get; set; }
    public Food? Food { get; set; }

    public string NemligProductId { get; set; } = "";
    public string ProductName { get; set; } = "";

    /// <summary>Pakkens indhold i <see cref="PackageUnitId"/>. En pose pasta á 500 g
    /// giver 500. Uden denne kan vi ikke regne 300 g om til ét stk.</summary>
    public double PackageSize { get; set; } = 1;
    public int PackageUnitId { get; set; }
    public Unit? PackageUnit { get; set; }

    /// <summary>Flere mapninger pr. råvare er tilladt — økologisk og billig er
    /// ikke samme valg. Præcis én er foretrukken.</summary>
    public bool IsPreferred { get; set; } = true;

    public MappingSource Source { get; set; } = MappingSource.Manuel;

    // Dokumenterer at et menneske har set og godkendt netop dette match.
    public int? ConfirmedByUserId { get; set; }
    public DateTime? ConfirmedAt { get; set; }
}

public enum MappingSource { Manuel, Ordrehistorik, Forslag }

/// <summary>Prisobservation. Vi gemmer frem for at overskrive, så prishistorik
/// senere kan bygges uden en migration.</summary>
public class ProductSnapshot
{
    public int Id { get; set; }
    public string NemligProductId { get; set; } = "";
    public DateTime ObservedAt { get; set; } = DateTime.UtcNow;

    public decimal Price { get; set; }
    public decimal? UnitPrice { get; set; }
    public string? UnitPriceLabel { get; set; }
    public bool InStock { get; set; }
    public string? Description { get; set; }
}
