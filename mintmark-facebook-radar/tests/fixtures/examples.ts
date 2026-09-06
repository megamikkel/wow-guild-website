import type { Classification } from "../../src/classifier/types.js";

export interface Example {
  text: string;
  /** Én eller flere acceptable kategorier */
  expected: Classification | Classification[];
  relevant: boolean;
  note?: string;
}

/**
 * Danske eksempler til evaluering af classifieren.
 * Fokus: høj precision - salgsannoncer må ALDRIG markeres relevante.
 */
export const EXAMPLES: Example[] = [
  // ---- 10+ almindelige salgsannoncer (IKKE relevante) ----------------------
  { text: "Sælges 500 kr. fast pris", expected: "SALE_ONLY", relevant: false },
  { text: "Pris 900 kr.", expected: "SALE_ONLY", relevant: false, note: "Kontrast til 'Er 900 kr. en fair pris?'" },
  { text: "Kom med bud", expected: "SALE_ONLY", relevant: false },
  { text: "Sælger min 151 ETB, uåbnet. 550 kr. Sendes med DAO for 45 kr.", expected: "SALE_ONLY", relevant: false },
  { text: "Charizard ex 199/165 sælges. MP 1200 kr. Afhentes i Odense eller sendes.", expected: "SALE_ONLY", relevant: false },
  { text: "Sælges til fair pris. Skriv PB hvis interesseret.", expected: "SALE_ONLY", relevant: false, note: "'fair pris' som salgsudsagn" },
  { text: "Bud modtages på hele samlingen. Priser er sat efter Cardmarket.", expected: "SALE_ONLY", relevant: false },
  { text: "Hvad giver I? Sender gerne, byd løs 🙂", expected: "SALE_ONLY", relevant: false, note: "Skjult auktion" },
  { text: "Ny pris! Nu kun 350,- for Paldea Evolved booster box. Fast pris.", expected: "SALE_ONLY", relevant: false },
  { text: "Prisen er 2500 kr for det hele, ingen bud under. Kan sendes.", expected: "SALE_ONLY", relevant: false },
  { text: "TS: Pikachu VMAX 80 kr, Mew V 40 kr, Arceus VSTAR 60 kr. Pris pr. kort, porto 45 kr.", expected: "SALE_ONLY", relevant: false },
  { text: "Sælges: Scarlet & Violet base booster box 899 kr. Prisen er under markedsprisen 👍", expected: "SALE_ONLY", relevant: false },

  // ---- Købs- og bytteannoncer (IKKE relevante) -----------------------------
  { text: "Købes: Charizard ex 151. Byd gerne med pris.", expected: "BUY_ONLY", relevant: false },
  { text: "Er der nogen der sælger en 151 ETB? Kan hente i Aarhus.", expected: "BUY_ONLY", relevant: false },
  { text: "Byttes: Min Umbreon VMAX alt art mod jeres Rayquaza VMAX alt art.", expected: "TRADE_ONLY", relevant: false },
  { text: "Hvem skal til prerelease i weekenden? Vi er tre der kører fra Kolding.", expected: "OTHER", relevant: false },

  // ---- 5 PRICE_HELP ----------------------------------------------------------
  { text: "Er 900 kr. en fair pris?", expected: "PRICE_HELP", relevant: true },
  { text: "Er 500 kr. en fair pris for en 151 ETB?", expected: "PRICE_HELP", relevant: true },
  { text: "Har fået budt 500 kr., men aner ikke om den er mere værd", expected: ["PRICE_HELP", "VALUATION_HELP"], relevant: true },
  { text: "Overvejer at købe en Evolving Skies booster box til 4500 kr. Synes I det er for meget?", expected: "PRICE_HELP", relevant: true },
  { text: "Hvad skal jeg tage for den her Charizard? PSA 9.", expected: "PRICE_HELP", relevant: true },
  { text: "Jeg har fået tilbudt 1800 kr for min samling, skal jeg sige ja?", expected: "PRICE_HELP", relevant: true },

  // ---- 5 VALUATION_HELP ------------------------------------------------------
  { text: "Hvad ville I sætte denne til?", expected: "VALUATION_HELP", relevant: true },
  { text: "Hvad er den her værd? Base set Blastoise, lidt slid på kanterne.", expected: "VALUATION_HELP", relevant: true },
  { text: "Har arvet en kasse gamle Pokémon-kort. Er der nogen der kan hjælpe med at vurdere værdien?", expected: "VALUATION_HELP", relevant: true },
  { text: "Aner ikke hvad sådan en er værd i dag, nogen der ved det?", expected: "VALUATION_HELP", relevant: true },
  { text: "Hvad tror I sådan en samling er værd cirka?", expected: "VALUATION_HELP", relevant: true },

  // ---- 5 MARKET_HELP ---------------------------------------------------------
  { text: "Hvad går en 151 ETB for lige nu?", expected: "MARKET_HELP", relevant: true },
  { text: "Hvad ligger prisen på en Evolving Skies booster box normalt?", expected: "MARKET_HELP", relevant: true },
  { text: "Nogen der ved hvad markedsprisen er på Umbreon VMAX alt art?", expected: "MARKET_HELP", relevant: true },
  { text: "Hvad koster en Obsidian Flames ETB typisk?", expected: "MARKET_HELP", relevant: true },
  { text: "Hvad sælger I jeres Prismatic Evolutions ETB til? Vil gerne have en idé om niveauet.", expected: "MARKET_HELP", relevant: true },

  // ---- 5 PRODUCT_SEARCH / edge cases ----------------------------------------
  { text: "Hvor finder man denne billigst lige nu?", expected: "PRODUCT_SEARCH", relevant: true },
  { text: "Leder efter en Prismatic Evolutions ETB. Nogen der ved hvor man kan købe den billigst?", expected: "PRODUCT_SEARCH", relevant: true },
  { text: "Hvilke butikker har Surging Sparks på lager? Vil gerne finde den til en god pris.", expected: "PRODUCT_SEARCH", relevant: true },
  { text: "Sælges: Charizard V 200 kr. Er det for meget? Har ikke styr på priserne.", expected: "PRICE_HELP", relevant: true, note: "Sælger der oprigtigt beder om hjælp" },
  { text: "Er der nogen der har prøvet at sende kort med GLS? Kom de frem uden skader?", expected: "OTHER", relevant: false },
];
