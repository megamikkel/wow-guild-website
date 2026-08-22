# Opskriftskilder — undersøgelse og anbefaling

**Status:** research, ingen kode skrevet. **Dato:** 2026-08-22.

**Forbehold om metode:** `.dk`-domæner var blokeret af netværkspolitikken i dette
miljø, så jeg kunne ikke hente en eneste dansk opskriftsside live. I stedet er
markup-påstandene nedenfor verificeret mod **de rigtige, cachede HTML-fixtures i
recipe-scrapers' testsuite** — altså faktisk sidekode, ikke hukommelse. For
biblioteker og repoer har jeg læst kildekoden direkte fra git. Hvad jeg ikke kunne
tjekke står i §7.

---

## 0. To rettelser til dine antagelser

Begge er små, og begge ville have kostet tid at opdage i koden.

**1. valdemarsro.dk udstiller ikke JSON-LD.** Opskriften ligger som
**schema.org microdata** (`itemtype="http://schema.org/Recipe"`, `itemprop="recipeIngredient"`).
Sidens eneste `ld+json`-blok indeholder `Article`, `BreadcrumbList`, `WebSite`,
`Organization`, `Person` — **ingen `Recipe`**.

Konsekvensen er konkret: dit spor 4, "en generisk JSON-LD-parser som fallback",
ville **fejle tavst på præcis den side du helst vil have**. Vi skal parse både
JSON-LD *og* microdata. recipe-scrapers klarer valdemarsro netop fordi den kører
begge syntakser gennem `extruct` (`_schemaorg.py`: `SYNTAXES = ["json-ld", "microdata"]`).

**2. Der er fem danske sites i recipe-scrapers, ikke flere.** `arla.dk` er ikke
blandt dem — modulet `arla.py` findes, men dets `host()` returnerer kun `arla.se`.
Der er heller ingen `.dk`-domæner blandt bibliotekets 99 værts-aliasser.

Resten af dine antagelser holdt: recipe-scrapers er det stærkeste bibliotek på
området, valdemarsro er på listen, biblioteket henter ikke selv HTML, og det
omgår bevidst ikke bot-beskyttelse.

---

## 1. recipe-scrapers

**v15.12.0, udgivet 8. august 2026. MIT. Python ≥3.10.** Afhænger af
beautifulsoup4, extruct, isodate. 740 registrerede domæner / 639 scraper-moduler.
Seneste commit 21. august 2026 — dagen før denne research. Særdeles levende.

Én ting at vide: **udgivelserne halter efter koden.** 15.12.0 (aug 2026), 15.11.0
(dec 2025), 15.10.0 (nov 2025). Et site der merges til `main` kan ligge måneder
uden release. Skal du bruge en frisk scraper, så pin mod git frem for PyPI.

**Det henter ikke HTML.** Bekræftet i README: *"This package is focused
exclusively on HTML parsing"* og *"does not circumvent or bypass any bot
protection measures"*. Den anbefalede API er `scrape_html(html, org_url=url)`.
Der findes en `online=True`, men den udsender `DeprecationWarning`. **Vi står
selv for HTTP** — hvilket faktisk passer os fint, fordi vi så også selv styrer
rate limiting og cache.

**Danske sites — den fulde liste:**

| Domæne | Markup | Egnethed til vores formål |
|---|---|---|
| **valdemarsro.dk** | Microdata | **Bedst.** Hverdagsmad, familiekategorier, dansk |
| madensverden.dk | JSON-LD Recipe | God. Scraperen er 7 linjer = ren schema.org |
| sundpaabudget.dk | JSON-LD Recipe | God, og budgetvinklen er relevant |
| dr.dk (mad) | **Ingen** opskrifts-markup | Håndskrevet scraper. Skrøbelig |
| spisbedre.dk | **Ingen** `ld+json` | Data hentes fra en Inertia-SPA-payload (`div#app[data-page]`). Meget skrøbelig |

**Ingredienser er rå strenge.** `ingredient_groups()` findes, men `IngredientGroup`
har kun `ingredients: list[str]` og `purpose: str | None`. Grupperingen er
heuristisk (Dice-koefficient mod sideoverskrifter), ikke parsing. **Ingen
mængder, ingen enheder, ingen NLP-extra** — de eneste extras er `online`, `docs`,
`tests`, `linters`. Vi får `"125 g hvedemel"` som streng og skal selv parse den.

Det er værd at understrege: **recipe-scrapers løser ikke vores kerneproblem.**
Den løser "hent en opskrift fra en URL". Parsing af mængder og enheder, og
mappingen til varenumre, er vores egen opgave uanset hvad vi vælger her.

---

## 2. valdemarsro.dk

Den er den rigtige primærkilde til jeres formål, og kategorierne er bekræftet.
Fixturens forventede `category`-streng indeholder ordret `Familiefavoritter`,
`Opskrifter til børn - Hverdagsfavoritter børn`, `Nem Hverdagsmad`, `Bålmad`,
`Vegetar`.

- https://www.valdemarsro.dk/familiefavoritter/
- https://www.valdemarsro.dk/hverdagsfavoritter-smaa-boern/ — "Børnenes livretter"-samlingen

Lille usikkerhed: den kanoniske etiket er formentlig "Børnenes livretter", men
sluggen er `hverdagsfavoritter-smaa-boern`, og den samling handler om børn fra
overgangskost til ~3 år. Det er måske yngre end jeres barn. Tjek selv om
`familiefavoritter` er den bedre indgang.

Omfang: "well over 1.000 opskrifter", siden har kørt siden 2007. Ikke præcist
verificeret.

**`robots.txt` og betingelser har jeg ikke kunnet hente.** Læs dem selv før
første scrape. Det er ét klik og det er den slags man skal have styr på.

---

## 3. madopskrifter.nu — nej

API'et **findes**, men det er ikke det du håbede. Fra
https://start.madopskrifter.nu/madopskrifternuapi.aspx: WCF, metoder kaldt via
URL, JSON-svar. Eksempel fra deres egen side:

```
http://www.madopskrifter.nu/webservices/iphone/iphoneclientservice.svc/GetPopularRecipes/0
```

Bemærk `http://`. Ingen dokumentation ud over én markedsførings-`.aspx`. Adgang
fås ved at maile webmasteren. Det er pitchet som **white-label B2B til
supermarkeder**, ikke som et offentligt API. ~2.000 opskrifter påstået.

Liveness i 2026 kunne jeg ikke verificere (blokeret), men forfaldssignalerne er
entydige: den tilhørende iOS-app *Madopskrifter.nu – Madplanen* blev **fjernet
fra App Store 18. januar 2025** og var sidst opdateret **22. april 2020**.

**Byg ikke på det.** Et udokumenteret, ukrypteret API bag en mailadresse, hvis
klient-app er død for halvandet år siden, er en dårligere satsning end nemligs
eget udokumenterede API — for der har vi trods alt tre uafhængige, aktive
implementeringer der beviser at det virker.

---

## 4. JSON-LD direkte

Dækningen er cirka halv-god, og det er værd at kende fordelingen før man vælger
strategi:

| Site | Recipe-JSON-LD? |
|---|---|
| madensverden.dk | Ja |
| sundpaabudget.dk | Ja |
| **valdemarsro.dk** | **Nej — microdata** |
| dr.dk/mad | Nej, kun `BreadcrumbList` |
| spisbedre.dk | Nej, SPA-payload |
| arla.dk | Uverificeret (kun `.se` observerbar; på `.se` er JSON-LD'ens mængder ufuldstændige, så scraperen henter ingredienser fra HTML i stedet) |

**Anbefalet ekstraktion: tre lag, i rækkefølge.**

1. **JSON-LD** (`application/ld+json`, `@type: Recipe`) — dækker ~halvdelen
2. **Microdata** (`itemtype=".../Recipe"`) — dækker valdemarsro
3. **Site-specifik adapter** — kun hvis vi konkret savner et site

Lag 1+2 er en generisk parser på nogle hundrede linjer og dækker de tre sites vi
faktisk vil bruge. Lag 3 bygger vi først når vi savner det, og vi accepterer at
det knækker af og til.

---

## 5. Tredjeparter og mellemled — verificeret

Du bad om bekræftelse eller afkræftelse. Her er begge dele.

**parse.bot — din vurdering er bekræftet, ordret.** Marketplace-siden beskriver
`search_products`, `get_product_details`, `get_category_products`, `add_to_basket`,
`get_basket`. Men kurven er **anonym, identificeret ved en `BasketGuid`**, og
efter deres egen tekst **"not tied to a registered nemlig.com account"**, og
**"completing a checkout or linking the basket to an authenticated account is not
supported"**. De foreslår selv at man forker deres API og bygger en autentificeret
bro. Så er vi tilbage ved at gøre det selv, bare med et ekstra led imellem.
*(Kilde: søgeresultat-uddrag af deres marketplace-side; domænet var blokeret.
Læs siden selv før du forkaster den endeligt — men konklusionen står.)*

**Apify — findes, men er read-only.** `blackfalcondata/nemlig-scraper` er ægte og
leverer navn, brand, pris, enhedspris, størrelse, tilbudsstatus, kategorier,
billeder, ingredienser og næringsindhold. Betaling pr. resultat, fra ~$2 pr.
1.000. Samme udbyder har rema1000, netto, bilka, coop365, kvickly. **Ingen kurv,
ingen konto, ingen checkout.**

**Pepesto** (https://www.pepesto.com/supermarkets/) dukkede op undervejs og er
den eneste kommercielle der kommer tæt på: "opskrift → matchet kurv", 26 kæder,
og for Danmark netop nemlig.com. Men ordren lægges i **Pepestos egen app** via
en checkout-redirect, ikke i jeres nemlig-session.

**Fælles dom: ingen af dem løser opgaven.** Opgaven er ikke at *læse* nemlig —
det er at *skrive til jeres egen, indloggede kurv*. Det kræver jeres session, og
den kan I kun give en tredjepart ved at udlevere jeres kodeord. Det kolliderer
frontalt med krav 2 og krav 5. Sagen er lukket.

### Til gengæld: to open source-fund du bør kende

Disse kom frem undervejs og er mere relevante end noget kommercielt tilbud.

**`mhattingpete/nemlig-shopper`** — https://github.com/mhattingpete/nemlig-shopper —
**MIT**, Python, oprettet januar 2026, sidste commit juni 2026. Selvbeskrevet
"Recipe-to-Cart CLI for Nemlig.com". Logger ind på en **rigtig nemlig-konto**,
skriver til brugerens **egen** kurv, bruger recipe-scrapers til parsing, og har
**bevidst ingen checkout-funktion**. Altså næsten præcis jeres målarkitektur,
allerede prototypet.

Jeg har læst koden. To ting er direkte værd at genbruge — og MIT-licensen
tillader det, med kreditering:

- `recipe_parser.py` (795 linjer) har en **dansk enhedsordbog** — `spsk`,
  `spiseskefuld`, `tsk`, `teskefuld`, `stk`, `styk`, `fed` — plus metriske og
  imperiale enheder, en `FRACTIONS`-tabel der oversætter `½ ⅓ ⅔ ¼ ¾ ⅕ ⅛ …` og
  `1/2`-former til decimaler, og `parse_quantity()` / `parse_unit()` /
  `parse_ingredient_text()`. Det er kedeligt arbejde nogen allerede har lavet.
- Den udtrækker opskrifter fra JSON-LD **og** Nuxt3-payloads — nyttig reference
  for lag 3.

Men vær klar over hvad den **ikke** gør, for det er hele forskellen på den og
jeres projekt: der er **ingen persistent mapping-tabel, ingen aggregering på
tværs af opskrifter, intet spisekammer, ingen pakkestørrelses-matematik.** Den
parser, søger, tager det bedste hit og lægger det i kurven. Det er den naive
version af det svære problem. Din problemformulering er altså rigtig — og
uløst af eksisterende værktøj.

**`hknielsen/nemlig-cli`** — https://github.com/hknielsen/nemlig-cli — **C#,
.NET 10**, sidste commit april 2026. Behandles i `arkitektur.md` §3, fordi den
ændrer stak-regnestykket.

⚠️ **Den har ingen LICENSE-fil.** Uden licens er koden som udgangspunkt "alle
rettigheder forbeholdes" — vi må **læse** den og lære af den, men ikke kopiere
kode ind. Selve API-viden (stier, felter, headers) er fakta om nemligs system og
ikke ophavsretligt beskyttet. Hold den grænse.

---

## 6. Mealie — den reelle beslutning

Det her er den ene arkitekturbeslutning i hele projektet der er svær, så jeg
giver dig tallene før dommen.

### Sundhed

Aktiv og velholdt. v3.23.1 udgivet **18. august 2026** — fire dage før denne
research. 13.046 stjerner. Commits på `mealie-next`: maj 99, juni 61, juli 102,
august 108 (delvis måned). **AGPL-3.0**, rent. Python 3.12, FastAPI, Nuxt/Vue.
Bus-faktor ≈ 2 (hay-kot 87 commits, Michael Genson 40 på seks måneder). Ingen
tegn på udbrændthed eller nedlukning.

### Hvad man får

- **Auto-genereret OpenAPI** på `/docs` på ens egen instans, og **langlivede
  API-tokens** (`POST /api/users/api-tokens`, Bearer). Præcis den auth-model en
  ledsagerapp vil have — ingen OAuth-dans.
- Rigtige endpoints til det vi skal bruge: `/api/households/mealplans`,
  `/api/households/shopping/lists` (inkl. `POST /{id}/recipe` der lægger en hel
  opskrifts ingredienser på listen), `/api/households/shopping/items` med
  bulk-operationer, `/api/foods`, `/api/units` (begge med `PUT /merge`),
  `/api/parser/ingredient`.
- **Aggregering med ægte enhedsomregning.** Verificeret i kildekoden, ikke bare i
  dokumentationen: `shopping_lists.py::can_merge()` slår to varer sammen når
  `food_id` matcher og enhederne er identiske *eller konvertible*, via
  `UnitConverter`. `StandardizedUnitType` dækker g/kg/ml/l plus imperiale.
- **Foods og Units er førsteklasses entiteter med `aliases`**, `plural_name`,
  `label` (butikskategori) og `extras`. Kan merges via API.
- Ingrediensparser med tre tilstande: CRF (NLP), brute og OpenAI.
- Ægte PWA (`@vite-pwa/nuxt`). **da-DK er en leveret locale.**
- Grupper → Husstande → Brugere. To voksne = én gruppe, **én husstand**, to
  brugere. *(Vigtigt: to husstande ville splitte jeres madplan.)*
- Indeholder selv `recipe-scrapers==15.12.0` + `extruct` → URL-import fra
  hundredvis af sites, plus manuel oprettelse og en ordentlig editor.
- SQLite er dokumenteret default og eksplicit "ideal… when you have 1–20 users".
  Én container, ét volume. ~1 GB hukommelsesloft anbefalet.
- **`extras`** — vilkårlig JSON key/value på opskrifter, indkøbslister,
  listeelementer **og foods**. Det er en understøttet, fork-fri krog til at hænge
  et nemlig-varenummer på hver `food`.

### Hvad man giver afkald på

- **Sproget og driften.** Docker-first; deres egen FAQ siger *"Can I install
  Mealie without docker? Yes… HOWEVER, it is recommended that you don't."* På
  Windows betyder det Docker Desktop/WSL2. Når noget går galt, fejlsøger du en
  fremmed FastAPI/Nuxt-app i et sprog der ikke er dit.
- **Datamodellen.** Mealie ejer skemaet for opskrift, food, unit, madplan og
  indkøbsliste. Du kan ikke gøre `food` nemlig-vare-formet; du kan hænge ting i
  `extras`, og det er en anden slags aftale.
- **Sømmen ligger det forkerte sted.** Mealies indkøbsliste er bygget til et
  menneske der krydser af i en butik. Vores er en **ordre** der skal blive til
  præcise pakkeantal i en fjern kurv. Pakkestørrelser, spisekammer og
  "300 g pasta → én pose á 500 g" findes ikke i Mealies model. Det arbejde
  ligger nøjagtig i sømmen mellem Mealie og vores bro.
- To systemer, to deploys, to opgraderingsveje. En Mealie-opgradering kan bryde
  vores antagelser om `extras` uden at nogen test fanger det.
- Kan ikke serveres på en subpath — kræver eget subdomæne.
- Ingrediensparsingen er **opt-in pr. opskrift**: man skal fjerne fluebenet
  "Disable Ingredient Amounts" og køre Parse, og food-linking er først god når
  Foods-databasen er fyldt. Forvent manuel kuratering i starten.
- Jeg kunne ikke bekræfte at der findes **dansk** seed-data til Foods/Units.
  Regn med at seede engelsk og omdøbe.

### Tandoor, kort

Overvejet som Mealie-alternativ og fravalgt. Den har faktisk den **bedre
food-model** til vores formål — supermarkeder med afdelingsrækkefølge,
substitutionsregler, food properties. Men: licensen er **AGPL + Commons Clause**
(GitHub rapporterer `NOASSERTION`), altså ikke OSI-open source; tempoet falder
(marts 213 commits, juli 10, august 23; seneste release 5. juli 2026 mod Mealies
fire dage gamle); 417 åbne issues; og driften er tungere (Django + Postgres +
nginx + gunicorn mod Mealies ene container). Mealies `extras`-krog giver os
alligevel det ene Tandoor ellers ville have købt os.

### Dommen

**Byg ikke oven på Mealie. Men stjæl dens datamodel.**

Tre grunde, i vægtet rækkefølge:

1. **Mealie hjælper ikke med den svære del.** Nemlig-broen — mapping,
   pakkestørrelser, spisekammer, kurv-synkronisering — er ~40 % af arbejdet, og
   Mealie bidrager med nul. Det den sparer os for er opskrifts-CRUD og en
   indkøbslistes visning, som er den nemme og sjove del.
2. **Sømmen er det farlige sted, og et hobbyprojekt bør eje begge sider af sin
   svære søm.** Skal vi debugge hvorfor der kom to poser pasta i kurven, vil vi
   ikke have et fremmed API og en `extras`-JSON-dict midt i sporet.
3. **Vedligeholderrisikoen dominerer alt andet.** Den største risiko er at du
   holder op. En Blazor-app du kan ændre på en aften slår en Python/Nuxt-app du
   skal reverse-engineere — også selvom sidstnævnte er bedre software.

Punkt 3 er også grunden til at jeg ikke bare siger "Mealie er mest software for
pengene". Det er det. Det er bare ikke *dit* software.

**Men lån modellen skamløst.** Mealie har fået tre ting rigtige som vi kopierer
direkte i `arkitektur.md`:

- **Food som førsteklasses entitet med aliasser**, adskilt fra ingredienslinjen i
  en opskrift. Det er hele nøglen til at "hakket oksekød", "oksefars" og
  "hakkekød af okse" bliver til én ting.
- **Unit som entitet** med et `standard_unit`-flag, så omregning kun forsøges
  mellem enheder hvor det er meningsfuldt.
- **Merge som en førsteklasses operation** (`PUT /foods/merge`). Man *vil* komme
  til at oprette dubletter. Uden en merge-knap råddirer datamodellen stille.

**Skiftekriterium — skriv det ned nu, mens du er kølig:** hvis du efter etape 2 i
`plan.md` opdager at det meste af din tid går med opskrifts-CRUD og UI frem for
nemlig-broen, så har jeg vurderet forkert. Skift til Mealie på det tidspunkt.
Datamodellen er alligevel lånt derfra, så migrationen er overkommelig — og den
beslutning er langt billigere at tage efter etape 2 end at fortryde efter etape 5.

---

## 7. Anbefaling

**Primær kilde: valdemarsro.dk**, via vores egen henter og en generisk
schema.org-ekstraktor der kan **både JSON-LD og microdata**. Familiefavoritter og
børnekategorierne rammer jeres behov præcist, og siden har kørt siden 2007.

**Sekundært: madensverden.dk og sundpaabudget.dk** — begge ren JSON-LD, så de
kommer nærmest gratis med den samme parser.

**Springes over indtil videre: dr.dk/mad og spisbedre.dk.** Ingen strukturerede
data, kræver håndskrevne adaptere der knækker. Tag dem hvis I savner dem.

**Afvist: madopskrifter.nu** (forfaldent), **alle kommercielle mellemled**
(løser ikke autentificeret kurv), **Mealie som base** (forkert søm, forkert sprog).

**Jeres egne opskrifter er førsteklasses fra etape 1** — ikke en import-feature,
men den primære indtastningsvej, med samme datamodel som de importerede. Import
er bare en anden måde at udfylde formularen på.

### Om Python

Vi har ikke brug for recipe-scrapers til at komme i gang. De tre sites vi
faktisk vil bruge, dækkes af JSON-LD + microdata, og det kan skrives i C# med
AngleSharp. **Ingen Python i version 1.**

Bliver vi senere trætte af at savne dr.dk, spisbedre eller udenlandske sites, så
er svaret **en Python-sidecar på én endpoint** — `POST /parse {html} → recipe
JSON` — i sin egen container. Så får vi 740 sites for ~50 linjer, uden at Python
kommer ind i hovedappen, og containeren kan dø uden at tage madplanen med sig.
Bemærk at vi stadig selv henter HTML'en; sidecaren parser kun. Det er en dør vi
lader stå på klem, ikke en vi går igennem nu.

### Ophavsret — praktisk

Ophavsretslovens **§ 12** tillader eksemplarfremstilling til **privat brug**, og
for digitale kopier er det afgrænset til fremstillerens egen personlige brug
eller **dennes husstand**. Det er nøjagtig formen på en privat familiemadplan.
Den gængse praktiske sondring er at en **ingrediensliste er en funktionel
opremsning** og reelt fri at genbruge, mens **fremgangsmåden, indledningsteksten
og billederne er beskyttet udtryk**.

I praksis for os:

- Gem vores egne **normaliserede ingrediensdata** — det er dem vi arbejder med
  alligevel.
- Gem **kilde-URL og attribution på hver opskrift**, som du selv skrev. Vis det i UI'et.
- Undgå at redistribuere ordret fremgangsmåde og billeder ud over husstanden.
- Risikoprofilen ændrer sig i det sekund cachen bliver delbar eller offentlig.
  Det er en grund til at appen ikke får offentlig registrering — og en grund til
  ikke at "dele madplanen med svigermor" som feature uden at tænke over det.

Kilder: [Kulturministeriet om ophavsret](https://kum.dk/kulturomraader/vil-du-vide-mere-om-ophavsret/strikke-og-haekleopskrifter),
[ophavsretsloven § 12](https://danskelove.dk/ophavsretsloven/12). Orientering, ikke juridisk rådgivning.

---

## 8. Hvad jeg ikke kunne verificere

| Emne | Hvorfor | Hvem tjekker |
|---|---|---|
| `valdemarsro.dk/robots.txt` og betingelser | Domæne blokeret | **Dig, før første scrape** |
| Om madopskrifter.nu overhovedet svarer i 2026 | Domæne blokeret | Ligegyldigt — vi bruger det ikke |
| `arla.dk`s markup | Kun `.se` observerbar | Kun relevant hvis I savner Arla |
| Præcist antal opskrifter på valdemarsro | Ikke oplyst | Ligegyldigt |
| Om Mealie har **dansk** Foods/Units-seed | Fandt ingen locale-seedfiler | Kun relevant hvis vi skifter til Mealie |
| parse.bot og Apify i detaljer | Domæner blokeret; læst via søgeuddrag | Konklusionen er robust nok |

Fixture-HTML'en er nyere, men den er et øjebliksbillede fra en testsuite — ikke
et live-hentet dokument fra august 2026. Sites ændrer markup. Første gang vi
kører en rigtig import mod valdemarsro finder vi ud af om det stadig holder.
