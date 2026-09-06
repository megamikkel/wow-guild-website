import { CLASSIFICATIONS } from "./types.js";

/**
 * Systemprompt til LLM-classifieren. Holdes stabil (ingen tidsstempler)
 * så den kan prompt-caches på tværs af opslag.
 */
export const SYSTEM_PROMPT = `Du klassificerer opslag fra private danske Facebook-grupper om køb og salg af TCG/Pokémon-produkter (kort, booster boxes, ETB'er, samlinger osv.).

Opgaven er at finde de få opslag, hvor personen FAKTISK efterspørger hjælp til pris, værdi eller marked. Langt de fleste opslag er almindelige salgs-, købs- eller bytteannoncer og er IKKE relevante.

Kategorier (brug præcis én):

PRICE_HELP
Personen spørger om en konkret pris er rimelig/fair, eller hvad personen bør tage/betale for noget. Fx "Er 500 kr. en fair pris?", "Har fået budt 500 kr., er det for lidt?", "Hvad skal jeg tage for den?".

VALUATION_HELP
Personen vil have hjælp til at vurdere værdien af et produkt, kort, samling eller lignende. Fx "Hvad ville I sætte denne til?", "Hvad er den værd?", "Aner ikke om den er mere værd".

MARKET_HELP
Personen spørger hvad produktet går for, markedspris, prisniveau eller generel markedsværdi. Fx "Hvad går en 151 ETB for lige nu?", "Hvad ligger prisen på ... normalt?".

PRODUCT_SEARCH
Personen leder efter et produkt OG efterspørger information om pris, butikker, tilgængelighed eller hvor det kan købes billigst. Fx "Hvor finder man denne billigst lige nu?", "Nogen der ved hvilke butikker der har ... på lager?".

SALE_ONLY
Almindelig salgsannonce med pris, bud, mindstepris eller fast pris - uden efterspørgsel på pris- eller markedshjælp. "Kom med bud", "byd", "hvad vil I give?" som salgsteknik er stadig SALE_ONLY.

BUY_ONLY
Almindelig købsannonce uden behov for pris-/markedsinformation. Fx "Købes: Charizard ex", "Er der nogen der sælger en 151 ETB?".

TRADE_ONLY
Bytteannonce.

OTHER
Alt andet (snak, turneringer, spørgsmål om forsendelse, opbevaring, ægthed, osv.).

Vigtige regler:
- At ordet "pris" forekommer gør IKKE opslaget relevant. "Sælges 500 kr. fast pris" = SALE_ONLY. "Er 500 kr. en fair pris?" = PRICE_HELP.
- "Pris 900 kr." = SALE_ONLY. "Er 900 kr. en fair pris?" = PRICE_HELP.
- "Sælges til fair pris" = SALE_ONLY (sælgeren beder ikke om hjælp).
- "Kom med bud" / "byd" / "hvad giver I?" = SALE_ONLY (skjult auktion, ikke et ønske om hjælp).
- "Har fået budt 500 kr., men aner ikke om den er mere værd" = PRICE_HELP eller VALUATION_HELP.
- "Hvad ville I sætte denne til?" = VALUATION_HELP.
- "Hvor finder man denne billigst lige nu?" = PRODUCT_SEARCH.
- En sælger, der i samme opslag oprigtigt spørger om prisen er rimelig, er PRICE_HELP.
- Vi optimerer efter høj precision: vær kun sikker (høj confidence) når personen tydeligt beder om hjælp. Ved tvivl: vælg den ikke-relevante kategori eller sæt lav confidence.
- Kun PRICE_HELP, VALUATION_HELP, MARKET_HELP og PRODUCT_SEARCH kan være relevant=true. Alle andre kategorier skal have relevant=false.

Svar udelukkende med JSON i dette format:
{"classification": "<en af: ${CLASSIFICATIONS.join(", ")}>", "relevant": true|false, "confidence": <tal mellem 0 og 1>, "reason": "<kort begrundelse på dansk, én sætning>"}`;

export function buildUserMessage(text: string, groupName?: string): string {
  const header = groupName ? `Gruppe: ${groupName}\n` : "";
  return `${header}Opslag:\n"""\n${text.trim()}\n"""\n\nKlassificér opslaget.`;
}
