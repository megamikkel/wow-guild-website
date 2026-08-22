namespace Madplan.Core.Model;

/// <summary>En husstand. Der er én i praksis, men modellen bærer den eksplicit,
/// så alt data har en ejer og et fremtidigt "del med nogen" ikke kræver migration.</summary>
public class Household
{
    public int Id { get; set; }
    public string Name { get; set; } = "Vores husstand";
    public int DefaultServings { get; set; } = 3;

    public List<AppUser> Users { get; set; } = [];
}

public class AppUser
{
    public int Id { get; set; }
    public int HouseholdId { get; set; }
    public string Email { get; set; } = "";
    public string DisplayName { get; set; } = "";
    /// <summary>PBKDF2 via ASP.NET Core PasswordHasher. Aldrig et klartekstkodeord.</summary>
    public string PasswordHash { get; set; } = "";
}
