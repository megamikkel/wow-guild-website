namespace Madplan.Recipes;

/// <summary>En opskrift læst fra en webside. Bevidst uafhængig af vores
/// domænemodel: dette projekt kender hverken EF eller nemlig, og kan testes
/// mod gemt HTML uden at noget andet skal være på plads.</summary>
public record ScrapedRecipe(
    string Title,
    IReadOnlyList<string> Ingredients,
    string? Instructions,
    int? Servings,
    int? TotalMinutes,
    string? ImageUrl,
    string SourceUrl,
    string SourceName,
    string? Author,
    IReadOnlyList<string> Categories)
{
    public bool LooksUsable => Title.Length > 0 && Ingredients.Count > 0;

    /// <summary>Attribution som den vises i UI'et. Ophavsretskravet fra
    /// docs/opskriftskilder.md §7: vi cacher til privat brug og krediterer altid.</summary>
    public string Attribution => Author is { Length: > 0 }
        ? $"{Author}, {SourceName}"
        : SourceName;
}
