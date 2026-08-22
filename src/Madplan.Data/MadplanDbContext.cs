using Madplan.Core.Model;
using Microsoft.EntityFrameworkCore;

namespace Madplan.Data;

public class MadplanDbContext(DbContextOptions<MadplanDbContext> options) : DbContext(options)
{
    public DbSet<Household> Households => Set<Household>();
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Food> Foods => Set<Food>();
    public DbSet<FoodAlias> FoodAliases => Set<FoodAlias>();
    public DbSet<Unit> Units => Set<Unit>();
    public DbSet<FoodUnitConversion> FoodUnitConversions => Set<FoodUnitConversion>();
    public DbSet<Recipe> Recipes => Set<Recipe>();
    public DbSet<RecipeIngredient> RecipeIngredients => Set<RecipeIngredient>();
    public DbSet<MealPlan> MealPlans => Set<MealPlan>();
    public DbSet<MealPlanEntry> MealPlanEntries => Set<MealPlanEntry>();
    public DbSet<PantryItem> PantryItems => Set<PantryItem>();
    public DbSet<ProductMapping> ProductMappings => Set<ProductMapping>();
    public DbSet<ProductSnapshot> ProductSnapshots => Set<ProductSnapshot>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<AppUser>(e =>
        {
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.Email).IsRequired();
        });

        b.Entity<Food>(e =>
        {
            e.Property(x => x.CanonicalName).IsRequired();
            e.HasOne(x => x.DefaultUnit).WithMany().HasForeignKey(x => x.DefaultUnitId)
                .OnDelete(DeleteBehavior.SetNull);
            e.HasMany(x => x.Aliases).WithOne(a => a.Food!).HasForeignKey(a => a.FoodId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Opslagsnøglen skal være unik på tværs af ALLE råvarer — det er den
        // regel der forhindrer at "oksefars" peger to steder hen.
        b.Entity<FoodAlias>().HasIndex(x => x.NormalizedAlias).IsUnique();

        b.Entity<Unit>().HasIndex(x => x.Abbreviation).IsUnique();

        b.Entity<FoodUnitConversion>(e =>
        {
            e.HasOne(x => x.FromUnit).WithMany().HasForeignKey(x => x.FromUnitId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.ToUnit).WithMany().HasForeignKey(x => x.ToUnitId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.FoodId, x.FromUnitId, x.ToUnitId }).IsUnique();
        });

        b.Entity<Recipe>(e =>
        {
            e.Property(x => x.Title).IsRequired();
            e.HasMany(x => x.Ingredients).WithOne(i => i.Recipe!).HasForeignKey(i => i.RecipeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<RecipeIngredient>(e =>
        {
            e.Property(x => x.RawText).IsRequired();
            e.HasOne(x => x.Unit).WithMany().HasForeignKey(x => x.UnitId)
                .OnDelete(DeleteBehavior.SetNull);
            e.HasOne(x => x.Food).WithMany().HasForeignKey(x => x.FoodId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // Én madplan pr. husstand pr. ISO-uge.
        b.Entity<MealPlan>(e =>
        {
            e.HasIndex(x => new { x.HouseholdId, x.IsoYear, x.IsoWeek }).IsUnique();
            e.HasMany(x => x.Entries).WithOne(i => i.MealPlan!).HasForeignKey(i => i.MealPlanId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<MealPlanEntry>()
            .HasOne(x => x.Recipe).WithMany().HasForeignKey(x => x.RecipeId)
            .OnDelete(DeleteBehavior.Cascade);

        b.Entity<PantryItem>(e =>
        {
            e.HasIndex(x => new { x.HouseholdId, x.FoodId }).IsUnique();
            e.HasOne(x => x.Food).WithMany().HasForeignKey(x => x.FoodId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<ProductMapping>(e =>
        {
            e.HasIndex(x => new { x.FoodId, x.NemligProductId }).IsUnique();
            e.HasOne(x => x.Food).WithMany(f => f.Mappings).HasForeignKey(x => x.FoodId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.PackageUnit).WithMany().HasForeignKey(x => x.PackageUnitId)
                .OnDelete(DeleteBehavior.Restrict);
            e.Property(x => x.NemligProductId).IsRequired();
        });

        // Observationer, ikke overskrivning: grundlaget for prishistorik senere.
        b.Entity<ProductSnapshot>(e =>
        {
            e.HasIndex(x => new { x.NemligProductId, x.ObservedAt });
            e.Property(x => x.Price).HasPrecision(10, 2);
            e.Property(x => x.UnitPrice).HasPrecision(10, 2);
        });

    }
}
