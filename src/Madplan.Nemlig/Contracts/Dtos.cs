namespace Madplan.Nemlig.Contracts;

/// <summary>Vores type, ikke nemligs JSON. Ændrer de et feltnavn, rettes
/// mappingen ét sted i NemligClient og resten af appen mærker det ikke.</summary>
public record NemligProduct(
    string Id,
    string Name,
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
            "kr/kg" => (size * 1000, "g"),
            "kr/l"  => (size * 1000, "ml"),
            "kr/stk" => (size, "stk"),
            _ => null,
        };
    }
}

public record NemligProductDetail(
    NemligProduct Product,
    IReadOnlyList<NemligProduct> Alternatives,
    IReadOnlyDictionary<string, string> Attributes);

public record NemligBasketLine(
    string ProductId,
    string Name,
    int Quantity,
    decimal ItemPrice,
    decimal LinePrice);

public record NemligBasket(
    string? BasketGuid,
    IReadOnlyList<NemligBasketLine> Lines)
{
    public decimal Total => Lines.Sum(l => l.LinePrice);
}

/// <summary>Sessionens tilstand. Bearer-tokenet lever 300 sekunder;
/// .ASPXAUTH-cookien lever et år. Derfor fornyer vi tokenet dovent frem for
/// at logge ind på ny.</summary>
public record NemligSession(string BearerToken, string XsrfToken, DateTimeOffset TokenExpiresAt)
{
    public bool IsTokenFresh => DateTimeOffset.UtcNow < TokenExpiresAt.AddSeconds(-30);
}
