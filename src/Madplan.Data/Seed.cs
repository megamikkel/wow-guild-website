using Madplan.Core.Model;
using Madplan.Core.Parsing;
using Microsoft.EntityFrameworkCore;

namespace Madplan.Data;

public static class Seed
{
    /// <summary>Densiteter for danske tørvarer, i gram pr. deciliter. Uden dem kan
    /// "2 dl mel" og "250 g mel" ikke lægges sammen, og danske opskrifter blander
    /// de to hele tiden. Listen er et startsæt — udvid når noget mangler.</summary>
    private static readonly (string Food, double GramPerDl)[] Densities =
    [
        ("hvedemel", 60), ("rugmel", 55), ("grahamsmel", 55), ("mandelmel", 45),
        ("sukker", 85), ("rørsukker", 85), ("flormelis", 55), ("brun farin", 80),
        ("havregryn", 40), ("rugflager", 40), ("müsli", 45),
        ("ris", 85), ("grødris", 85), ("couscous", 75), ("bulgur", 75),
        ("quinoa", 80), ("linser", 80), ("røde linser", 80),
        ("rasp", 45), ("kokosmel", 35), ("kakao", 40),
        ("mandler", 60), ("hasselnødder", 60), ("valnødder", 45), ("solsikkekerner", 55),
        ("rosiner", 65), ("revet ost", 40), ("parmesan", 45),
        ("kartoffelmel", 70), ("majsstivelse", 60), ("bagepulver", 55), ("salt", 120),
    ];

    /// <summary>Varer man har stående. De ryger ikke på indkøbslisten medmindre
    /// nogen markerer dem som løbet tør på spisekammer-siden.</summary>
    private static readonly string[] Staples =
    [
        "salt", "peber", "olivenolie", "rapsolie", "solsikkeolie", "smør",
        "hvedemel", "sukker", "bagepulver", "eddike", "soja", "sennep",
    ];

    public static async Task EnsureSeededAsync(MadplanDbContext db)
    {
        await db.Database.EnsureCreatedAsync();

        // WAL: to voksne skriver samtidig fra sofaen.
        await db.Database.ExecuteSqlRawAsync("PRAGMA journal_mode=WAL;");

        // Databaser oprettet af en tidligere udgave mangler kolonner der er
        // kommet til siden. Uden dette ville eneste udvej være at slette dem.
        await SchemaPatcher.ApplyAsync(db);

        if (!await db.Units.AnyAsync())
        {
            db.Units.AddRange(DanishUnits.All.Select(u => new Unit
            {
                Name = u.Name,
                Abbreviation = u.Abbrev,
                Type = u.Type,
                ToBaseFactor = u.ToBase,
                IsStandard = u.IsStandard,
            }));
            await db.SaveChangesAsync();
        }

        if (!await db.Households.AnyAsync())
        {
            db.Households.Add(new Household { Name = "Vores husstand", DefaultServings = 3 });
            await db.SaveChangesAsync();
        }

        await SeedDensitiesAsync(db);
    }

    private static async Task SeedDensitiesAsync(MadplanDbContext db)
    {
        var dl = await db.Units.FirstOrDefaultAsync(u => u.Abbreviation == "dl");
        var g = await db.Units.FirstOrDefaultAsync(u => u.Abbreviation == "g");
        if (dl is null || g is null) return;

        foreach (var (name, gramPerDl) in Densities)
        {
            var key = FoodNormalizer.Normalize(name);
            var alias = await db.FoodAliases.Include(a => a.Food)
                .FirstOrDefaultAsync(a => a.NormalizedAlias == key);

            Food food;
            if (alias?.Food is not null)
            {
                food = alias.Food;
            }
            else
            {
                food = new Food { CanonicalName = name, DefaultUnitId = g.Id };
                db.Foods.Add(food);
                await db.SaveChangesAsync();
                db.FoodAliases.Add(new FoodAlias { FoodId = food.Id, Alias = name, NormalizedAlias = key });
                await db.SaveChangesAsync();
            }

            var exists = await db.FoodUnitConversions.AnyAsync(c =>
                c.FoodId == food.Id && c.FromUnitId == dl.Id && c.ToUnitId == g.Id);
            if (!exists)
                db.FoodUnitConversions.Add(new FoodUnitConversion
                {
                    FoodId = food.Id, FromUnitId = dl.Id, ToUnitId = g.Id, Factor = gramPerDl,
                });
        }

        await db.SaveChangesAsync();

        // Klassiske spisekammervarer. Kravet er at salt, olie og mel ikke skal på
        // listen hver uge, så de OPRETTES her hvis de ikke findes — det er ikke
        // nok at markere dem der tilfældigvis stod på densitetslisten.
        foreach (var staple in Staples)
        {
            var key = FoodNormalizer.Normalize(staple);
            var alias = await db.FoodAliases.Include(a => a.Food)
                .FirstOrDefaultAsync(a => a.NormalizedAlias == key);

            if (alias?.Food is { } existing)
            {
                existing.IsPantryStaple = true;
                continue;
            }

            var food = new Food { CanonicalName = staple, IsPantryStaple = true };
            db.Foods.Add(food);
            await db.SaveChangesAsync();
            db.FoodAliases.Add(new FoodAlias { FoodId = food.Id, Alias = staple, NormalizedAlias = key });
            await db.SaveChangesAsync();
        }
        await db.SaveChangesAsync();
    }
}
