namespace Madplan.Core.Model;

public class MealPlan
{
    public int Id { get; set; }
    public int HouseholdId { get; set; }

    // ISO-uge. Unikt indeks på (HouseholdId, IsoYear, IsoWeek).
    public int IsoYear { get; set; }
    public int IsoWeek { get; set; }
    public string? Notes { get; set; }

    public List<MealPlanEntry> Entries { get; set; } = [];
}

public class MealPlanEntry
{
    public int Id { get; set; }
    public int MealPlanId { get; set; }
    public MealPlan? MealPlan { get; set; }

    public DateOnly Date { get; set; }
    public int RecipeId { get; set; }
    public Recipe? Recipe { get; set; }

    /// <summary>Portioner PR. DAG. Dobbelt portion mandag og normal onsdag er
    /// det normale, så antallet hører til her og ikke på opskriften.</summary>
    public int Servings { get; set; } = 3;

    /// <summary>Hvor mange dage retten dækker. 1 er en almindelig aften; 3 vil
    /// sige at man laver en stor portion mandag og spiser rester tirsdag og onsdag.
    ///
    /// Modelleret som ÉT tal på ÉN række frem for at oprette rester-rækker på de
    /// følgende dage. Rester-rækker ville skulle udelades fra indkøbslisten for
    /// ikke at købe ind til samme måltid tre gange — og den slags «tæl ikke den
    /// her med»-regler er præcis hvor stille fejl bor. Her følger indkøbet
    /// automatisk: der købes til <see cref="Servings"/> × <see cref="CoversDays"/>.</summary>
    public int CoversDays { get; set; } = 1;

    /// <summary>Dagene retten dækker, inklusive tilberedningsdagen.</summary>
    public IEnumerable<DateOnly> Dates =>
        Enumerable.Range(0, Math.Max(1, CoversDays)).Select(Date.AddDays);

    public bool IsLeftoverOn(DateOnly day) => day > Date && Dates.Contains(day);
}

/// <summary>Overstyrer <see cref="Food.IsPantryStaple"/> for en konkret vare.
/// "Vi har normalt mel, men vi løb tør."</summary>
public class PantryItem
{
    public int Id { get; set; }
    public int HouseholdId { get; set; }
    public int FoodId { get; set; }
    public Food? Food { get; set; }

    public PantryState State { get; set; } = PantryState.Har;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public enum PantryState { Har, LoebetToer }
