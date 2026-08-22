using Madplan.Core.Parsing;

namespace Madplan.Tests;

public class IngredientParserTests
{
    [Theory]
    // Almindelige former
    [InlineData("500 g hakket oksekød", 500, "g", "hakket oksekød")]
    [InlineData("2 spsk olivenolie", 2, "spsk", "olivenolie")]
    [InlineData("1 tsk salt", 1, "tsk", "salt")]
    [InlineData("2,5 dl mælk", 2.5, "dl", "mælk")]
    [InlineData("1 kg kartofler", 1, "kg", "kartofler")]
    [InlineData("400 ml kokosmælk", 400, "ml", "kokosmælk")]
    // Enheder uden metrisk indhold
    [InlineData("2 fed hvidløg", 2, "fed", "hvidløg")]
    [InlineData("1 dåse flåede tomater", 1, "dåse", "flåede tomater")]
    [InlineData("3 stk æg", 3, "stk", "æg")]
    // Ingen enhed
    [InlineData("2 gulerødder", 2, null, "gulerødder")]
    [InlineData("1 løg", 1, null, "løg")]
    public void Parser_almindelige_linjer(string raw, double qty, string? unit, string food)
    {
        var r = IngredientParser.Parse(raw);
        Assert.Equal(qty, r.Quantity!.Value, 3);
        Assert.Equal(unit, r.UnitAbbrev);
        Assert.Equal(food, r.FoodName);
    }

    [Theory]
    [InlineData("½ tsk stødt kanel", 0.5)]
    [InlineData("1½ dl fløde", 1.5)]
    [InlineData("1 1/2 dl fløde", 1.5)]
    [InlineData("¼ tsk cayennepeber", 0.25)]
    [InlineData("3/4 dl vand", 0.75)]
    [InlineData("2¾ dl mel", 2.75)]
    public void Parser_broeker(string raw, double expected)
    {
        Assert.Equal(expected, IngredientParser.Parse(raw).Quantity!.Value, 3);
    }

    [Theory]
    // Interval: vi tager det højeste. Hellere en gulerod for meget end for lidt.
    [InlineData("2-3 gulerødder", 3)]
    [InlineData("1–2 spsk soja", 2)]
    public void Parser_intervaller_tager_det_hoejeste(string raw, double expected)
    {
        Assert.Equal(expected, IngredientParser.Parse(raw).Quantity!.Value, 3);
    }

    [Fact]
    public void Note_i_parentes_adskilles_fra_navnet()
    {
        var r = IngredientParser.Parse("2 fed hvidløg (finthakket)");
        Assert.Equal("hvidløg", r.FoodName);
        Assert.Equal("finthakket", r.Note);
    }

    [Fact]
    public void Note_efter_komma_adskilles_fra_navnet()
    {
        var r = IngredientParser.Parse("1 løg, i tern");
        Assert.Equal("løg", r.FoodName);
        Assert.Equal("i tern", r.Note);
    }

    [Fact]
    public void Linje_uden_maengde_er_en_gyldig_tilstand_ikke_en_fejl()
    {
        var r = IngredientParser.Parse("salt og peber");
        Assert.Null(r.Quantity);
        Assert.False(r.HasQuantity);
        Assert.Equal("salt og peber", r.FoodName);
        Assert.Equal("salt og peber", r.RawText);
    }

    [Fact]
    public void Raatekst_bevares_altid()
    {
        const string raw = "  500 g hakket oksekød 8-12%  ";
        var r = IngredientParser.Parse(raw);
        Assert.Equal(raw.Trim(), r.RawText);
    }

    [Fact]
    public void Tom_linje_giver_tomt_resultat_uden_at_kaste()
    {
        var r = IngredientParser.Parse("");
        Assert.Null(r.Quantity);
        Assert.Equal("", r.FoodName);
    }
}
