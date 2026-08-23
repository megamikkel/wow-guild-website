using System.Diagnostics;
using Madplan.Nemlig;
using Madplan.Nemlig.Contracts;

namespace Madplan.Web.Services;

/// <summary>Kører nemlig-integrationen igennem trin for trin og fortæller hvad
/// der virkede.
///
/// Det er den verifikation der aldrig blev lavet: klienten er skrevet mod
/// dokumenterede skemaer og har aldrig talt med den rigtige server. Fejler noget,
/// siger den hvad og hvor — i stedet for at appen bare viser tomme priser.
///
/// Kør før hver planlægningsuge. Fejler den, ved I det FØR I står med en tom
/// liste søndag aften.</summary>
public static class SmokeTest
{
    public static async Task<int> RunAsync(IServiceProvider services, TextWriter output)
    {
        var auth = services.GetRequiredService<INemligAuth>();
        var catalog = services.GetRequiredService<INemligCatalog>();

        output.WriteLine();
        output.WriteLine("  Nemlig-diagnose");
        output.WriteLine("  ───────────────────────────────────────────────");

        if (!auth.IsConfigured)
        {
            output.WriteLine("  ✗  Ingen credentials.");
            output.WriteLine();
            output.WriteLine("     Sæt NEMLIG_USERNAME og NEMLIG_PASSWORD i .env og prøv igen.");
            output.WriteLine("     Appen kører fint uden — men uden priser.");
            output.WriteLine();
            return 1;
        }

        var fejl = 0;

        // 1-3: hele auth-kæden i ét, fordi den kun giver mening samlet.
        var session = await StepAsync(output, "Login (XSRF → token → login)", async () =>
        {
            var s = await auth.GetSessionAsync();
            return ($"token udløber om {(s.TokenExpiresAt - DateTimeOffset.UtcNow).TotalSeconds:0} s", s);
        });
        if (session is null) fejl++;

        // 4: søgning. Den mest volatile flade — egen vært, egen gateway.
        var produkter = await StepAsync(output, "Produktsøgning («mælk»)", async () =>
        {
            var p = await catalog.SearchAsync("mælk", 5);
            if (p.Count == 0) throw new InvalidOperationException("nul resultater");
            return ($"{p.Count} varer, billigst {p.Min(x => x.Price):N2} kr.", p);
        });
        if (produkter is null) fejl++;

        // 5: felterne vi faktisk regner på. En tom pris er værre end en fejl,
        // fordi den ser ud som om alt virker.
        if (produkter is { Count: > 0 })
        {
            var p = produkter[0];
            output.WriteLine($"     ↳ «{p.Name}»");
            Field(output, "Price", p.Price > 0, $"{p.Price:N2} kr.");
            Field(output, "UnitPrice", p.UnitPrice is > 0, $"{p.UnitPrice:N2} {p.UnitPriceLabel}");
            Field(output, "Url", !string.IsNullOrEmpty(p.Url), p.Url ?? "MANGLER");
            Field(output, "Description", !string.IsNullOrEmpty(p.Description), p.Description ?? "—");

            var pakke = p.GuessPackageSize();
            Field(output, "Pakkestørrelse", pakke is not null,
                pakke is null ? "kunne ikke udledes" : $"{pakke.Value.Size:0.##} {pakke.Value.Unit}");

            if (string.IsNullOrEmpty(p.Url))
            {
                output.WriteLine("     ⚠  Uden Url kan den daglige prisopdatering ikke slå varen op.");
                fejl++;
            }

            // 6: produktdetaljer via varens egen sti — vejen prisopdateringen bruger.
            var detail = await StepAsync(output, "Produktdetaljer via URL", async () =>
            {
                var d = await catalog.GetProductAsync(p.Id, p.Url, forceRefresh: true);
                if (d is null) throw new InvalidOperationException("intet svar");
                return ($"{d.Product.Name} til {d.Product.Price:N2} kr.", d);
            });
            if (detail is null) fejl++;
        }

        output.WriteLine("  ───────────────────────────────────────────────");
        if (fejl == 0)
        {
            output.WriteLine("  Alt virker. Priser og budgetmenu kan bruges.");
        }
        else
        {
            output.WriteLine($"  {fejl} ting fejlede.");
            output.WriteLine();
            output.WriteLine("  Nemligs API er udokumenteret og kan ændre sig uden varsel.");
            output.WriteLine("  Send outputtet her videre — så kan fejlen findes ét sted:");
            output.WriteLine("  src/Madplan.Nemlig/NemligClient.cs");
        }
        output.WriteLine();
        return fejl == 0 ? 0 : 1;
    }

    private static async Task<T?> StepAsync<T>(
        TextWriter output, string navn, Func<Task<(string Detail, T Value)>> step) where T : class
    {
        var sw = Stopwatch.StartNew();
        try
        {
            var (detail, value) = await step();
            output.WriteLine($"  ✓  {navn} — {detail} ({sw.ElapsedMilliseconds} ms)");
            return value;
        }
        catch (NemligUnavailableException ex)
        {
            output.WriteLine($"  ✗  {navn}");
            output.WriteLine($"     {ex.Reason}: {ex.Message}");
            return null;
        }
        catch (Exception ex)
        {
            output.WriteLine($"  ✗  {navn}");
            output.WriteLine($"     {ex.GetType().Name}: {ex.Message}");
            return null;
        }
    }

    private static void Field(TextWriter output, string navn, bool ok, string vaerdi) =>
        output.WriteLine($"        {(ok ? "✓" : "✗")} {navn,-16} {vaerdi}");
}
