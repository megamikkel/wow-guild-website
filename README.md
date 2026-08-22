# madplan-nemlig

Privat familiemadplan med indkøb via [nemlig.com](https://www.nemlig.com).

To voksne og ét barn lægger ugens madplan sammen, ser hvad ugen koster **inden**
der bestilles, og får ingredienserne lagt i nemlig-kurven. Det sidste klik —
selve bestillingen — foretages manuelt af et menneske hos nemlig.

Hobbyprojekt til eget brug. Ikke et produkt.

## Status

**Research og design. Ingen produktionskode endnu.**

Start i [`docs/plan.md`](docs/plan.md).

| Dokument | Indhold |
|---|---|
| [`docs/nemlig-api.md`](docs/nemlig-api.md) | Kortlægning af nemligs udokumenterede webapi. Endpoints, auth-flow, tillidsmarkering pr. endpoint, og hvad der stadig skal verificeres |
| [`docs/opskriftskilder.md`](docs/opskriftskilder.md) | Hvor opskrifterne kommer fra. Vurdering af recipe-scrapers, danske sites, Mealie og kommercielle mellemled |
| [`docs/arkitektur.md`](docs/arkitektur.md) | Stak-anbefaling med alternativ, datamodel, isolation af nemlig-laget, og design af ingrediens→varenummer-mappingen |
| [`docs/plan.md`](docs/plan.md) | Etaper, åbne spørgsmål og de tre største risici |

## Ufravigelige krav

Disse gælder gennem hele projektet og er ikke til forhandling undervejs:

1. **Aldrig automatisk checkout.** Appen fylder kurven. Bestillingen gennemføres
   manuelt af et menneske hos nemlig. Funktionen bygges ikke — koden kender ikke
   engang adressen på checkout-endpointerne. Se [`docs/arkitektur.md`](docs/arkitektur.md) §7.
2. **Ingen credentials i koden eller i git.** Miljøvariabler. `.env` er i
   `.gitignore` fra første commit; `.env.example` committes med tomme værdier.
3. **Vær en høflig gæst.** Rate limiting, aggressiv caching, ingen unødige kald.
   Vi er én husstand, ikke en crawler.
4. **Antag at API'et knækker.** Al nemlig-kontakt isoleres bag ét lag. Appen skal
   kunne bruges til madplanlægning når nemlig er nede — prisen bliver bare ukendt.
5. **Ingen tredjeparter får vores data.** Ingen analytics, ingen tracking.

## Kom i gang

Der er ikke noget at køre endnu. Næste skridt er etape 0 i
[`docs/plan.md`](docs/plan.md): en browser-session der verificerer at nemligs API
ser ud som dokumenteret.

## Tak til

Projektet står på skuldrene af andres reverse engineering:

- [eisbaw/nemlig_cli](https://github.com/eisbaw/nemlig_cli) — MIT. Den grundigste
  kortlægning af nemligs API der findes offentligt
- [mhattingpete/nemlig-shopper](https://github.com/mhattingpete/nemlig-shopper) —
  MIT. Dansk enhedsordbog og ingrediensparser
- [schourode/nemlig](https://github.com/schourode/nemlig) — den oprindelige
  kortlægning fra 2019
- [hknielsen/nemlig-cli](https://github.com/hknielsen/nemlig-cli) — C#-klient
  *(ingen licensfil — læst som reference, ikke kopieret)*
