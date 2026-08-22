# nemlig.com API — verificeret overblik

**Status:** research, ingen kode skrevet.
**Dato:** 2026-08-22.
**Vigtigt forbehold:** `nemlig.com` er blokeret af netværkspolitikken i det miljø
denne research blev lavet i. Jeg har **ikke** kunnet lave et eneste live-kald mod
nemlig. Alt nedenfor er udledt af kildekode og dokumentation i to offentlige repoer,
plus en sammenligning af dem på tværs af 7 år. Hvert endpoint har en eksplicit
tillidsmarkering. Se [Verifikation vi mangler](#verifikation-vi-mangler) til sidst —
den skal køres på din egen maskine, og den er en forudsætning for etape 3 i `plan.md`.

---

## 1. Kilderne

| Kilde | Sidste aktivitet | Værdi |
|---|---|---|
| [eisbaw/nemlig_cli](https://github.com/eisbaw/nemlig_cli) | commit `de1c26d`, **2026-08-09** | Primær kilde. `nemlig_api.md` (1599 linjer) + `nemlig_cli.py` (2790 linjer). MIT. |
| [schourode/nemlig](https://github.com/schourode/nemlig) | **2019-04-29** | Historisk. Tynd Python-klient, 5 endpoints. Værdien er ikke koden — det er at den lader os måle API'ets drift. |

**Min vurdering:** `nemlig_cli` er reelt det eneste brugbare udgangspunkt, og det er
et godt et. Det er to uger gammelt, det er bygget mod den nuværende webshop, og
`nemlig_api.md` indeholder faktiske request/response-eksempler frem for prosa.
`schourode` skal du ikke bygge på — men smid den ikke væk, se afsnit 3.

### Hvad schourode har som nemlig_cli mangler

Du spurgte specifikt. Svaret er **intet**. Den er et ægte subset:

| schourode (2019) | Findes i nemlig_cli (2026)? |
|---|---|
| `POST /webapi/login/login` | Ja, som `/webapi/login` + 2 trin foran |
| `GET /webapi/s/0/1/0/Search/Search` | Erstattet af separat søge-gateway |
| `POST /webapi/basket/AddToBasket` | Ja, uændret |
| `GET /webapi/order/GetBasicOrderHistory` | Ja, uændret |
| `GET /webapi/order/GetOrderHistory?orderNumber=` | Ja, men flyttet til `/webapi/v2/order/GetOrderHistory/{id}` |

Hverken schourode eller nemlig_cli dokumenterer **ledige leveringsvinduer**. Det er
ikke et hul i den ene kilde — det er et hul i begge. Se afsnit 4.

---

## 2. Endpoints vi rent faktisk skal bruge

To værter. Det er ikke kosmetik — det er to forskellige systemer med hver sin
fejlmode, og vores klientlag skal behandle dem som to adskilte ting.

- `https://www.nemlig.com/webapi/*` — ASP.NET-monolit. Auth, kurv, ordrer, sidedata.
- `https://webapi.prod.knl.nemlig.it/searchgateway/api/*` — Kubernetes-gateway. Kun søgning.

Tillidsniveauer: **A** = dokumenteret med request+response i nemlig_cli og
uafhængigt bekræftet af schourode fra 2019. **B** = dokumenteret med
request+response i nemlig_cli (august 2026), én kilde. **C** = nævnt, men uden
skema. **D** = formodning, ikke set.

### 2.1 Auth — 3 trin

| # | Kald | Tillid |
|---|---|---|
| 1 | `GET /webapi/AntiForgery` → `{Header, Value}` + sætter cookies `XSRF-TOKEN`, `XSRF-COOKIE-TOKEN` | B |
| 2 | `GET /webapi/Token` → `{access_token, expires_in: 300, token_type: "Bearer"}` | B |
| 3 | `POST /webapi/login` med `{Username, Password, CheckForExistingProducts, DoMerge, AppInstalled, SaveExistingBasket}` + headers `X-XSRF-TOKEN` og `Authorization: Bearer` → sætter `.ASPXAUTH` (1 år), `IVCookieBasketKey`, `IVCookieBasketKeyId` | B |

Faste headers på alt: `Device-Size: desktop`, `Platform: web`, `Version: 11.201.0`,
`X-Correlation-Id: <uuid4>`, en normal browser-`User-Agent`.

**Tre ting der betyder noget for arkitekturen:**

1. **Bearer-tokenet lever 300 sekunder.** Sessions-cookien `.ASPXAUTH` lever et år.
   Vores klientlag skal derfor holde en `HttpClient` med cookie-container i live og
   forny bearer-tokenet dovent, ikke logge ind på ny. Et login pr. session, ikke pr. kald.
2. **Trin 1 og 2 kræver ikke login.** Man kan få et anonymt bearer-token og søge
   produkter uden konto. Det betyder at **prisopslag og produktsøgning kan køre uden
   at røre vores rigtige login** — kun kurven kræver konto. Det er guld værd for
   isolationskravet: prislaget og kurvlaget kan have hver sin credential-profil, og
   pris-features overlever at login knækker.
3. `Version: 11.201.0` er webshoppens frontend-version. nemlig_cli's egne noter siger
   at den "may need updating". Læg den i konfiguration, ikke i koden.

### 2.2 Søgning — den anden vært

```
GET https://webapi.prod.knl.nemlig.it/searchgateway/api/search
    ?query=<term>&take=20&skip=0&recipeCount=3
    &timestamp=<CombinedProductsAndSitecoreTimestamp>
    &timeslotUtc=<slot>&deliveryZoneId=<zone>&includeFavorites=<userId>
Authorization: Bearer <token>
```
Tillid: **B**.

Svaret giver pr. produkt: `Id`, `Name`, `Brand`, `Category`, `SubCategory`, `Url`,
`Price`, `UnitPriceCalc`, `UnitPriceLabel` (`"kr/stk"`, `"kr/kg"` …), `Description`
(`"12 x 0,25 l / Classic"`), `Availability: {IsDeliveryAvailable, IsAvailableInStock}`,
`DiscountItem`, `Favorite`, `Campaign`.

Der er også `GET /searchgateway/api/quick?query=` til autocomplete (**B**) — den
returnerer kun forslag og kategorier, ingen priser. Formentlig ikke noget vi skal bruge.

**Fælden:** `timestamp`, `timeslotUtc` og `deliveryZoneId` skal hentes først.
nemlig_cli henter dem via `GET /webapi/v2/AppSettings/Website` (**C**) plus
`GET /?GetAsJson=1&d=1` (**B**) — altså **to ekstra HTTP-kald pr. søgning**, fordi
`search_products()` kalder `get_page_settings()` hver gang
(`nemlig_cli.py:536`). Det gør vi ikke. De værdier cacher vi pr. session.
Det er præcis den slags, der gør os til en dårlig gæst.

**Hvad `timeslotUtc` gør ved priser er uafklaret.** Formatet er
`2025120216-180-1020` (dato + zone + minutinterval). Sandsynligvis påvirker det
lagerstatus og leveringstilgængelighed, muligvis også kampagner. Uden en verificeret
værdi kan vi få priser der ikke gælder for den uge vi planlægger. **Test det** —
se afsnit 7.

### 2.3 Kurv

| Kald | Beskrivelse | Tillid |
|---|---|---|
| `GET /webapi/basket/GetBasket` | Hele kurven | B |
| `POST /webapi/basket/AddToBasket` | `{ProductId, quantity, AffectPartialQuantity, disableQuantityValidation}` | **A** |

**`quantity` er absolut, ikke et delta.** Post `3` på en vare der allerede ligger
der, og der ligger 3 — ikke 4. Der findes **ingen** `RemoveFromBasket`; man fjerner
ved at poste `quantity: 0`. Kald med `0` på en vare der ikke er i kurven returnerer
200 og ændrer intet.

Det her er den bedste nyhed i hele researchen: **AddToBasket er idempotent og
absolut**. Vores "læg i nemlig-kurv"-knap bliver derfor en *synkronisering* frem
for en serie tilføjelser — vi kan beregne diffen mellem ønsket kurv og faktisk kurv
og poste den, og vi kan køre den samme knap to gange uden at fordoble noget. Det
fjerner en hel klasse af fejl.

Svaret på både `GetBasket` og `AddToBasket` er hele kurven, med `Lines[]`
(`Id`, `Name`, `Brand`, `Quantity`, `ItemPrice`, `Price`, `Description`, `Campaign`),
`BasketGuid`, adresser, og — bemærk — et `Recipes[]`-felt.

Endpointet er identisk hos schourode i 2019 og nemlig_cli i 2026. Syv år uden
brud. Det er den mest stabile ting på hele fladen, og heldigvis den vi er mest
afhængige af.

### 2.4 Produktdetaljer og sidedata

nemlig serverer sine egne SPA-sider som JSON:

```
GET https://www.nemlig.com/<sti>?GetAsJson=1&t=<timeslotUtc>&d=1
```
Tillid: **B**.

Med en produkt-URL (`/cocio-kakaomaelk-701025?GetAsJson=1&...`) giver det
`Attributes[]` (`Allergener`, `Oprindelse`, `Opbevaring`, `Mærkninger`, `Smag` …),
`Declarations` (næringsindhold), `Media[]`, `Campaign`, `Availability`,
`RelatedProducts[]` og `AlternativeProducts[]`.

`AlternativeProducts` er værd at bemærke: det er nemligs egne substitutter, og det
er et gratis svar på "varen er udsolgt, hvad så?".

**Dette mønster er nøglen til opskrifterne.** Se afsnit 3.

### 2.5 Ordrehistorik — undervurderet

| Kald | Tillid |
|---|---|
| `GET /webapi/order/GetBasicOrderHistory?skip=0&take=10` | **A** |
| `GET /webapi/v2/order/GetOrderHistory/{orderId}` | B |

Jeg vil fremhæve det her, fordi det ikke stod i din oprindelige liste og det burde
det have gjort. **Jeres ordrehistorik er det bedste træningsdata der findes til
ingrediens→vare-mappingen.** Den indeholder præcis de varenumre I faktisk køber,
i de pakkestørrelser I faktisk vælger. At seede mapping-tabellen fra historikken
er billigere, hurtigere og mere præcist end nogen fuzzy matching — og det gør
appen brugbar fra dag ét i stedet for efter tre ugers oplæring.

Se etape 2 i `plan.md`.

### 2.6 Checkout — dokumenteret, og vi rører det ikke

For fuldstændighedens skyld, fordi du skal vide at det ligger der:
nemlig_cli dokumenterer `POST /webapi/Order/PlaceOrderLoggedIn`,
`GET /webapi/Checkout/GetCreditCards`, `GetCardsFees`,
`RegisterNewPaymentTransaction` og `GetOrderSummary`.

**Vi wrapper ikke ét eneste af dem.** Ikke bag et flag, ikke "til test", ikke
udkommenteret. Krav 1 er ufravigeligt, og den eneste robuste måde at overholde
det på er at koden ikke kender adressen. Jeg foreslår en test der griber
`grep -ri "placeorder\|registernewpayment"` i `src/` og fejler bygget. Det lyder
paranoidt indtil den dag nogen — menneske eller assistent — "hjælper" med at gøre
flowet færdigt.

To undtagelser der er harmløse og nyttige:
`GET /webapi/Checkout/GetDeliveryPlacements` (**B**, statisk liste over
afleveringssteder) og `GET /webapi/Order/DeliverySpot` (**B**) — se næste afsnit.

---

## 3. Opskriftsuniverset — det vigtigste fund, og det er halvt

Du bad mig prioritere det her, og du havde ret i at prioritere det. Hvis nemligs
egne opskrifter kan hentes med ingredienser knyttet til varenumre, så er
kerneproblemet i projektet allerede løst hos dem.

**Hvad jeg kan bevise:**

1. Søge-API'et returnerer opskrifter. Parameteren `recipeCount` styrer hvor mange,
   og svaret har et `Recipes[]`-array:
   ```json
   { "Id": "fd79688d-0b8b-4d63-98f9-57fe94073e29",
     "Name": "Cocioshake med topping",
     "Url": "/opskrifter/cocioshake-topping-98003783",
     "TotalTime": "10 min",
     "NumberOfPersons": 2 }
   ```
   Tillid: **B**. Der er altså et søgbart opskriftsindeks med GUID, URL-slug,
   tidsforbrug og portionsantal.
2. Kurven har et `Recipes[]`-felt (**B**), og nemlig_cli's egen note siger at
   "recipes are handled separately" fra måltidskasser. Der findes altså en
   mekanisme til at lægge *en hel opskrift* i kurven — hvilket kun giver mening
   hvis nemlig internt har opskrift→varenumre-mappingen.
3. `RecipesIntegrationId` optræder i GDPR-indstillingerne ved login (**B**).

**Hvad jeg ikke kan bevise:** der er **ingen** dokumenteret endpoint til at hente
en opskrifts ingredienser, og ingen til at lægge en opskrift i kurven. Hverken
nemlig_cli, schourode eller nogen offentlig kilde jeg kunne finde beskriver dem.
Mine websøgninger fandt intet.

**Min hypotese, tillid D — og den er stærk nok til at du bør teste den først:**

```
GET https://www.nemlig.com/opskrifter/cocioshake-topping-98003783?GetAsJson=1&t=<slot>&d=1
```

Begrundelsen: `GetAsJson=1` er ikke et produkt-endpoint, det er nemligs generelle
SPA-mekanisme — dokumentationen viser det virke på `/basket`, `/har-du-husket`,
`/checkout` **og** vilkårlige produkt-URL'er. Opskriftssiderne er sider i samme
Sitecore-installation. Der er ingen grund til at de skulle opføre sig anderledes.
Hvis den hypotese holder, får vi sandsynligvis opskriftens ingrediensliste med
produkt-ID'er i ét kald, uden login.

**Det er ét curl-kald at afklare.** Det er den enkeltstående vigtigste ting du kan
gøre efter denne session, fordi svaret ændrer projektets form:

- **Holder den** → nemligs 2000+ opskrifter er en førsteklasses kilde med gratis
  ingrediens→vare-mapping. Vi bruger dem som primærkilde *og* som seed til
  mapping-tabellen for vores egne opskrifter. Fase 0b bliver mindre vigtig.
- **Holder den ikke** → vi bygger mappingen selv som beskrevet i `arkitektur.md`,
  og nemligs opskrifter er højst inspiration. Ingen katastrofe, men en anden plan.

Bemærk uanset udfald: opskriftsteksterne er nemligs indhold. Vi cacher dem lokalt
til privat brug og publicerer intet — samme regime som alle andre kilder, med
kilde-URL og attribution gemt på hver opskrift.

---

## 4. Leveringstider og lagerstatus

Du spurgte til begge dele. De har vidt forskellige svar.

### Lagerstatus — løst

`Availability: { IsDeliveryAvailable, IsAvailableInStock }` findes på både
søgeresultater og produktdetaljer (**B**), og nemlig_cli bruger det aktivt
(`nemlig_cli.py:1393`, viser "OUT OF STOCK"). Derudover giver produktdetaljer
`AlternativeProducts[]` til at foreslå erstatninger.

Det er nok til det du vil: markere en ret som "kan ikke laves i denne uge" og
foreslå en substitut. Vær opmærksom på at lagerstatus formentlig er relativ til
`timeslotUtc` — en vare kan være tilgængelig torsdag og udsolgt lørdag. Endnu en
grund til at få styr på timeslot-parameteren.

### Ledige leveringsvinduer — **ikke løst**

Dette er det største dokumentationshul. `GET /webapi/Order/DeliverySpot` (**B**)
giver **den ordre og det leveringsvindue du allerede har valgt**:

```json
{ "OrderNumber": "1050001234", "State": "Reorder",
  "TimeSlot": {"Start": "2025-11-25T16:00:00Z", "End": "2025-11-25T19:00:00Z"},
  "EditDeadline": "2025-11-24T23:00:00Z" }
```

Det er ikke en liste over ledige vinduer. Trods navnet i nemlig_cli's egen
oversigt ("Get delivery time slots") er det et enkelt, allerede valgt slot.
Listen over *ledige* vinduer med priser er **udokumenteret i begge repoer**.

Det er værd at bemærke `EditDeadline`: det er deadline for at ændre en afgivet
ordre. For jeres flow — hvor kurven fyldes af appen og bestillingen afgives
manuelt — er det feltet der fortæller "du har til torsdag kl. 23 med at nå det".
Det er faktisk ret brugbart i UI'et.

**Konsekvens for MVP:** planlæg ikke omkring leveringsvinduer i første omgang.
Vis `DeliverySpot` hvis der er en ordre i gang, og lad ellers valget af
leveringstid ske manuelt hos nemlig sammen med det sidste klik. Det er alligevel
der beslutningen hører hjemme. Find endpointet under browser-sessionen i afsnit 7
og tilføj det senere hvis I savner det.

---

## 5. Kommercielle mellemled

Din mistanke var rigtig, og begrundelsen er stærkere end du formulerede den.

Selv hvis en tredjepartstjeneste tilbød perfekt produktdata, løser den ikke
opgaven, fordi opgaven ikke er *at læse* nemlig — det er **at skrive til jeres
egen, indloggede kurv**. Det kræver jeres session. En scraper eller et
API-as-a-service har den ikke og kan ikke få den uden at I udleverer jeres
kodeord til dem — hvilket kolliderer direkte med krav 2 og krav 5.

Der er en anden grund til at sige nej: at sende jeres madplan gennem en
tredjeparts-API for at spare et par hundrede linjer kode er en dårlig byttehandel
i et projekt hvis eksplicitte krav er at ingen tredjeparter får jeres data.

En detaljeret verifikation af Apify- og parse.bot-tilbuddene ligger i
`opskriftskilder.md` §5, hvor den hører sammen med den øvrige
tredjepartsvurdering. Konklusionen er den samme: ikke relevante.

**Anbefaling: byg direkte mod webapi'et.** Det er ~300 linjer klientkode, vi ejer
det, og vi kan rette det når det knækker.

---

## 6. Hvor skrøbeligt er det egentlig?

Du bad om en ærlig vurdering frem for et referat. Her er den bedste jeg kan give
uden at kunne kalde API'et: **en diff mellem 2019 og 2026.**

| Flade | 2019 (schourode) | 2026 (nemlig_cli) | Dom |
|---|---|---|---|
| Læg i kurv | `POST /basket/AddToBasket {productId, quantity}` | `POST /basket/AddToBasket {ProductId, quantity, +2 felter}` | **Stabil.** Sti uændret i 7 år. To nye valgfrie felter. |
| Ordrehistorik (liste) | `GET /order/GetBasicOrderHistory?skip&take` | Identisk | **Stabil.** |
| Ordredetaljer | `GET /order/GetOrderHistory?orderNumber=` | `GET /v2/order/GetOrderHistory/{id}` | **Drift.** Versioneret, query→path. |
| Login | `POST /login/login`, ren cookie, ingen tokens | 3 trin, XSRF + JWT fra Keycloak | **Brudt og genopbygget.** |
| Søgning | `GET /webapi/s/0/1/0/Search/Search` | Anden vært, gateway, 4 obligatoriske kontekstparametre | **Helt udskiftet.** |

Det tegner et klart og ret opmuntrende billede:

- **Kurven er klippefast.** Den ene ting vi ikke kan undvære har ikke rykket sig i
  syv år.
- **Auth er den skrøbelige del.** Den er blevet omskrevet mindst én gang, den
  involverer nu Keycloak og Cloudflare, og den er der hvor et brud vil ramme os.
  Isolér den bag ét interface med ét sæt tests.
- **Søgning er den mest volatile.** Ny vært, versioneret gateway, kontekstparametre
  hvis betydning vi ikke kender. Antag at den knækker først.

Det oversættes direkte til designkravet i `arkitektur.md`: **tre interfaces, ikke
ét** — `INemligAuth`, `INemligCatalog` (søgning + produktdetaljer), `INemligBasket`.
De har hver sin fejlmode og hver sin stabilitet, og appen skal kunne fungere med
`INemligCatalog` nede (pris ukendt) uden at `INemligBasket` er påvirket.

Alt går i øvrigt gennem Cloudflare. Det er endnu en grund til at være en høflig
gæst: 1 request/sekund som schourode gjorde det (`time.sleep(1)`, `api/webapi.py`),
aggressiv cache på produktdata, og en User-Agent der ikke lyver om at være en browser
mere end nødvendigt.

---

## 7. Verifikation vi mangler

Alt ovenfor er tillid B eller lavere. Før vi skriver klientkoden skal én
browser-session lukke hullerne. Det er et par timers arbejde og det sparer os for
at gætte.

### Setup

`nemlig_cli` blev bygget med præcis denne metode og repoet indeholder opskriften i
sin README. Genbrug den:

- `chrome-devtools-mcp` (nemlig_cli pinner 0.10.1) som MCP-server i Claude Code.
- Deres nix-wrapper er Linux-only. **På Windows:** kør MCP-serveren direkte med
  `npx chrome-devtools-mcp@0.10.1` og peg den på en **separat Chrome-profil**
  (`--user-data-dir`), så din normale browser og dens cookies ikke inddrages.
- Log ind manuelt i browseren. **Skriv aldrig jeres kodeord i en prompt.**
- Kør alle MCP-kald **i sub-agents**, som du selv sagde. Et enkelt netværksdump
  er >25KB; sub-agenten skal returnere skema og eksempelværdier, ikke rådata.
- Anonymisér: erstat rigtige adresser, navne, kundenummer og ordrenumre inden
  noget lander i `docs/`.

### Tjekliste — i prioriteret rækkefølge

1. **Opskrifts-JSON.** Åbn en opskriftsside på nemlig, og hent samme URL med
   `?GetAsJson=1&t=<slot>&d=1`. Kommer der ingredienser? Er de knyttet til
   produkt-ID'er? **Dette spørgsmål er vigtigere end de andre tilsammen.**
2. **Opskrift → kurv.** Tryk "læg ingredienser i kurv" på en opskriftsside og
   optag kaldet. Hvad hedder endpointet, hvad er payloaden, hvordan ser
   `Recipes[]` ud i kurven bagefter?
3. **Opskriftssøgning og -filtre.** Kan `/searchgateway/api/search` søge opskrifter
   alene? Findes der filtre (tid, børnevenlig, kategori)? Kan man paginere hele
   kataloget?
4. **Ledige leveringsvinduer.** Gå til checkout og optag kaldet der henter listen
   over vinduer. Notér sti, parametre, og om priser pr. vindue er med.
5. **`timeslotUtc`s betydning.** Søg samme vare med to forskellige slots. Ændrer
   `Price`, `Availability` eller `Campaign` sig? Hvad sker der med en ugyldig
   eller forældet værdi — 400, eller stille forkerte data? Det sidste er farligt.
6. **Anonymt vs. indlogget.** Virker søgning med et token fra `/webapi/Token`
   *uden* login? Hvis ja, kan hele prislaget køre uden vores rigtige credentials.
7. **Rate limits.** Hvornår begynder Cloudflare at brokke sig? Find grænsen
   forsigtigt og læg vores loft **langt** under den.
8. **Fejlformer.** Fremtving 401 (udløbet token), 400 (ugyldigt produkt-ID) og et
   udsolgt produkt i `AddToBasket`. Vi skal kende `ValidationFailures`-feltets
   form for at kunne håndtere det.

### Regressionstest bagefter

Når skemaerne er verificeret: gem ét anonymiseret JSON-svar pr. endpoint som
fixture, og skriv en kontrakttest der validerer fixturen mod vores typer. Så
fanger vi vores egne fejl gratis. Kør derudover en `--smoke`-kommando mod det
rigtige API manuelt før hver madplan-uge — den skal søge én vare og læse kurven.
Når den fejler, ved vi at nemlig har ændret noget, **før** vi står med en tom
indkøbsliste søndag aften.

---

## 8. Åbne usikkerheder — ærlig liste

| # | Usikkerhed | Konsekvens hvis det går galt | Afklares af |
|---|---|---|---|
| 1 | Opskrifts-endpointet er en hypotese, ikke et fund | Fase 0b's kilder bliver primære i stedet for sekundære; mere arbejde med mapping | Tjek 1 |
| 2 | Ledige leveringsvinduer er udokumenteret | Ingen levering i appen; manuelt valg hos nemlig | Tjek 4 |
| 3 | `timeslotUtc`s effekt på pris og lager er ukendt | **Priser kan være forkerte uden at vi opdager det** | Tjek 5 |
| 4 | Ingen kilde nævner rate limits eller bot-beskyttelse ud over "alt går gennem Cloudflare" | Konto spærres eller blokeres | Tjek 7 |
| 5 | Kan søgning køre anonymt? | Afgør om prislaget kan isoleres fra vores login | Tjek 6 |
| 6 | Pakkestørrelse skal udledes af `Description`-fritekst eller `Price / UnitPriceCalc` | Forkert antal pakker i kurven | Se `arkitektur.md` §5.4 |
| 7 | `Version: 11.201.0` forældes | Ukendt — muligvis afvisning, muligvis ligegyldigt | Tjek 8 |
| 8 | Ingen af de to repoer har tests mod live-API'et | Vi opdager brud når vi bruger appen, ikke før | Vores egen smoke-test |
| 9 | Er kontoen delt mellem to voksne, eller har I hver jeres nemlig-login? | Påvirker om der er én eller to sessions at holde styr på | **Spørgsmål til dig** |

---

## 9. Konklusion

Byg direkte mod `nemlig.com/webapi` og søge-gatewayen med `nemlig_cli`'s
`nemlig_api.md` som skema-reference. Ingen mellemled, ingen scraping af HTML.
Kurv-endpointet — det vi er mest afhængige af — har været uændret i syv år og er
idempotent, hvilket gør "læg i kurv" til en sikker synkronisering frem for en
risikabel serie tilføjelser. Auth og søgning er de skrøbelige flader; de får hver
sit interface og hver sin fejlmode.

Det ene store åbne spørgsmål er nemligs opskrifter. Det koster ét kald at afklare
og det ændrer projektets form. Tag det først.
