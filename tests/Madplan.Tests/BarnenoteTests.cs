using Madplan.Core.Model;

namespace Madplan.Tests;

/// <summary>Noten til den etårige skrives ét sted (startbiblioteket) og læses et
/// andet (forsiden). Disse tests holder de to ender sammen — går de fra hinanden,
/// forsvinder noten fra forsiden uden at noget fejler.</summary>
public class BarnenoteTests
{
    [Fact]
    public void Det_der_skrives_kan_laeses_igen()
    {
        var tekst = Barnenote.Tilfoej(
            "Brun kødet. Kog pastaen.",
            "Lad hans portion køle af, og skær den i tern han kan samle op.");

        Assert.Equal("Lad hans portion køle af, og skær den i tern han kan samle op.",
                     Barnenote.Laes(tekst));
    }

    [Fact]
    public void Fremgangsmaaden_bevares_foran_noten()
    {
        var tekst = Barnenote.Tilfoej("Trin et. Trin to.", "Mindre salt.");
        Assert.StartsWith("Trin et. Trin to.", tekst);
        Assert.Contains("Mindre salt.", tekst);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Ingen_note_giver_ingen_maerkat_i_teksten(string? note)
    {
        var tekst = Barnenote.Tilfoej("Kog kartoflerne.", note);

        Assert.Equal("Kog kartoflerne.", tekst);
        Assert.Null(Barnenote.Laes(tekst));
    }

    [Fact]
    public void En_opskrift_uden_note_giver_null_og_ikke_tom_streng()
    {
        // Forsiden skjuler feltet på null. Returnerede vi "" ville den vise en
        // tom grøn kasse under aftensmaden.
        Assert.Null(Barnenote.Laes("Bag den i ovnen ved 200 grader."));
        Assert.Null(Barnenote.Laes(null));
        Assert.Null(Barnenote.Laes(""));
    }

    [Fact]
    public void Et_maerke_uden_tekst_efter_sig_taeller_ikke_som_en_note()
    {
        Assert.Null(Barnenote.Laes($"Kog risene.\n\n{Barnenote.Maerke}   "));
    }

    [Fact]
    public void Startbibliotekets_retter_baerer_en_note_der_kan_laeses()
    {
        // Den rigtige kobling: teksten som RecipeLibrary faktisk producerer skal
        // kunne læses af forsiden. Ændrer nogen ordlyden ét sted, fejler denne.
        var somGemt = Barnenote.Tilfoej(
            "Rør dejen. Steg frikadellerne.",
            "Giv ham en frikadelle uden salt, most med lidt kartoffel.");

        Assert.Contains(Barnenote.Maerke, somGemt);
        Assert.Equal("Giv ham en frikadelle uden salt, most med lidt kartoffel.",
                     Barnenote.Laes(somGemt));
    }
}
