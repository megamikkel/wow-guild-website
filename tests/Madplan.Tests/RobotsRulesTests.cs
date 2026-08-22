using Madplan.Recipes;

namespace Madplan.Tests;

public class RobotsRulesTests
{
    [Fact]
    public void Disallow_for_alle_respekteres()
    {
        var r = RobotsRules.Parse("""
            User-agent: *
            Disallow: /wp-admin/
            Disallow: /soeg
            """);

        Assert.False(r.IsAllowed("/wp-admin/admin.php"));
        Assert.False(r.IsAllowed("/soeg?q=kylling"));
        Assert.True(r.IsAllowed("/opskrifter/spaghetti"));
    }

    [Fact]
    public void Regler_for_ANDRE_robotter_gaelder_ikke_os()
    {
        var r = RobotsRules.Parse("""
            User-agent: GPTBot
            Disallow: /

            User-agent: *
            Disallow: /admin
            """);

        Assert.True(r.IsAllowed("/opskrifter/x"));
        Assert.False(r.IsAllowed("/admin"));
    }

    [Fact]
    public void Kommentarer_og_tomme_linjer_ignoreres()
    {
        var r = RobotsRules.Parse("""
            # kommentar
            User-agent: *

            Disallow: /privat   # også en kommentar
            """);

        Assert.False(r.IsAllowed("/privat/side"));
        Assert.True(r.IsAllowed("/offentlig"));
    }

    [Fact]
    public void Ingen_robots_txt_betyder_alt_er_tilladt()
        => Assert.True(RobotsRules.AllowAll.IsAllowed("/hvadsomhelst"));

    [Fact]
    public void Disallow_root_lukker_hele_sitet()
    {
        var r = RobotsRules.Parse("User-agent: *\nDisallow: /");
        Assert.False(r.IsAllowed("/opskrifter/spaghetti"));
    }
}
