using System.Diagnostics;
using System.Text.Json.Nodes;
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
    public static async Task<int> RunAsync(
        IServiceProvider services, TextWriter output, DotEnv.Result? dotEnv = null)
    {
        var auth = services.GetRequiredService<INemligAuth>();
        var catalog = services.GetRequiredService<INemligCatalog>();

        output.WriteLine();
        output.WriteLine("  Nemlig-diagnose");
        output.WriteLine("  ───────────────────────────────────────────────");

        // Hvor kom indstillingerne fra? Det er det første man vil vide når noget
        // ikke virker, og det er billigt at sige.
        if (dotEnv is not null)
        {
            if (dotEnv.Found)
            {
                output.WriteLine($"  ✓  Læste {dotEnv.Path}");
                output.WriteLine($"     {dotEnv.Loaded} udfyldte værdier: {string.Join(", ", dotEnv.Keys)}");
            }
            else
            {
                output.WriteLine("  ✗  Fandt ingen .env-fil.");
                output.WriteLine("     Ledte i:");
                foreach (var sti in dotEnv.Searched.Take(6)) output.WriteLine($"       {sti}");
            }
            output.WriteLine();
        }

        if (!auth.IsConfigured)
        {
            output.WriteLine("  ✗  Ingen credentials.");
            output.WriteLine();

            if (dotEnv is { Found: true })
            {
                var manglerBruger = !dotEnv.Keys.Contains("NEMLIG_USERNAME");
                var manglerKode = !dotEnv.Keys.Contains("NEMLIG_PASSWORD");

                output.WriteLine($"     Filen blev læst, men {(manglerBruger && manglerKode
                    ? "hverken NEMLIG_USERNAME eller NEMLIG_PASSWORD har en værdi"
                    : manglerBruger ? "NEMLIG_USERNAME er tom"
                    : manglerKode ? "NEMLIG_PASSWORD er tom"
                    : "værdierne kom ikke igennem")}.");
                output.WriteLine();
                output.WriteLine("     Skriv værdien direkte efter lighedstegnet, gem, og LUK editoren:");
                output.WriteLine("       NEMLIG_USERNAME=din@mail.dk");
                output.WriteLine("       NEMLIG_PASSWORD=dit-kodeord");
            }
            else
            {
                output.WriteLine("     Kopiér .env.example til .env og udfyld den.");
            }

            output.WriteLine();
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
            if (detail is null)
            {
                fejl++;
                await DumpProductPageAsync(services, p, output);
            }
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

    /// <summary>Viser FORMEN på nemligs svar når mapningen ikke kunne finde
    /// varen. Kun feltnavne, ingen værdier: et produktsvar indeholder også
    /// leveringsadresse og kundenummer, og de skal ikke i en fejlrapport.</summary>
    private static async Task DumpProductPageAsync(
        IServiceProvider services, NemligProduct p, TextWriter output)
    {
        var client = services.GetService<NemligClient>();
        if (client is null || p.Url is null) return;

        output.WriteLine();
        output.WriteLine("     Nemligs svar har denne form — send den videre:");

        try
        {
            var json = await client.FetchProductPageAsync(p.Url);
            if (json is null)
            {
                output.WriteLine("       (tomt svar)");
                return;
            }

            PrintShape(output, json, "       ", depth: 3);
        }
        catch (Exception ex)
        {
            output.WriteLine($"       kunne ikke hentes: {ex.Message}");
        }
    }

    private static void PrintShape(TextWriter output, JsonNode node, string indent, int depth)
    {
        if (depth <= 0) return;

        switch (node)
        {
            case JsonObject obj:
                foreach (var (key, value) in obj.Take(25))
                {
                    var type = value switch
                    {
                        JsonObject o => $"objekt ({o.Count} felter)",
                        JsonArray a => $"liste ({a.Count})",
                        null => "null",
                        _ => "værdi",
                    };
                    output.WriteLine($"{indent}{key}: {type}");

                    // «Id» er nøglen vi leder efter — vis hvor den ligger.
                    if (key is "Id" or "Name" && value is not null)
                        output.WriteLine($"{indent}  ↑ dette felt bruger vi til at genkende varen");

                    if (value is not null) PrintShape(output, value, indent + "  ", depth - 1);
                }
                if (obj.Count > 25) output.WriteLine($"{indent}… og {obj.Count - 25} felter mere");
                break;

            case JsonArray arr when arr.Count > 0 && arr[0] is not null:
                output.WriteLine($"{indent}[0]:");
                PrintShape(output, arr[0]!, indent + "  ", depth - 1);
                break;
        }
    }

    private static void Field(TextWriter output, string navn, bool ok, string vaerdi) =>
        output.WriteLine($"        {(ok ? "✓" : "✗")} {navn,-16} {vaerdi}");
}
