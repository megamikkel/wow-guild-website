# madplan-nemlig

Privat familiemadplan med indkøb via [nemlig.com](https://www.nemlig.com).

To voksne og ét barn siger hvad ugen må koste, og appen sammensætter en menu der
holder sig under — med rigtige priser fra nemlig.com og en indkøbsliste hvor
varerne findes.

**Appen skriver ikke til nemlig.** Den læser priser og produkter og producerer en
liste. Indkøbet foretager I selv.

Hobbyprojekt til eget brug. Ikke et produkt.

## Status

**Kører.** Retter rangeret efter pris pr. portion, budgetdrevet menugenerator,
import af opskrifter, automatisk kobling til billigste vare, ugeplan med rester,
aggregeret indkøbsliste og daglig prisovervågning.
175 tests grønne.

✅ **Nemlig-integrationen er verificeret mod den rigtige nemlig.com**
(22. august 2026): login, produktsøgning og produktdetaljer. Kør
`dotnet run --project src\Madplan.Web -- smoke` for at tjekke den igen —
API'et er udokumenteret og kan ændre sig uden varsel.

Ikke verificeret endnu: ordrehistorik og ledige leveringsvinduer. Se
[`docs/nemlig-api.md`](docs/nemlig-api.md) §7.

### På Windows

| Fil | Hvad den gør |
|---|---|
| `demo.cmd` | Prøv appen **uden en nemlig-konto**. Starter to stub-servere og fylder dem med danske hverdagsretter. Kræver Node.js. |
| `start.cmd` | Kør appen rigtigt. Opretter `.env` første gang og åbner den i Notepad. |
| `tjek-nemlig.cmd` | Diagnose af nemlig-integrationen. **Kør den først** — se nedenfor. |

Appen læser selv `.env`, så scripterne er en bekvemmelighed, ikke en
forudsætning. Sæt aldrig kodeord som miljøvariabler i hånden i en terminal —
de havner i shell-historikken.

Scripterne er skrevet til Windows, men jeg har ikke kunnet afprøve dem på
Windows herfra. Virker de ikke, er de tre kommandoer de pakker ind:

```
dotnet run --project src\Madplan.Web -c Release -- smoke
dotnet run --project src\Madplan.Web -c Release
docker compose up -d
```

### Første gang: kør diagnosen

```powershell
copy .env.example .env
notepad .env          # udfyld, gem, luk
dotnet run --project src\Madplan.Web -- smoke
```

Nemlig-laget er skrevet mod dokumenterede skemaer og har aldrig talt med den
rigtige server. Diagnosen går login, søgning og produktopslag igennem trin for
trin og siger hvad der virkede. **Den er den verifikation projektet mangler** —
og den tager ti sekunder.

Uden nemlig-credentials kører appen i offline-tilstand: madplan, opskrifter og
indkøbsliste virker, priserne er bare ukendte.

## Sådan bruges den

**30 danske hverdagsretter ligger klar fra første start** — skrevet til dette
projekt, med en etårig ved bordet: meget lidt salt, bløde konsistenser, og en
note til hver ret om hvad man gør anderledes til den mindste. Ingen import
nødvendig for at komme i gang.

1. **Se retterne efter pris** — billigst pr. portion øverst, og sæt selv flueben
   ved dem I vil have. Totalen opdateres for hvert flueben og regnes på hele
   udvalget: deler to retter en pose hakkekød, købes den én gang. Vil I hellere
   have appen til at vælge, siger I bare hvad ugen må koste.
2. **Kobl råvarer til varer** — ét klik. Appen vælger den billigste pr. enhed og
   husker valget, så samme ret koster det samme fra uge til uge.
3. **Sæt rester på** — «holder i 3 dage» på mandagens fiskefrikadeller lægger dem
   selv ind tirsdag og onsdag, og der købes ind til hele portionen på én gang.
4. **Handl efter listen** — aggregeret på tværs af ugen, med rigtige varenumre.

Prisen på den enkelte ret er råvarernes værdi til nemligs kilopris — ikke hele
pakker. Ellers ville en teskefuld karry koste en hel krukke, og retten se dyr ud
selvom resten af krukken bruges næste uge. Det man betaler er totalen.

Vil I have flere retter, er der tre veje under **Retter → Importér**:

| Vej | Hvad den gør |
|---|---|
| **Fra en oversigtsside** | Ét link til fx valdemarsros «Familiefavoritter» → appen finder alle opskrifterne på siden |
| **Fra nemligs opskrifter** | Nemlig knytter selv ingredienser til varenumre. Virker det, er retterne prissat med det samme. **Uafprøvet endnu** |
| **Fra enkelte links** | Indsæt adresser, én pr. linje |

| Dokument | Indhold |
|---|---|
| [`docs/nemlig-api.md`](docs/nemlig-api.md) | Kortlægning af nemligs udokumenterede webapi. Endpoints, auth-flow, tillidsmarkering pr. endpoint, og hvad der stadig skal verificeres |
| [`docs/opskriftskilder.md`](docs/opskriftskilder.md) | Hvor opskrifterne kommer fra. Vurdering af recipe-scrapers, danske sites, Mealie og kommercielle mellemled |
| [`docs/arkitektur.md`](docs/arkitektur.md) | Stak-anbefaling med alternativ, datamodel, isolation af nemlig-laget, og design af ingrediens→varenummer-mappingen |
| [`docs/plan.md`](docs/plan.md) | Etaper, åbne spørgsmål og de tre største risici |

## Ufravigelige krav

Disse gælder gennem hele projektet og er ikke til forhandling undervejs:

1. **Nemlig-laget er rent læsende.** Appen skriver ikke til nemlig — hverken
   kurv, ordre eller konto. Det eneste POST-kald er login. `NemligIsReadOnlyTests`
   fejler bygget hvis nogen tilføjer et skrivende endpoint.
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
| `Madplan.Recipes` | Opskriftsimport. JSON-LD, microdata, robots.txt |
| `Madplan.Web` | Blazor Server. UI, auth, auto-mapping, budgetmenu |
| `Madplan.Tests` | 175 tests, heriblandt vagthunden mod skrivende nemlig-kald |

`Core` og `Nemlig` har **nul** projektreferencer. Isolationen er noget
compileren håndhæver, ikke en aftale man indgår med sig selv.

## Kom i gang

```bash
dotnet test                                  # 175 tests
dotnet run --project src/Madplan.Web         # http://localhost:5265
```

### Afprøvning uden nemlig

To stub-servere lader hele flowet køre uden at røre rigtige sider:
`tools/fake-nemlig/` svarer efter de dokumenterede nemlig-skemaer, og
`tools/fake-recipes/` serverer danske hverdagsretter i både JSON-LD og
microdata.

```bash
node tools/fake-nemlig/server.mjs 5300 &
node tools/fake-recipes/server.mjs 5400 &
NEMLIG_USERNAME=demo NEMLIG_PASSWORD=demo \
  Nemlig__BaseUrl=http://localhost:5300 \
  Nemlig__SearchGatewayUrl=http://localhost:5300/searchgateway/api \
  dotnet run --project src/Madplan.Web
```

De beviser ikke at nemligs API ser sådan ud — kun at vores klient virker hvis
det gør. **Syv ægte fejl er fanget på den måde**, heriblandt fire stille
fejlkoblinger der ville have givet et budget der så rigtigt ud uden at være det.
Se `docs/nemlig-api.md` §7b.

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
