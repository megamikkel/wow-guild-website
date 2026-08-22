using Madplan.Core.Model;
using Madplan.Data;
using Madplan.Nemlig;
using Madplan.Web.Components;
using Madplan.Web.Services;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

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
builder.Services.AddScoped<BasketSyncService>();
builder.Services.AddScoped<ProductSuggester>();
builder.Services.AddScoped<FoodResolver>();
builder.Services.AddScoped<MealPlanService>();
builder.Services.AddSingleton<PriceRefreshService>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<PriceRefreshService>());
builder.Services.AddHttpContextAccessor();

var app = builder.Build();

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
