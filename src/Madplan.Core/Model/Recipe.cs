namespace Madplan.Core.Model;

public class Recipe
{
    public int Id { get; set; }
    public int HouseholdId { get; set; }

    public string Title { get; set; } = "";
    public int Servings { get; set; } = 4;
    public int? TotalTimeMinutes { get; set; }
    public string? Instructions { get; set; }
    public string? ImageUrl { get; set; }

    // Attribution. Krav fra docs/opskriftskilder.md §7 — gemmes altid, vises altid.
    public string? SourceUrl { get; set; }
    public string? SourceName { get; set; }
    public string? Attribution { get; set; }

    /// <summary>Sand for familiens egne retter. De importerede har en kilde.</summary>
    public bool IsOwn { get; set; } = true;

    public bool IsChildFriendly { get; set; }
    public bool IsVegetarian { get; set; }

    public int? CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CachedAt { get; set; }

    public List<RecipeIngredient> Ingredients { get; set; } = [];
}

public class RecipeIngredient
{
    public int Id { get; set; }
    public int RecipeId { get; set; }
    public Recipe? Recipe { get; set; }

    /// <summary>Linjen præcis som den blev skrevet eller importeret. Gemmes ALTID,
    /// også når parsingen lykkes — det er den eneste kilde til at forstå en forkert
    /// mængde, og den lader os køre en forbedret parser igen over gammelt data.</summary>
    public string RawText { get; set; } = "";

    // Alle tre er nullable med vilje: en uparset linje er en gyldig tilstand.
    public double? Quantity { get; set; }
    public int? UnitId { get; set; }
    public Unit? Unit { get; set; }
    public int? FoodId { get; set; }
    public Food? Food { get; set; }

    public string? Note { get; set; }
    public int SortOrder { get; set; }
}
