using Madplan.Core.Model;
using Madplan.Data;
using Madplan.Nemlig;
using Madplan.Recipes;
using Madplan.Web.Components;
using Madplan.Web.Services;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

// .env læses FØR builderen, så konfigurationen ser værdierne. Filen ligger ved
// siden af projektet eller i mappen man kører fra — begge dele er naturlige,
// afhængigt af om man kører «dotnet run» eller den byggede binær.
foreach (var kandidat in new[]
         {
             Path.Combine(Directory.GetCurrentDirectory(), ".env"),
             Path.Combine(AppContext.BaseDirectory, ".env"),
             Path.Combine(Directory.GetCurrentDirectory(), "..", "..", ".env"),
         })
{
    if (Madplan.Web.Services.DotEnv.Load(Path.GetFullPath(kandidat)) > 0) break;
}

var builder = WebApplication.CreateBuilder(args);

// Diagnosen skal kunne læses. Uden dette fletter HttpClient-logningen sig ind
// mellem linjerne og gør outputtet ubrugeligt som fejlrapport.
// ClearProviders, ikke SetMinimumLevel: niveauet i appsettings.json vinder over
// et kald her, og så flettede HttpClient-logningen sig alligevel ind.
// Diagnosen skriver selv til konsollen og fanger sine egne fejl.
if (args.Contains("smoke", StringComparer.OrdinalIgnoreCase)) builder.Logging.ClearProviders();

// Miljøvariabler vinder over appsettings. Kodeord hører kun hjemme dér.
builder.Configuration.AddEnvironmentVariables();

var dbPath = builder.Configuration["MADPLAN_DB_PATH"] ?? "madplan.db";
builder.Services.AddDbContext<MadplanDbContext>(o => o.UseSqlite($"Data Source={dbPath}"));

builder.Services.AddRazorComponents().AddInteractiveServerComponents();

// Cookie-auth. Ingen offentlig registrering — brugerne seedes fra konfiguration.
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(o =>
    {
        o.LoginPath = "/login";
        o.LogoutPath = "/logout";
        o.ExpireTimeSpan = TimeSpan.FromDays(30);
        o.SlidingExpiration = true;
        o.Cookie.HttpOnly = true;
        o.Cookie.SameSite = SameSiteMode.Lax;
    });
builder.Services.AddAuthorization();
builder.Services.AddCascadingAuthenticationState();
builder.Services.AddSingleton<IPasswordHasher<AppUser>, PasswordHasher<AppUser>>();

builder.Services.AddNemlig(builder.Configuration);
builder.Services.AddScoped<ProductSuggester>();
builder.Services.AddScoped<AutoMapper>();
builder.Services.AddScoped<RecipeImportService>();
builder.Services.AddScoped<MenuService>();
builder.Services.AddSingleton<RecipeExtractor>();
builder.Services.AddHttpClient<RecipeFetcher>(c =>
{
    c.Timeout = TimeSpan.FromSeconds(20);
    // Vi siger hvem vi er. En privat husstand der importerer et par opskrifter
    // har ingen grund til at skjule sig.
    c.DefaultRequestHeaders.UserAgent.ParseAdd("madplan-nemlig/1.0 (privat husstandsbrug)");
});
builder.Services.AddScoped<FoodResolver>();
builder.Services.AddScoped<MealPlanService>();
builder.Services.AddSingleton<PriceRefreshService>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<PriceRefreshService>());
builder.Services.AddHttpContextAccessor();

var app = builder.Build();

// «dotnet run -- smoke» kører nemlig-diagnosen og afslutter uden at starte
// webserveren. Den skal kunne køres før hver planlægningsuge.
if (args.Contains("smoke", StringComparer.OrdinalIgnoreCase))
{
    using var smokeScope = app.Services.CreateScope();
    return await SmokeTest.RunAsync(smokeScope.ServiceProvider, Console.Out);
}

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<MadplanDbContext>();
    await Seed.EnsureSeededAsync(db);
    await UserSeed.EnsureUsersAsync(db,
        scope.ServiceProvider.GetRequiredService<IPasswordHasher<AppUser>>(),
        app.Configuration,
        scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("UserSeed"));
}

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    app.UseHsts();
}

app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();
app.UseAntiforgery();

app.MapRazorComponents<App>().AddInteractiveServerRenderMode();
app.MapLoginEndpoints();

app.Run();
return 0;
