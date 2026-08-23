namespace Madplan.Nemlig.Contracts;

/// <summary>Vores type, ikke nemligs JSON. Ændrer de et feltnavn, rettes
/// mappingen ét sted i NemligClient og resten af appen mærker det ikke.</summary>
public record NemligProduct(
    string Id,
    string Name,
    /// <summary>Varens sti hos nemlig, fx «cocio-kakaomaelk-701025». Den er
    /// vejen til produktdetaljer via GetAsJson, og dermed til prisopdatering.</summary>
    string? Url,
    string? Brand,
    string? Category,
    string? SubCategory,
    string? Description,
    decimal Price,
    decimal? UnitPrice,
    string? UnitPriceLabel,
    bool InStock,
    bool DeliveryAvailable,
    bool IsDiscounted,
    string? ImageUrl)
{
    /// <summary>Udleder pakkestørrelsen af pris divideret med enhedspris. Kun et
    /// FORSLAG: står varen på tilbud, kan Price være kampagneprisen mens
    /// UnitPrice er regnet på normalprisen. Et menneske bekræfter den én gang,
    /// hvorefter den er gemt på mapningen og problemet er væk for den vare.</summary>
    public (double Size, string Unit)? GuessPackageSize()
    {
        if (UnitPrice is null or 0 || UnitPriceLabel is null) return null;

        var size = (double)(Price / UnitPrice.Value);
        var label = UnitPriceLabel.Replace(" ", "").ToLowerInvariant();

        return label switch
        {
            "kr/kg" => (Round(size * 1000), "g"),
            "kr/l"  => (Round(size * 1000), "ml"),
            "kr/stk" => (Round(size), "stk"),
            _ => null,
        };
    }

    /// <summary>Divisionen giver skæve tal — 19,95 / 9,98 kr/kg bliver til
    /// 1998,99 g for en pose på 2 kg. Det er ikke kosmetik: skal man bruge
    /// præcis 2 kg, giver ceil(2000 / 1998,99) TO poser i stedet for én.
    /// Pakkestørrelser er i praksis runde tal, så vi runder derefter.</summary>
    private static double Round(double size) => size switch
    {
        >= 1000 => Math.Round(size / 100) * 100,   // nærmeste 100 g/ml
        >= 100 => Math.Round(size / 10) * 10,      // nærmeste 10
        >= 10 => Math.Round(size),
        _ => Math.Round(size, 2),                  // små styktal må gerne være skæve
    };
}

public record NemligProductDetail(
    NemligProduct Product,
    IReadOnlyList<NemligProduct> Alternatives,
    IReadOnlyDictionary<string, string> Attributes);

/// <summary>Sessionens tilstand. Bearer-tokenet lever 300 sekunder;
/// .ASPXAUTH-cookien lever et år. Derfor fornyer vi tokenet dovent frem for
/// at logge ind på ny.</summary>
public record NemligSession(string BearerToken, string XsrfToken, DateTimeOffset TokenExpiresAt)
{
    public bool IsTokenFresh => DateTimeOffset.UtcNow < TokenExpiresAt.AddSeconds(-30);
}

/// <summary>En opskrift fra nemligs eget univers.
///
/// Hvorfor de er interessante: nemlig knytter selv ingredienser til varenumre,
/// fordi de skal kunne sælge dem. Er <see cref="ProductIds"/> udfyldt, er
/// projektets sværeste problem — ingrediens til vare — allerede løst af dem.
///
/// Hvorvidt det holder er en HYPOTESE indtil et rigtigt kald siger andet.
/// Se docs/nemlig-api.md §3.</summary>
public record NemligRecipe(
    string Id,
    string Name,
    string? Url,
    int? Servings,
    string? TotalTime,
    IReadOnlyList<string> Ingredients,
    IReadOnlyList<string> ProductIds,
    string? Instructions)
{
    public bool HasMappedProducts => ProductIds.Count > 0;
}
