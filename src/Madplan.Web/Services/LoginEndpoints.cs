using System.Security.Claims;
using Madplan.Core.Model;
using Madplan.Data;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Madplan.Web.Services;

/// <summary>Login og logout som almindelige form-posts. Blazor Servers
/// SignalR-kredsløb kan ikke sætte cookies, så autentificering skal gå gennem
/// en rigtig HTTP-request.</summary>
public static class LoginEndpoints
{
    public static void MapLoginEndpoints(this WebApplication app)
    {
        app.MapPost("/login", async (
            HttpContext http,
            [FromForm] string email,
            [FromForm] string password,
            [FromForm] string? returnUrl,
            MadplanDbContext db,
            IPasswordHasher<AppUser> hasher) =>
        {
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email.Trim().ToLowerInvariant());

            // Samme svar uanset om brugeren findes: ellers kan man regne ud
            // hvilke mailadresser der er oprettet.
            var ok = user is not null &&
                     hasher.VerifyHashedPassword(user, user.PasswordHash, password)
                         is PasswordVerificationResult.Success or PasswordVerificationResult.SuccessRehashNeeded;

            if (!ok) return Results.Redirect("/login?fejl=1");

            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user!.Id.ToString()),
                new(ClaimTypes.Name, user.DisplayName),
                new(ClaimTypes.Email, user.Email),
                new("HouseholdId", user.HouseholdId.ToString()),
            };

            await http.SignInAsync(
                CookieAuthenticationDefaults.AuthenticationScheme,
                new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme)),
                new AuthenticationProperties { IsPersistent = true });

            return Results.Redirect(IsLocal(returnUrl) ? returnUrl! : "/");
        }).DisableAntiforgery();

        app.MapPost("/logout", async (HttpContext http) =>
        {
            await http.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Results.Redirect("/login");
        }).DisableAntiforgery();
    }

    /// <summary>Kun relative stier. Ellers er returnUrl en open redirect.</summary>
    private static bool IsLocal(string? url) =>
        !string.IsNullOrEmpty(url) && url.StartsWith('/') && !url.StartsWith("//");
}
