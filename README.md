# madplan-nemlig

Privat familiemadplan med indkøb via [nemlig.com](https://www.nemlig.com).

To voksne og ét barn lægger ugens madplan sammen, ser hvad ugen koster **inden**
der bestilles, og får ingredienserne lagt i nemlig-kurven. Det sidste klik —
selve bestillingen — foretages manuelt af et menneske hos nemlig.

Hobbyprojekt til eget brug. Ikke et produkt.

## Status

**Etape 1–3 er bygget og kører**, plus daglig prisovervågning. Ugeplan,
opskrifter, aggregeret indkøbsliste, priser og kurv-synkronisering.
87 tests grønne.

⚠️ **Nemlig-laget er ikke live-verificeret.** Skemaerne stammer fra offentlig
dokumentation og tre open source-klienter, ikke fra et kald mod nemlig.com —
det var blokeret i miljøet koden blev skrevet i. **Kør etape 0 i
[`docs/plan.md`](docs/plan.md) før du stoler på priser og kurv.** Alt der ikke
rører nemlig er afprøvet i en rigtig browser.

```bash
cp .env.example .env      # udfyld MADPLAN_USERS
docker compose up -d      # http://localhost:8080
```

Eller uden Docker: `dotnet run --project src/Madplan.Web`.

Uden nemlig-credentials kører appen i offline-tilstand: madplan, opskrifter og
indkøbsliste virker, priser er ukendte, kurv-knappen er slået fra.

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

## Projekter

| Projekt | Ansvar |
|---|---|
| `Madplan.Core` | Domænet. Enheder, parsing, aggregering, pakkematematik. **Ingen HTTP, ingen EF.** |
| `Madplan.Data` | EF Core + SQLite, seed, råvareopslag og -fletning |
| `Madplan.Nemlig` | Det eneste sted der kender nemlig. Egne DTO'er, tre interfaces |
| `Madplan.Web` | Blazor Server. UI, auth, kurv-synkronisering |
| `Madplan.Tests` | 87 tests, heriblandt vagthunden mod checkout |

`Core` og `Nemlig` har **nul** projektreferencer. Isolationen er noget
compileren håndhæver, ikke en aftale man indgår med sig selv.

## Kom i gang

```bash
dotnet test                                  # 87 tests
dotnet run --project src/Madplan.Web         # http://localhost:5265
```

### Afprøvning uden nemlig

`tools/fake-nemlig/` er en stub-server der svarer efter de dokumenterede
skemaer. Den lader hele flowet køre — login, søgning, mapping, priser, kurv —
uden at røre den rigtige nemlig:

```bash
node tools/fake-nemlig/server.mjs 5300 &
NEMLIG_USERNAME=demo NEMLIG_PASSWORD=demo \
  Nemlig__BaseUrl=http://localhost:5300 \
  Nemlig__SearchGatewayUrl=http://localhost:5300/searchgateway/api \
  dotnet run --project src/Madplan.Web
```

Den beviser ikke at nemligs API ser sådan ud — kun at vores klient virker hvis
det gør. To ægte fejl blev fanget på den måde; se `docs/nemlig-api.md` §7b.

Næste skridt er etape 0 i [`docs/plan.md`](docs/plan.md): en browser-session der
verificerer at nemligs API ser ud som dokumenteret.

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
