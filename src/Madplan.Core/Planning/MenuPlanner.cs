using Madplan.Core.Model;

namespace Madplan.Core.Planning;

/// <summary>Sammensætter en ugemenu der holder sig inden for et budget.
///
/// Den svære del er ikke at vælge retter — det er at prissætte dem. Prisen på en
/// menu er IKKE summen af retternes priser, af to grunde:
///
///   1. Deler to retter en råvare, købes den én gang. To retter med hakket
///      oksekød koster ikke to pakker hvis én rækker.
///   2. Pakkestørrelser runder op. 300 g pasta og 400 g pasta i hver sin ret
///      er stadig én pose á 500 g, ikke to.
///
/// Derfor prissætter denne klasse hver kandidatmenu ved at køre den gennem den
/// RIGTIGE <see cref="ShoppingListBuilder"/> frem for at lægge tal sammen.
/// Det er langsommere, og det er den eneste måde at få et tal man kan stole på.
///
/// Algoritmen er bevidst simpel: byg mange kandidatmenuer med tilfældigt startpunkt
/// og grådig udvidelse, prissæt dem alle, behold den bedste. Til 5–7 retter ud af
/// nogle hundrede opskrifter er det rigeligt, og det er til at forstå om et halvt
/// år. En rigtig optimering ville være at løse et knapsack-problem; det ville
/// være dyrere at vedligeholde end det er værd her.</summary>
public class MenuPlanner(ShoppingListBuilder builder)
{
    public record Request(
        decimal Budget,
        int Meals,
        int Servings,
        IReadOnlyList<Recipe> Candidates,
        /// <summary>Retter fra de seneste uger, som nedprioriteres — så I ikke
        /// får spaghetti tre uger i træk.</summary>
        IReadOnlyCollection<int> RecentRecipeIds,
        int? MaxMinutes = null,
        bool ChildFriendlyOnly = false,
        bool VegetarianOnly = false);

    public record Menu(
        IReadOnlyList<Recipe> Recipes,
        decimal Cost,
        bool WithinBudget,
        int UnpricedIngredients)
    {
        public decimal CostPerServing(int servings, int meals) =>
            servings * meals == 0 ? 0 : Cost / (servings * meals);
    }

    /// <summary>Antal kandidatmenuer der bygges og prissættes. Højere giver et
    /// lidt bedre resultat og en langsommere knap.</summary>
    private const int Attempts = 40;

    // Om ukendte priser
    //
    // En råvare uden pris tæller som nul i den beregnede sum. Lader man det stå,
    // vælger generatoren systematisk de retter den ved MINDST om: fem middage
    // til tre personer for 60 kr., fordi halvdelen af ingredienserne manglede en
    // vare. «Ukendt» ser ud som «gratis», og det er den værste slags fejl — den
    // ser rigtig ud.
    //
    // Løsningen er ikke at gætte en pris for de ukendte. Det ville bare være et
    // andet forkert tal. En menu med ukendte poster har en ukendt pris, og den
    // kan ikke sammenlignes på beløb med en menu hvor alt er kendt. Derfor
    // rangeres der først på HVOR MEGET VI VED, og først derefter på pris.

    public Menu Plan(Request request, ShoppingListBuilder.Input pricingContext, Random? rng = null)
    {
        rng ??= new Random();

        var pool = request.Candidates
            .Where(r => !request.ChildFriendlyOnly || r.IsChildFriendly)
            .Where(r => !request.VegetarianOnly || r.IsVegetarian)
            .Where(r => request.MaxMinutes is null || r.TotalTimeMinutes is null
                     || r.TotalTimeMinutes <= request.MaxMinutes)
            .ToList();

        if (pool.Count == 0 || request.Meals <= 0)
            return new Menu([], 0m, true, 0);

        Menu? best = null;

        for (var attempt = 0; attempt < Attempts; attempt++)
        {
            var menu = BuildCandidate(pool, request, pricingContext, rng);
            if (menu.Recipes.Count == 0) continue;

            if (best is null || Better(menu, best)) best = menu;

            // Rammer vi budgettet med fuldt antal retter OG kender alle priser,
            // er der ikke meget mere at hente ved at blive ved.
            if (best.WithinBudget && best.Recipes.Count == request.Meals
                && best.UnpricedIngredients == 0 && attempt > 10) break;
        }

        return best ?? new Menu([], 0m, true, 0);
    }

    /// <summary>Bygger én kandidat: start med en tilfældig ret, og tilføj den ret
    /// der giver den mindste MERPRIS pr. gang. Merprisen er nøglen — en ret der
    /// genbruger råvarer fra dem vi allerede har valgt, koster næsten ingenting
    /// ekstra, og det er præcis den slags menu vi leder efter.</summary>
    private Menu BuildCandidate(
        List<Recipe> pool, Request request, ShoppingListBuilder.Input ctx, Random rng)
    {
        // Retter vi har spist for nylig lægges bagerst i puljen, ikke fjernes:
        // er budgettet stramt, er en gentagelse bedre end ingen menu.
        var ordered = pool
            .OrderBy(r => request.RecentRecipeIds.Contains(r.Id) ? 1 : 0)
            .ThenBy(_ => rng.Next())
            .ToList();

        var chosen = new List<Recipe> { ordered[0] };
        var current = Price(chosen, request, ctx);

        while (chosen.Count < request.Meals)
        {
            Recipe? bedste = null;
            var bedsteUkendte = int.MaxValue;
            var bedstePris = decimal.MaxValue;
            (decimal Cost, int Unpriced) bedsteResultat = default;

            // Kig kun på et udsnit. At prissætte hele puljen for hver plads ville
            // gøre knappen ubrugeligt langsom, og udsnittet er tilfældigt hver gang.
            foreach (var kandidat in ordered.Where(r => !chosen.Contains(r)).Take(12))
            {
                var forsøg = new List<Recipe>(chosen) { kandidat };
                var (cost, unpriced) = Price(forsøg, request, ctx);

                // To tal, i rækkefølge: hvor mange nye ukendte priser retten
                // trækker med sig, og hvad den koster oveni. En ret hvis
                // ingredienser vi ikke kender prisen på ville ellers altid være
                // den billigste at tilføje, og menuen fyldtes med det vi ved
                // mindst om.
                var nyeUkendte = unpriced - current.Unpriced;
                var merpris = cost - current.Cost;

                if (nyeUkendte < bedsteUkendte
                    || (nyeUkendte == bedsteUkendte && merpris < bedstePris))
                {
                    bedsteUkendte = nyeUkendte;
                    bedstePris = merpris;
                    bedste = kandidat;
                    bedsteResultat = (cost, unpriced);
                }
            }

            if (bedste is null) break;

            // Ville retten sprænge budgettet, stopper vi med færre retter frem for
            // at levere en menu I ikke har råd til.
            if (bedsteResultat.Cost > request.Budget && chosen.Count >= 1) break;

            chosen.Add(bedste);
            current = bedsteResultat;
        }

        return new Menu(chosen, current.Cost, current.Cost <= request.Budget, current.Unpriced);
    }

    /// <summary>Prissætter et sæt retter ved at bygge den rigtige indkøbsliste.</summary>
    private (decimal Cost, int Unpriced) Price(
        List<Recipe> recipes, Request request, ShoppingListBuilder.Input ctx)
    {
        var entries = recipes.Select((r, i) => new MealPlanEntry
        {
            Recipe = r,
            RecipeId = r.Id,
            Servings = request.Servings,
            Date = DateOnly.FromDateTime(DateTime.Today).AddDays(i),
        }).ToList();

        var list = builder.Build(new MealPlan(), ctx with { Entries = entries });

        // Alt vi ikke kan sætte en pris på tæller med her — ikke kun linjer der
        // ER prissat med en tom pris.
        //
        // En ingrediens uden en vare får status ManglerMapping og tælles hverken
        // i summen eller som «Included». Talte vi kun de sidste, ville en ret
        // hvis råvarer slet ikke er koblet se både billig OG fuldt oplyst ud —
        // den værste kombination, for så er der intet at advare om.
        var ukendte = list.Lines.Count(l =>
            l.Status is LineStatus.ManglerMapping or LineStatus.KanIkkeBeregnes
            || (l.Included && l.EstimatedPrice is null));

        return (list.KnownTotal, ukendte);
    }

    /// <summary>Hvilken af to menuer er bedst? Fire kriterier, i rækkefølge:
    ///
    ///   1. Inden for budgettet
    ///   2. Flest retter — det var det der blev bedt om
    ///   3. Færrest ukendte priser
    ///   4. Billigst
    ///
    /// Punkt 3 står FØR pris med vilje. En menu til 60 kr. hvor halvdelen af
    /// ingredienserne mangler en pris er ikke billigere end en til 350 kr. hvor
    /// alt er kendt — den er bare dårligere belyst, og budgetløftet er kun
    /// noget værd hvis tallet betyder noget.</summary>
    private static bool Better(Menu a, Menu b)
    {
        if (a.WithinBudget != b.WithinBudget) return a.WithinBudget;
        if (a.Recipes.Count != b.Recipes.Count) return a.Recipes.Count > b.Recipes.Count;
        if (a.UnpricedIngredients != b.UnpricedIngredients)
            return a.UnpricedIngredients < b.UnpricedIngredients;
        return a.Cost < b.Cost;
    }
}
