using AngleSharp.Dom;
using AngleSharp.Html.Parser;

namespace Madplan.Recipes;

/// <summary>Finder opskriftslinks på en oversigtsside.
///
/// Formålet er at ét link — «valdemarsro.dk/familiefavoritter/» — bliver til
/// tredive opskrifter, i stedet for at nogen skal kopiere dem ind én ad gangen.
///
/// Den gætter ud fra URL-mønstre og struktur frem for at kende hvert site.
/// Det rammer bredere, men også upræcist: det er derfor kandidaterne vises til
/// gennemsyn før de hentes, og hver enkelt alligevel skal indeholde
/// schema.org-data for at blive importeret.</summary>
public class RecipeLinkFinder
{
    private readonly HtmlParser _parser = new();

    /// <summary>Stumper i en sti der peger på en opskrift. Danske sites bruger
    /// stort set alle en af disse.</summary>
    private static readonly string[] Signaler =
        ["/opskrift", "/opskrifter/", "/recipe", "/mad/", "/retter/"];

    /// <summary>Sider der ligner opskrifter men ikke er det.</summary>
    private static readonly string[] Støj =
        ["/kategori", "/category", "/tag/", "/side/", "/page/", "/author",
         "/om-", "/kontakt", "/privatliv", "/cookie", "/handelsbetingelser",
         "/wp-", "/feed", "?", "#"];

    public async Task<IReadOnlyList<string>> FindAsync(string html, string pageUrl)
    {
        if (!Uri.TryCreate(pageUrl, UriKind.Absolute, out var basis)) return [];

        var doc = await _parser.ParseDocumentAsync(html);
        var fundne = new List<string>();
        var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var a in doc.QuerySelectorAll("a[href]"))
        {
            var href = a.GetAttribute("href");
            if (string.IsNullOrWhiteSpace(href)) continue;

            if (!Uri.TryCreate(basis, href, out var absolut)) continue;

            // Bliv på samme site. En oversigtsside linker også udad, og vi har
            // ingen grund til at følge med derhen.
            if (!absolut.Host.Equals(basis.Host, StringComparison.OrdinalIgnoreCase)) continue;
            if (absolut.Scheme != Uri.UriSchemeHttps && absolut.Scheme != Uri.UriSchemeHttp) continue;

            var reference = absolut.GetLeftPart(UriPartial.Path);
            var sti = absolut.AbsolutePath.ToLowerInvariant();

            if (sti == basis.AbsolutePath.ToLowerInvariant()) continue;
            if (Støj.Any(s => sti.Contains(s, StringComparison.Ordinal))) continue;
            if (!LignerEnOpskrift(sti, basis.AbsolutePath)) continue;

            if (set.Add(reference)) fundne.Add(reference);
        }

        return fundne;
    }

    /// <summary>To veje til at genkende en opskrift: enten peger stien på noget
    /// der hedder opskrift, eller den ligger under den samme sektion som
    /// oversigtssiden selv — sidstnævnte fanger sites hvor opskrifter bare
    /// ligger i roden, som valdemarsro.</summary>
    private static bool LignerEnOpskrift(string sti, string oversigtsSti)
    {
        if (Signaler.Any(s => sti.Contains(s, StringComparison.Ordinal))) return true;

        // Roden af oversigtssiden, fx «/familiefavoritter» → alt derunder.
        var sektion = oversigtsSti.TrimEnd('/');
        if (sektion.Length > 1 && sti.StartsWith(sektion + "/", StringComparison.Ordinal)) return true;

        // Sites hvor opskrifter ligger i roden: «/frikadeller-med-kartofler/».
        // Kræver en sti med mindst to bindestreger, så «/blog» ikke tælles med.
        var segmenter = sti.Trim('/').Split('/');
        return segmenter.Length == 1 && segmenter[0].Count(c => c == '-') >= 2;
    }
}
