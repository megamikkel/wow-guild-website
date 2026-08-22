using Madplan.Core.Model;
using Madplan.Core.Units;

namespace Madplan.Core.Planning;

/// <summary>Bygger ugens indkøbsliste ud fra en madplan.
///
/// Rækkefølgen er ikke til forhandling: der aggregeres PR. RÅVARE FOR HELE UGEN
/// før der slås produkter op. Gør man det omvendt, ender tre opskrifter med hakket
/// oksekød som tre forskellige varer i kurven.
///
/// Klassen rører ikke nemlig. Den kender priser hvis nogen har givet den nogle,
/// og bygger en fuldt brugbar liste hvis ingen har — krav 4.</summary>
public class ShoppingListBuilder(
    IReadOnlyCollection<Unit> units,
    IReadOnlyCollection<FoodUnitConversion> conversions)
{
    private readonly UnitConverter _converter = new(conversions);
    private readonly Dictionary<int, Unit> _units = units.ToDictionary(u => u.Id);

    public record Input(
        IReadOnlyCollection<MealPlanEntry> Entries,
        IReadOnlyCollection<ProductMapping> Mappings,
        IReadOnlyCollection<PantryItem> Pantry,
        IReadOnlyDictionary<string, decimal?> PricesByProductId,
        IReadOnlyDictionary<string, bool> InStockByProductId);

    public ShoppingList Build(MealPlan plan, Input input)
    {
        var list = new ShoppingList { MealPlanId = plan.Id, GeneratedAt = DateTime.UtcNow };

        // 1-3: parse er allerede sket ved indtastning; her skaleres og samles.
        var buckets = new Dictionary<int, Bucket>();
        var unparsed = new List<(string Text, string Recipe)>();

        foreach (var entry in input.Entries)
        {
            var recipe = entry.Recipe;
            if (recipe is null) continue;

            var scale = recipe.Servings > 0
                ? (double)entry.Servings / recipe.Servings
                : 1.0;

            foreach (var ing in recipe.Ingredients)
            {
                if (ing.FoodId is null || ing.Quantity is null || ing.UnitId is null)
                {
                    // Uparsede linjer forsvinder ikke — de vises med råtekst.
                    unparsed.Add((ing.RawText, recipe.Title));
                    continue;
                }

                if (!_units.TryGetValue(ing.UnitId.Value, out var unit)) continue;

                var foodId = ing.FoodId.Value;
                if (!buckets.TryGetValue(foodId, out var bucket))
                    buckets[foodId] = bucket = new Bucket(ing.Food);

                bucket.Add(ing.Quantity.Value * scale, unit, _converter, foodId);
            }
        }

        // 4-7: spisekammer, produktopslag, pakkeantal.
        var pantryByFood = input.Pantry.ToDictionary(p => p.FoodId, p => p.State);
        var mappingsByFood = input.Mappings
            .GroupBy(m => m.FoodId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(m => m.IsPreferred).First());

        foreach (var (foodId, bucket) in buckets)
        {
            var food = bucket.Food;
            var line = new ShoppingListLine
            {
                FoodId = foodId,
                Food = food,
                NeededQuantity = bucket.BaseQuantity,
                NeededUnitId = BaseUnitIdFor(bucket.BaseType),
                NeededUnit = BaseUnitFor(bucket.BaseType),
            };

            // Spisekammervarer springes over, medmindre nogen har sagt vi løb tør.
            var isStaple = food?.IsPantryStaple == true;
            var ranOut = pantryByFood.TryGetValue(foodId, out var st) && st == PantryState.LoebetToer;
            if (isStaple && !ranOut)
            {
                line.Status = LineStatus.Spisekammer;
                list.Lines.Add(line);
                continue;
            }

            if (!bucket.IsCombinable)
            {
                line.Status = LineStatus.KanIkkeBeregnes;
                line.Warning = "Enhederne kan ikke lægges sammen for denne råvare — " +
                               "tilføj en omregning, eller tjek linjen i hånden.";
                list.Lines.Add(line);
                continue;
            }

            if (!mappingsByFood.TryGetValue(foodId, out var mapping))
            {
                line.Status = LineStatus.ManglerMapping;
                list.Lines.Add(line);
                continue;
            }

            line.ProductMappingId = mapping.Id;
            line.ProductMapping = mapping;

            // Pakkestørrelsen skal måles i SAMME enhedstype som behovet. Ellers
            // sammenligner vi æbler og pærer: en opskrift der beder om 2 dåser
            // tomat, mappet til en vare hvis pakkestørrelse blev udledt til 400 g,
            // gav før beskeden "du køber 399,92 for at bruge 2".
            if (mapping.PackageUnit is not null && mapping.PackageUnit.Type != bucket.BaseType)
            {
                line.Status = LineStatus.KanIkkeBeregnes;
                line.Warning =
                    $"Opskriften måler i {UnitWord(bucket.BaseType)}, men varen er " +
                    $"opgjort i {mapping.PackageUnit.Abbreviation}. Ret pakkestørrelsen " +
                    "på mapningen, så antallet kan beregnes.";
                list.Lines.Add(line);
                continue;
            }

            // Pakkestørrelsen er gemt i mapningens egen enhed; bring den til basis.
            var packageBase = mapping.PackageUnit is not null
                ? mapping.PackageSize * mapping.PackageUnit.ToBaseFactor
                : mapping.PackageSize;

            var pack = PackSizeMath.Compute(bucket.BaseQuantity, packageBase);
            line.PackCount = pack.PackCount;
            line.Warning = pack.Warning;

            if (input.PricesByProductId.TryGetValue(mapping.NemligProductId, out var unitPrice)
                && unitPrice is not null)
                line.EstimatedPrice = unitPrice.Value * pack.PackCount;
            // Ellers forbliver EstimatedPrice null: ukendt, ikke gratis.

            if (input.InStockByProductId.TryGetValue(mapping.NemligProductId, out var inStock)
                && !inStock)
                line.Status = LineStatus.Udsolgt;

            list.Lines.Add(line);
        }

        foreach (var (text, recipeTitle) in unparsed)
            list.Lines.Add(new ShoppingListLine
            {
                Status = LineStatus.KanIkkeBeregnes,
                UnparsedText = text,
                Warning = $"Kunne ikke læses (fra \"{recipeTitle}\") — tjek selv.",
            });

        return list;
    }

    private static string UnitWord(UnitType t) => t switch
    {
        UnitType.Mass => "vægt",
        UnitType.Volume => "rumfang",
        _ => "styk",
    };

    private Unit? BaseUnitFor(UnitType type) =>
        _units.Values.FirstOrDefault(u => u.Type == type && Math.Abs(u.ToBaseFactor - 1) < 1e-9);

    private int BaseUnitIdFor(UnitType type) => BaseUnitFor(type)?.Id ?? 0;

    /// <summary>Samler én råvares mængder på tværs af ugens opskrifter. Den første
    /// standardenhed vi ser bestemmer basistypen; resten skal kunne omregnes til den.</summary>
    private sealed class Bucket(Food? food)
    {
        public Food? Food { get; } = food;
        public double BaseQuantity { get; private set; }
        public UnitType BaseType { get; private set; } = UnitType.Count;
        public bool IsCombinable { get; private set; } = true;

        private bool _initialised;

        public void Add(double qty, Unit unit, UnitConverter converter, int foodId)
        {
            if (!_initialised)
            {
                BaseType = unit.Type;
                _initialised = true;
            }

            var inBase = converter.ToBase(qty, unit, BaseType, foodId);
            if (inBase is null)
            {
                // Vi nægter at lægge ting sammen vi ikke kan omregne. En forkert
                // sammenlægning er værre end at bede mennesket kigge på det.
                IsCombinable = false;
                return;
            }

            BaseQuantity += inBase.Value;
        }
    }
}
