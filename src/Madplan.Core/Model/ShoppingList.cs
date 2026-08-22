namespace Madplan.Core.Model;

public class ShoppingList
{
    public int Id { get; set; }
    public int MealPlanId { get; set; }
    public MealPlan? MealPlan { get; set; }

    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
    public List<ShoppingListLine> Lines { get; set; } = [];

    /// <summary>Summen af de linjer vi kender en pris på. Null-priser tælles ikke
    /// med — se <see cref="HasUnknownPrices"/>, som fortæller at tallet er et gulv
    /// og ikke en samlet pris.</summary>
    public decimal KnownTotal => Lines.Where(l => l.Included).Sum(l => l.EstimatedPrice ?? 0m);
    public bool HasUnknownPrices => Lines.Any(l => l.Included && l.EstimatedPrice is null);
}

public class ShoppingListLine
{
    public int Id { get; set; }
    public int ShoppingListId { get; set; }
    public ShoppingList? ShoppingList { get; set; }

    public int FoodId { get; set; }
    public Food? Food { get; set; }

    /// <summary>Samlet behov for hele ugen, i basisenheden for varens enhedstype.</summary>
    public double NeededQuantity { get; set; }
    public int NeededUnitId { get; set; }
    public Unit? NeededUnit { get; set; }

    public int? ProductMappingId { get; set; }
    public ProductMapping? ProductMapping { get; set; }

    public int PackCount { get; set; }
    /// <summary>Null betyder ukendt, ikke gratis. Krav 4: appen virker når nemlig er nede.</summary>
    public decimal? EstimatedPrice { get; set; }

    public LineStatus Status { get; set; } = LineStatus.Ok;
    public string? Warning { get; set; }
    public bool ManualOverride { get; set; }

    /// <summary>Talt med i kurven og i prisen.</summary>
    public bool Included => Status is LineStatus.Ok or LineStatus.Udsolgt;

    /// <summary>Linjer der stammer fra ingredienser vi ikke kunne parse. De har
    /// ingen mængde, kun råtekst, og skal ses af et menneske.</summary>
    public string? UnparsedText { get; set; }
}

public enum LineStatus
{
    Ok,
    ManglerMapping,
    Udsolgt,
    Spisekammer,
    FravalgtManuelt,
    KanIkkeBeregnes
}
