using Madplan.Core.Model;

namespace Madplan.Core.Planning;

/// <summary>Hvad koster hver ret pr. portion?
///
/// Tallet regnes som RÅVAREPRIS: mængden retten bruger, ganget med varens
/// kilopris. Ikke som hele pakker. Det er med vilje, og det er den eneste
/// måde tallene kan sammenlignes på: køber man ind til én ret ad gangen,
/// koster en teskefuld karry en hel krukke, og retten ville se ud til at
/// koste 40 kr. mere end den gør. Resten af krukken bruges næste uge.
///
/// Prisen er derfor en INDIKATION og ikke hvad kurven kommer til at vise.
/// Det man faktisk betaler er hele pakker, aggregeret over hele ugen — det
/// regner <see cref="ShoppingListBuilder"/>, og det er det tal budgettet
/// skal holdes op imod. Rangeringen her svarer på «hvilke retter er billige
/// pr. portion», ikke «hvad koster ugen».
///
/// Retter hvor noget mangler en pris rangeres ikke som billige. En ukendt
/// pris er ikke nul; den er ukendt, og listen siger det.</summary>
public class RecipeCosting(ShoppingListBuilder builder)
{
    public record Cost(
        Recipe Recipe,
        decimal? PerServing,
        decimal? Total,
        int UnknownIngredients)
    {
        /// <summary>Sand når hele retten kan prissættes. Kun de kan sorteres
        /// meningsfuldt efter pris.</summary>
        public bool FullyPriced => UnknownIngredients == 0 && PerServing is not null;
    }

    /// <summary>Prissætter hver ret for sig og sorterer de fuldt kendte
    /// billigst først. Retter med ukendte poster lægges bagest — ikke skjult,
    /// for man skal kunne se hvad der mangler, men heller ikke øverst hvor de
    /// ville ligne et godt tilbud.</summary>
    public IReadOnlyList<Cost> RankByPricePerServing(
        IEnumerable<Recipe> recipes, int servings, ShoppingListBuilder.Input context)
    {
        var costs = recipes.Select(r => For(r, servings, context)).ToList();

        return
        [
            .. costs.Where(c => c.FullyPriced).OrderBy(c => c.PerServing),
            .. costs.Where(c => !c.FullyPriced)
                    .OrderBy(c => c.UnknownIngredients)
                    .ThenBy(c => c.Recipe.Title),
        ];
    }

    public Cost For(Recipe recipe, int servings, ShoppingListBuilder.Input context)
    {
        var entry = new MealPlanEntry
        {
            Recipe = recipe,
            RecipeId = recipe.Id,
            Servings = servings,
            Date = DateOnly.FromDateTime(DateTime.Today),
        };

        // Vi låner indkøbslistens maskineri for at få skalering, spisekammer og
        // enhedsomregning gratis — men bruger linjernes MÆNGDE, ikke deres
        // pakkeantal, til prisen.
        var list = builder.Build(new MealPlan(), context with { Entries = [entry] });

        var ukendte = 0;
        decimal total = 0m;

        foreach (var line in list.Lines)
        {
            if (line.Status is LineStatus.ManglerMapping or LineStatus.KanIkkeBeregnes)
            {
                ukendte++;
                continue;
            }

            // Spisekammervarer (salt, olie) er der i forvejen og koster ikke
            // noget ekstra ved denne ret. De tælles heller ikke som ukendte.
            if (!line.Included) continue;

            var perBase = PricePerBaseUnit(line.ProductMapping, context);
            if (perBase is null)
            {
                ukendte++;
                continue;
            }

            total += perBase.Value * (decimal)line.NeededQuantity;
        }

        // Er der ukendte poster, er totalen et gulv og ikke en pris. Så vises
        // den ikke som en pris — det ville invitere til at sammenligne den med
        // en rigtig én.
        if (ukendte > 0)
            return new Cost(recipe, null, null, ukendte);

        return new Cost(
            recipe,
            servings > 0 ? total / servings : null,
            total,
            0);
    }

    /// <summary>Kiloprisen — eller literprisen, eller stykprisen — omregnet til
    /// den basisenhed indkøbslisten regner i. Null når vi ikke kender prisen
    /// eller pakkestørrelsen, og null betyder ukendt, ikke gratis.</summary>
    private static decimal? PricePerBaseUnit(
        ProductMapping? mapping, ShoppingListBuilder.Input context)
    {
        if (mapping is null) return null;

        if (!context.PricesByProductId.TryGetValue(mapping.NemligProductId, out var pris)
            || pris is null)
            return null;

        var pakkeBasis = mapping.PackageUnit is not null
            ? mapping.PackageSize * mapping.PackageUnit.ToBaseFactor
            : mapping.PackageSize;

        if (pakkeBasis <= 0) return null;

        return pris.Value / (decimal)pakkeBasis;
    }
}
