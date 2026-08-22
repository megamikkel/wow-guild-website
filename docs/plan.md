# Plan

**Status:** forslag, afventer din godkendelse. **Dato:** 2026-08-22.
Forudsætter [`nemlig-api.md`](nemlig-api.md), [`opskriftskilder.md`](opskriftskilder.md)
og [`arkitektur.md`](arkitektur.md).

---

## Princippet

Hver etape ender med **noget I bruger i praksis**, ikke med et lag der venter på
det næste. Konkret: efter etape 1 planlægger I ugens mad i appen, uden at nemlig
er nævnt med ét ord i koden.

Rækkefølgen følger én regel: **det der virker uden nemlig, bygges før det der
kræver nemlig.** Det giver en app der er brugbar tidligt, og det gør krav 4
("appen skal virke når nemlig er nede") til en konsekvens af rækkefølgen frem
for til en feature nogen skal huske at bygge.

Estimaterne er i aftener à ~2 timer. De er optimistiske hvis du er rusten på
EF Core og pessimistiske hvis du ikke er.

---

## Etape 0 — Verificér API'et (½ dag, ikke kode)

Kan ikke springes over. Alt i `nemlig-api.md` har tillid **B** eller lavere,
fordi nemlig.com var blokeret i det miljø researchen kørte i. Etape 2 og 3
bygger på gæt indtil det her er gjort.

**Arbejde:** browser-sessionen med `chrome-devtools-mcp` og tjeklisten i
[`nemlig-api.md` §7](nemlig-api.md#7-verifikation-vi-mangler). Kør
MCP-interaktioner i sub-agents, anonymisér før noget lander i `docs/`.

**Færdig når:** `nemlig-api.md` er opdateret med verificerede skemaer, og der
ligger ét anonymiseret JSON-svar pr. endpoint i `tests/fixtures/`.

> **Tjek 1 først: opskrifts-JSON'en.**
> `GET /opskrifter/<slug>?GetAsJson=1&t=<slot>&d=1`.
> Hvis nemligs egne 2000+ opskrifter kommer ud med ingredienser knyttet til
> varenumre, er kerneproblemet i projektet delvist løst hos dem, og etape 2 og 4
> ser anderledes ud. Det er ét kald. **Tag det før alt andet.**

---

## Etape 1 — Ugeplan og egne opskrifter (3–4 aftener)

**Ingen nemlig. Ingen import. Ingen mapping.** Den mindste app der er bedre end
en seddel på køleskabet.

- Blazor Web App, SQLite, Docker-compose til lokal kørsel
- Cookie-login, to seedede brugere, **registrering slået fra**
- Opskrift: titel, portioner, tid, fremgangsmåde, ingredienslinjer som fritekst
- Ugekalender man–søn, læg opskrifter på dage, sæt portioner pr. dag
- Samlet ingrediensliste for ugen — **usorteret, uaggregeret, kan printes**
- Mobil-først CSS. Test på din egen telefon, ikke i devtools

**Hvad I kan bruge det til fra dag ét:** planlægge ugen sammen fra sofaen og få
en indkøbsseddel ud. Det er allerede bedre end det I gør nu.

**Gør rigtigt med det samme, fordi det er dyrt at rette senere:**
- `RecipeIngredient.RawText` gemmes altid — også når I senere parser den
- `MealPlan` unik på husstand + ISO-år + uge
- `.env` i `.gitignore` **fra første commit**, `.env.example` committet
- Gem ved hver ændring, ikke ved en Gem-knap *(se `arkitektur.md` §2 om
  Blazor Server-kredsløb)*

**Ikke endnu:** `Food`, `Unit`, aggregering, priser, søgning, filtre.

---

## Etape 2 — Ingredienser, mapping og priser (5–7 aftener)

Den tungeste etape. Her bliver appen til noget der ikke findes i forvejen.

**2a — Domænemodellen** (`arkitektur.md` §4)
`Food`, `FoodAlias`, `Unit`, `FoodUnitConversion`. Seed ~30 danske
densitetsomregninger (`1 dl mel ≈ 60 g`). Parser for danske ingredienslinjer
(`arkitektur.md` §5.1) — genbrug den MIT-licenserede danske enhedsordbog fra
`mhattingpete/nemlig-shopper`, med kreditering. Aggregering pr. `Food` (§5.3).

**2b — Nemlig-klienten, læsedelen**
`Madplan.Nemlig` som eget projekt. `INemligAuth` + `INemligCatalog`.
Rate limiter, cache, circuit breaker, kontrakttests mod etape 0's fixtures.
`--smoke`-kommandoen. **Ingen kurv endnu.**

**2c — Ordrehistorik som startkapital** (`arkitektur.md` §6)
Læs de sidste ~20 ordrer. Foreslå `Food`-rækker og `ProductMapping`-rækker ud fra
det I faktisk køber. Udled kandidater til spisekammervarer af indkøbsfrekvensen.
**Byg denne før matching-UI'et** — den fjerner det meste af arbejdet fra det.

**2d — Mapping-UI**
Ukendt `Food` → top 5 forslag fra søge-API'et, rangeret efter §5.5. Mennesket
vælger. Valget gemmes. Merge-knap til dubletter *(den bliver brugt, se §5.2)*.

**2e — Pris og pakkeantal**
Pakkestørrelse bekræftes én gang pr. mapping (§5.4). `PackCount = ceil(...)` med
rimelighedstjek. Ugepris vises løbende. **`Money?` — `null` betyder ukendt.**

**Hvad I kan bruge det til:** se hvad ugen koster **inden** I bestiller, med en
korrekt aggregeret liste. Det er selve pointen med projektet, og det virker her —
uden at appen endnu må røre kurven.

**Færdig når:** en uge med 5 retter giver en indkøbsliste med rigtige antal og en
ugepris, og under 5 ingredienser kræver manuelt valg.

---

## Etape 3 — Læg i kurv (2–3 aftener)

Kort etape, fordi grundlaget er lagt — og fordi `AddToBasket` har været uændret
siden 2019 og er idempotent.

- `INemligBasket`. **Synkronisering, ikke tilføjelse:** læs kurven, beregn
  diffen mod ønsket kurv, post absolutte mængder. Kør den to gange → samme
  resultat *(`arkitektur.md` §3)*
- Forhåndsvisning: "dette lægges i kurven" med diff, **før** noget sendes
- `BasketSyncLog`
- Knap: "Læg i nemlig-kurv", undertekst "Bestillingen gennemføres af dig hos nemlig"
- Grep-testen mod checkout-endpoints i CI *(`arkitektur.md` §7)*

**Hvad I kan bruge det til:** hele flowet. Plan → liste → pris → fyldt kurv → ét
manuelt klik hos nemlig. **MVP er nået her.**

---

## Etape 4 — Import af opskrifter (2–3 aftener)

- Generisk schema.org-ekstraktor: **JSON-LD *og* microdata** (AngleSharp).
  Microdata er ikke valgfrit — valdemarsro bruger det
  *(`opskriftskilder.md` §0)*
- Import fra URL: valdemarsro.dk, madensverden.dk, sundpaabudget.dk
- Gem `SourceUrl`, `SourceName`, `Attribution`. Vis dem
- Auto-forslag til `Food` pr. importeret linje, mennesket bekræfter
- Rate limiting og cache også her. Læs `robots.txt` **først**

**Hvad I kan bruge det til:** fylde biblioteket på minutter i stedet for aftener.

> **Kan rykkes frem foran etape 3** hvis manuel indtastning bliver en barriere.
> Kriteriet: har I under 10 opskrifter når etape 2 er færdig, så tag etape 4
> først — ellers har I ikke nok at planlægge med til at etape 3 føles brugbar.

---

## Etape 5 — Det der gør den rar (3–4 aftener)

- Søgning og filtre: børnevenlig, tid, vegetar, budget
- **Spisekammer** som en rigtig skærm: `PantryItem`, "løbet tør"-knap
- Skalering efter antal personer pr. dag
- Lagerstatus i UI'et (`IsAvailableInStock`) + `AlternativeProducts` som substitut
- `EditDeadline` fra `DeliverySpot` vist som "du har til torsdag kl. 23"
- Natlig prisopdatering (`BackgroundService`) — **kræver at I ikke hoster på en
  free tier med cold starts** *(`arkitektur.md` §2)*

---

## Senere — designet så det ikke spærrer, bygges ikke nu

| Ønske | Hvad der allerede gør det muligt |
|---|---|
| Prishistorik, "180 kr. dyrere end sidst" | `ProductSnapshot` gemmer observationer frem for at overskrive |
| Tilbudsdrevne forslag | `DiscountItem` og `Campaign` findes i søgesvaret |
| Rotation, ikke spaghetti tre uger i træk | `MealPlanEntry` er historik når den først står der |
| Rester og madspild | `ShoppingListLine` kender overskuddet: `PackCount × PackageSize − NeededQuantity` |
| Leveringsvinduer | Kræver et endpoint vi ikke har fundet endnu *(`nemlig-api.md` §4)* |

Ingen af dem kræver en migration. Det er hele grunden til at de nævnes her.

---

## Åbne spørgsmål til dig

Ingen af dem blokerer etape 0 eller 1. De skal besvares før etape 2 og 3.

1. **Har I ét fælles nemlig-login eller hvert jeres?** Ét fælles gør etape 3
   enklere — én session, én kurv. Har I hvert jeres, skal appen vide hvis kurv
   den fylder, og det er en beslutning i datamodellen, ikke en indstilling.
   *(Jeg antager ét fælles indtil du siger andet.)*
2. **Er der to-faktor på nemlig-kontoen?** Det kan bryde det automatiske
   login-flow helt. Ved du det ikke, så tjek det under etape 0 — det er
   billigere at opdage der end i etape 3.
3. **Hvor skal den køre?** Jeg anbefaler self-hosting *(`arkitektur.md` §2)*, men
   det forudsætter en maskine der er tændt. Har I en? Ellers er Hetzner til
   ~€4/md det næstbedste, og Render free tier duer til etape 1–2.
4. **Må vi bruge en LLM til ingrediensparsing?** Krav 5 siger ingen tredjeparter,
   og et LLM-kald sender jeres opskrifter til Anthropic eller OpenAI. Min
   anbefaling er nul LLM i version 1 *(`arkitektur.md` §5.6)* — men det er din
   beslutning, ikke min.
5. **Hvor gammelt er barnet, og hvad spiser det ikke?** Det afgør om
   valdemarsros `hverdagsfavoritter-smaa-boern` (overgangskost til ~3 år) eller
   `familiefavoritter` er den rigtige indgang, og hvilke filtre der giver mening
   i etape 5.
6. **Skal madplanen kunne printes eller deles?** Deling uden for husstanden
   ændrer den ophavsretlige vurdering *(`opskriftskilder.md` §7)*. Print til eget
   brug er uproblematisk.
7. **Bekræft .NET 10.** Det er LTS-sporet (understøttet til november 2028), så
   det er også det kedelige valg. Jeg går efter det medmindre du hellere vil
   blive på .NET 8, som du måske allerede har på maskinen.
8. **Dette repo er `wow-guild-website`** — en Astro-side til et WoW-guild.
   Din kickoff-tekst sagde "et tomt projekt-repo". Skal madplanen ligge i et nyt
   repo? Se noten nederst.

---

## De tre største risici for at projektet dør

### 1. Du mister lysten før etape 3 — sandsynlighed: høj

Det er langt den største risiko, og den er ikke teknisk. Etape 2 er den tungeste
og den mindst tilfredsstillende: meget datamodel, meget mapping-UI, lidt at vise
frem. Klassisk sted at gå i stå.

**Modtræk, indbygget i planen:**
- Etape 1 giver noget brugbart efter 3–4 aftener, uden at røre nemlig
- Etape 2c (ordrehistorik) kommer **før** matching-UI'et, så det meste af
  mapping-arbejdet er væk før I mærker det
- Stakken er den du kan i forvejen — se `arkitektur.md` §2, argument 1
- Etape 2 kan deles over flere uger; 2a–2c giver værdi hver for sig

**Advarselstegn:** to uger uden et commit efter etape 1. Sker det, så byg etape 4
(import) i stedet — det er en lille, sjov etape der gør biblioteket brugbart, og
den kan genstarte momentum.

### 2. Mapping-kvaliteten er ikke god nok til at I stoler på den — sandsynlighed: middel

Hvis I skal kontrollere hver linje hver uge, er appen langsommere end at handle
selv. Så bliver den ikke brugt, og så dør den.

**Modtræk:**
- Ordrehistorik som startkapital giver rigtige mappings fra jeres faktiske
  indkøb, ikke fra strenglighed *(`arkitektur.md` §6)*
- Aldrig stille gæt — ukendt mapping stopper og spørger
- Rimelighedstjek fanger `2 spsk olivenolie → 2 liter`
- Persistent tabel: arbejdet falder eksponentielt uge for uge

**Måletal, så I ikke skal gætte:** log hvor mange linjer der kræver manuelt valg
pr. uge. Er tallet ikke under 5 i uge 3, er der noget galt med rangeringen —
ikke med jer.

### 3. Nemlig ændrer sit API — sandsynlighed: middel, konsekvens: mindre end du tror

Det er udokumenteret og kan ændre sig uden varsel. Men 2019→2026-diffen
(`nemlig-api.md` §6) er faktisk opmuntrende: **kurven har været uændret i syv år.**
Det der har flyttet sig er auth og søgning.

**Modtræk:**
- Tre interfaces efter fejlmode, ikke ét *(`arkitektur.md` §3)*
- Kontrakttests mod fixtures fanger skemaændringer
- `--smoke` køres før hver planlægningsuge — I opdager brud **før** I står med en
  tom liste søndag aften
- Appen fungerer uden nemlig; prisen bliver bare ukendt (krav 4)
- Tre aktive open source-klienter i tre sprog: knækker det, er I ikke alene om at
  finde ud af hvad der skete

**Den reelle konsekvens af et brud er en aften med devtools**, ikke et dødt
projekt — netop fordi planlægningsdelen ikke afhænger af integrationen.

**Æresomtale:** at nemlig lukker kontoen ned for automatiseret adgang. Lav
sandsynlighed ved én husstands trafik, men konsekvensen er total. Derfor
1 req/s, aggressiv cache, circuit breaker og ingen crawling. Det er ikke pænhed
— det er risikostyring.

---

## Note om repoet

Dette repo er `megamikkel/wow-guild-website`: en Astro-side til et
World of Warcraft-guild (`src/pages/`, `src/content/events/`, `src/content/guides/`).
Din kickoff-tekst lagde op til "et tomt projekt-repo".

Jeg har lagt de fire dokumenter i `docs/` på den anviste branch
`claude/madplan-nemlig-research-yukrqx`, fordi branchnavnet utvetydigt peger på
denne opgave. Men **madplan-appen bør ikke bygges i dette repo.** Den har intet
med guild-siden at gøre, deler ingen afhængigheder, og vil kollidere med den
ved både build og deploy.

**Forslag:** opret `madplan` som nyt repo når du godkender planen, og flyt
`docs/` derover som første commit. Sig til, så gør jeg det.
