using Madplan.Recipes;

namespace Madplan.Tests;

/// <summary>At finde opskrifter på en oversigtsside. Målet er at ét link bliver
/// til tredive opskrifter — men uden at slæbe kategorisider, forfattersider og
/// cookiepolitikken med.</summary>
public class RecipeLinkFinderTests
{
    private static Task<IReadOnlyList<string>> Find(string html, string url) =>
        new RecipeLinkFinder().FindAsync(html, url);

    [Fact]
    public async Task Opskrifter_i_roden_findes()
    {
        // valdemarsros form: opskrifter ligger direkte i roden.
        var links = await Find("""
            <a href="/spaghetti-med-koedsovs/">Spaghetti</a>
            <a href="/frikadeller-med-kartofler/">Frikadeller</a>
            <a href="/om-mig/">Om mig</a>
            """, "https://www.valdemarsro.dk/familiefavoritter/");

        Assert.Equal(2, links.Count);
        Assert.Contains("https://www.valdemarsro.dk/spaghetti-med-koedsovs/", links);
        Assert.DoesNotContain(links, l => l.Contains("om-mig"));
    }

    [Fact]
    public async Task Stier_der_hedder_opskrift_findes()
    {
        var links = await Find("""<a href="/opskrifter/lasagne">Lasagne</a>""",
                               "https://madensverden.dk/hovedretter/");

        Assert.Equal("https://madensverden.dk/opskrifter/lasagne", Assert.Single(links));
    }

    [Fact]
    public async Task Kategori_og_sidenummer_slaebes_ikke_med()
    {
        var links = await Find("""
            <a href="/kategori/aftensmad">Aftensmad</a>
            <a href="/familiefavoritter/side/2/">Næste side</a>
            <a href="/tag/kylling">kylling</a>
            <a href="/en-rigtig-opskrift-her/">Ret</a>
            """, "https://eksempel.dk/familiefavoritter/");

        Assert.Equal("https://eksempel.dk/en-rigtig-opskrift-her/", Assert.Single(links));
    }

    [Fact]
    public async Task Links_til_andre_sites_foelges_ikke()
    {
        // En oversigtsside linker ogsaa udad. Vi har ingen grund til at gaa med.
        var links = await Find("""
            <a href="https://andet-site.dk/en-anden-opskrift/">Andet sted</a>
            <a href="/vores-egen-opskrift/">Vores</a>
            """, "https://eksempel.dk/oversigt/");

        Assert.Equal("https://eksempel.dk/vores-egen-opskrift/", Assert.Single(links));
    }

    [Fact]
    public async Task Samme_opskrift_flere_gange_taeller_een_gang()
    {
        // Billede og overskrift linker til det samme.
        var links = await Find("""
            <a href="/en-god-ret/"><img src="x.jpg"></a>
            <a href="/en-god-ret/">En god ret</a>
            <a href="/en-god-ret/?utm_source=x">Del</a>
            """, "https://eksempel.dk/oversigt/");

        Assert.Single(links);
    }

    [Fact]
    public async Task Oversigtssiden_selv_kommer_ikke_med()
    {
        var links = await Find("""<a href="/familie-favoritter/">Tilbage til oversigten</a>""",
                               "https://eksempel.dk/familie-favoritter/");
        Assert.Empty(links);
    }

    [Fact]
    public async Task Korte_stier_uden_bindestreger_er_ikke_opskrifter()
    {
        var links = await Find("""
            <a href="/blog">Blog</a>
            <a href="/shop">Shop</a>
            """, "https://eksempel.dk/oversigt/");
        Assert.Empty(links);
    }

    [Fact]
    public async Task Ugyldig_adresse_giver_tom_liste_frem_for_at_kaste()
        => Assert.Empty(await Find("<a href='/x-y-z/'>x</a>", "ikke en url"));
}
