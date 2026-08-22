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

    /// <summary>Portioner for netop denne dag. Dobbelt portion mandag og normal
    /// onsdag er det normale, så antallet hører til her og ikke på opskriften.</summary>
    public int Servings { get; set; } = 3;
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
