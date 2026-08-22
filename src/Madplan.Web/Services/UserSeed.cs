using Madplan.Core.Model;
using Madplan.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Madplan.Web.Services;

/// <summary>Opretter husstandens to brugere fra konfiguration. Der er ingen
/// offentlig registrering — hverken skjult i UI'et eller til stede i koden.</summary>
public static class UserSeed
{
    public static async Task EnsureUsersAsync(MadplanDbContext db, IPasswordHasher<AppUser> hasher,
                                              IConfiguration config, ILogger log)
    {
        var household = await db.Households.FirstAsync();

        // MADPLAN_USERS: "navn:email:kodeord;navn:email:kodeord"
        var spec = config["MADPLAN_USERS"];
        if (string.IsNullOrWhiteSpace(spec))
        {
            if (!await db.Users.AnyAsync())
                log.LogWarning(
                    "Ingen brugere er oprettet. Sæt MADPLAN_USERS i .env " +
                    "(format: \"Navn:email:kodeord;Navn2:email2:kodeord2\") og genstart.");
            return;
        }

        foreach (var entry in spec.Split(';', StringSplitOptions.RemoveEmptyEntries))
        {
            var parts = entry.Split(':', 3);
            if (parts.Length != 3)
            {
                log.LogWarning("Springer ugyldig MADPLAN_USERS-post over: forventede navn:email:kodeord.");
                continue;
            }

            var (name, email, password) = (parts[0].Trim(), parts[1].Trim().ToLowerInvariant(), parts[2]);
            if (await db.Users.AnyAsync(u => u.Email == email)) continue;

            var user = new AppUser { HouseholdId = household.Id, Email = email, DisplayName = name };
            user.PasswordHash = hasher.HashPassword(user, password);
            db.Users.Add(user);
            log.LogInformation("Oprettede bruger {Email}.", email);
        }

        await db.SaveChangesAsync();
    }
}
