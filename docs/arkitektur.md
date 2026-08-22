# Arkitektur

**Status:** design, ingen kode skrevet. **Dato:** 2026-08-22.
Forudsætter [`nemlig-api.md`](nemlig-api.md) og [`opskriftskilder.md`](opskriftskilder.md).

---

## 1. Hvad systemet er, i én tegning

```
   ┌──────────────────────────────────────────────┐
   │  Madplan.Web        Blazor, mobilvenligt     │
   │  uge · opskrifter · indkøbsliste · pris      │
   └───────────────────────┬──────────────────────┘
                           │
   ┌───────────────────────▼──────────────────────┐
   │  Madplan.Core        domænet. Ingen HTTP.    │
   │  madplan · aggregering · enheder · mapping   │
   └───────┬───────────────────────────┬──────────┘
           │                           │
   ┌───────▼────────┐    ┌─────────────▼─────────────┐
   │ Madplan.Data   │    │ Madplan.Nemlig            │
   │ EF Core+SQLite │    │ ENESTE sted der kender    │
   │                │    │ nemlig. Egne DTO'er.      │
   └────────────────┘    └─────────────┬─────────────┘
                                       │
   ┌───────────────────────┐     ┌─────▼──────────────┐
   │ Madplan.Recipes       │     │  nemlig.com        │
   │ JSON-LD + microdata   │     │  webapi + gateway  │
   └───────────────────────┘     └────────────────────┘
```

Den vigtigste linje i tegningen er den lodrette: **`Madplan.Core` har ingen
reference til `Madplan.Nemlig`s typer.** Kernen kender `Food`, `Product` og
`Money` — ikke `ProductId` som streng fra et JSON-svar. Det er kravet
"isolér al nemlig-kontakt bag ét lag" gjort til noget compileren håndhæver, og
det er derfor det er en projektgrænse og ikke bare en mappe.

---

## 2. Stak — anbefaling

### Anbefalet: ASP.NET Core 10 + Blazor + EF Core + SQLite, i Docker

| Lag | Valg |
|---|---|
| UI | Blazor Web App, rendermode `InteractiveServer` |
| Backend | ASP.NET Core 10, samme proces |
| Data | EF Core 10 + **SQLite** (WAL) |
| Auth | `AddIdentityCore` + cookies. **Registrering slået fra**, to seedede brugere |
| HTTP | `IHttpClientFactory` + `Microsoft.Extensions.Http.Resilience` + `System.Threading.RateLimiting` |
| Baggrund | `BackgroundService` til natlig prisopdatering |
| HTML-parsing | AngleSharp |
| Test | xUnit + fixture-baserede kontrakttests |
| Drift | Én Docker-container, ét volume |

**Argumentet, i den rækkefølge argumenterne faktisk vejer:**

1. **Vedligeholderrisikoen dominerer alt andet.** Den største trussel mod dette
   projekt er ikke et API-brud — det er at du mister lysten en travl måned og
   aldrig kommer tilbage. Alt der sænker friktionen ved at åbne editoren en
   tirsdag aften slår alt der er teknisk elegant. Du kan C#. Det er ikke et
   blødt argument, det er *det* argument.
2. **Der findes allerede en nemlig-klient i C#.**
   [`hknielsen/nemlig-cli`](https://github.com/hknielsen/nemlig-cli) er .NET 10,
   `Nullable` slået til, og har allerede den projektopdeling jeg anbefaler
   (`Nemlig.Client` adskilt fra `Nemlig.Cli`). Den beviser at flowet virker fra
   .NET. *(Ingen LICENSE-fil — læs den, kopiér den ikke. Se `opskriftskilder.md` §5.)*
3. **Én proces, ét sprog, ét deploy.** Blazor Server behøver ikke et API mellem
   UI og domæne. Ingen DTO-duplikering, ingen CORS, ingen separat frontend-build,
   ingen npm. For én person med begrænset tid er antallet af bevægelige dele det
   der afgør om projektet overlever.
4. **Krav 4 falder naturligt ud.** "Isolér nemlig bag ét lag med tydelige typer"
   er noget C#'s typesystem og projektreferencer håndhæver gratis. I et dynamisk
   sprog er det en aftale man indgår med sig selv og bryder på en travl aften.
5. **SQLite er én fil.** Backup er `cp madplan.db backup/`. Ingen databaseserver
   at holde i live. Til to brugere er det ikke en begrænsning, det er en gave.
   *(Slå WAL til — I skriver samtidig fra sofaen.)*

**Og de ærlige ulemper:**

- **Blazor Server kører over en WebSocket.** På mobil med dårligt netværk mister
  du forbindelsen og får en genopretningsbanner. Det er irriterende. Modtrækket
  er at **gemme ved hver ændring**, ikke ved "Gem"-knappen — så koster et
  droppet kredsløb en genindlæsning, ikke jeres arbejde. Med den regel er det
  til at leve med for to brugere.
- **~100–200 MB RAM i hvile.** Udelukker de allermindste gratis tiers.
- **.NET-økosystemet har intet recipe-scrapers.** Vi skriver JSON-LD- og
  microdata-ekstraktion selv med AngleSharp. Overkommeligt — de tre danske sites
  vi vil bruge er dækket af de to standarder. Se `opskriftskilder.md` §7.
- **.NET 10 er stadig ungt.** Det *er* LTS (lige versionsnumre er LTS, udgivet
  november 2025), så det opfylder kedelighedskravet — men et LTS-spor er
  friskest i sit første år. Kør på det, og undgå preview-features.

### Alternativ: Python + FastAPI + HTMX + SQLite

| Lag | Valg |
|---|---|
| UI | Jinja2 + HTMX (ingen SPA, ingen build-step) |
| Backend | FastAPI + Pydantic |
| Data | SQLAlchemy + SQLite |
| Nemlig | `httpx`-klient, egen — men med tre referenceimplementeringer |
| Opskrifter | `recipe-scrapers` direkte |

**Hvornår er det det rigtige valg?** Hvis §5's mapping-motor viser sig at være
90 % af projektets vanskelighed. For så vejer økosystemet tungere end sproget:

- **`recipe-scrapers` gratis**, 740 sites, ingen sidecar.
- **`rapidfuzz`** til fuzzy matching — hurtigere og bedre end noget på NuGet.
- **To MIT-licenserede nemlig-klienter at kopiere fra**, ikke bare læse:
  `eisbaw/nemlig_cli` og `mhattingpete/nemlig-shopper` — sidstnævnte med en
  færdig **dansk enhedsordbog** (`spsk`, `tsk`, `fed`, `stk`) og brøkparser.
  Det er reelt et par ugers arbejde du får forærende.
- **~60 MB container.** Passer på alt.
- Skifter I senere til Mealie, matcher sproget.
- HTMX betyder ingen WebSocket og ingen frontend-build — faktisk *færre*
  bevægelige dele end Blazor Server, ikke flere.

**Hvorfor jeg alligevel ikke anbefaler det:** Pydantic er god, men den giver ikke
den samme compiler-håndhævede mur mellem `Madplan.Core` og `Madplan.Nemlig` som
projektreferencer gør. Og vigtigst — se punkt 1 ovenfor. Et bedre økosystem, der
bruges halvt så ofte fordi sproget føles fremmed, er det dårligere valg.

### Fravalgt: TypeScript / Next.js / SvelteKit

Ikke fordi det ikke kan lade sig gøre, men fordi det ikke køber os noget her. Du
får hverken hjemmebanefordel (som med C#) eller økosystem til opgaven (som med
Python), og Next.js' udskiftningstakt er det stik modsatte af "kedelig,
veldokumenteret teknologi". Vi bygger en app til to mennesker, ikke en
edge-renderet forside.

### Hosting — vær opmærksom, landskabet har flyttet sig

Gratis-niveauerne er ikke hvad de var i 2023:

- **Fly.io har ikke længere en free tier** i 2026 — kun en prøveperiode på 2
  VM-timer / 7 dage. Derefter ~$2–5/md.
- **Railway fjernede sin free tier i 2023**, og forudbetalt kredit i starten af
  2026. Realistisk $6–9/md for en lille altid-tændt tjeneste.
- **Render har stadig en ægte free tier** (512 MB), men med **cold starts** —
  appen sover ved inaktivitet.

Cold starts er ikke i sig selv et problem for jer: I bruger appen et par gange om
ugen, og et par sekunders opvågning fra sofaen er til at bære. **Men de dræber
`BackgroundService`** — en sovende container opdaterer ikke priser om natten.

**Anbefaling: self-host.** En altid-tændt maskine derhjemme (NAS, en gammel
laptop, en Raspberry Pi 5), Docker, Tailscale eller Cloudflare Tunnel til
adgang udefra. Gratis, ingen tredjepart, ingen data ud af huset — hvilket
harmonerer med krav 5 på en måde ingen hostet løsning gør. Alternativt en
Hetzner CX22 til ~€4/md hvis I ikke vil have en maskine kørende hjemme.

Render free tier duer fint til **etape 1–2**, hvor der ikke er baggrundsjob endnu.
Flyt når I får brug for dem.

**Sikkerhedskonsekvens ved self-hosting:** appen holder jeres nemlig-kodeord i
miljøvariabler på en maskine i jeres hjem. Eksponér den **ikke** direkte mod
internettet. Tailscale eller Cloudflare Tunnel med Access, ikke port-forwarding.

---

## 3. Nemlig-laget — hvordan det isoleres

Kravet var: "Isolér al nemlig-kontakt bag ét lag med tydelige typer, så et brud
kan fikses ét sted."

**Ét lag, ja — men tre interfaces.** Begrundelsen står i `nemlig-api.md` §6:
2019→2026-diffen viser at de tre flader har vidt forskellig stabilitet. Kurven
har været uændret i syv år; auth er blevet omskrevet; søgning er flyttet til en
anden vært. At give dem ét fælles interface ville skjule præcis den forskel vi
skal designe efter.

```csharp
public interface INemligAuth {           // skrøbelig — Keycloak, Cloudflare, XSRF
    Task<NemligSession> GetSessionAsync(CancellationToken ct);
}

public interface INemligCatalog {        // mest volatil — anden vært, gateway
    Task<IReadOnlyList<NemligProduct>> SearchAsync(string query, int take, CancellationToken ct);
    Task<NemligProductDetail?> GetProductAsync(string productId, CancellationToken ct);
}

public interface INemligBasket {         // klippefast — uændret siden 2019
    Task<NemligBasket> GetAsync(CancellationToken ct);
    Task<NemligBasket> SetQuantityAsync(string productId, int quantity, CancellationToken ct);
}
```

Bemærk hvad der **ikke** er der: ingen `PlaceOrder`, ingen `Checkout`, ingen
`RegisterPayment`. Se §7.

Bemærk også at `INemligBasket` hedder `SetQuantityAsync`, ikke `AddAsync`.
Navnet afspejler den vigtigste opdagelse i researchen: nemligs `AddToBasket`
tager en **absolut** mængde, ikke et delta, og er idempotent. Et forkert navn her
ville invitere til den præcise fejl der fordobler jeres indkøb.

### Regler for laget

1. **Egne DTO'er.** `NemligProduct` er vores type, ikke et deserialiseret
   JSON-objekt. Ændrer nemlig et feltnavn, rettes mappingen ét sted.
2. **Domænet ser dem aldrig.** `Madplan.Core` refererer ikke `Madplan.Nemlig`.
   Kernen taler `Product`/`Money`; oversættelsen sker på grænsen.
3. **Én fejltype ud.** Alt bliver til `NemligUnavailableException` med en
   `Reason` (`AuthFailed`, `RateLimited`, `SchemaChanged`, `Network`,
   `ProductNotFound`). Resten af appen har præcis én ting at forholde sig til.
4. **Politikker i handleren, ikke i kaldene.** Rate limiting, cache, retry og
   circuit breaker sidder i `DelegatingHandler`s. Ingen forretningskode kender
   til dem, og de kan ikke glemmes ved en ny endpoint.
5. **Fixtures og kontrakttests.** Ét anonymiseret JSON-svar pr. endpoint,
   committet. En test deserialiserer det til vores DTO'er. Så fanger vi vores
   egne fejl gratis, og vi har et sted at opdatere når nemlig ændrer sig.
6. **`--smoke` mod det rigtige API.** Søg én vare, læs kurven. Køres manuelt før
   hver planlægningsuge. Fejler den, ved vi det **før** vi står med en tom liste
   søndag aften.

### At være en høflig gæst

- **1 request/sekund globalt**, `System.Threading.RateLimiting`, hele appen deler
  ét vindue. Det er samme takt som `schourode/nemlig` brugte i 2019
  (`time.sleep(1)`), og der er ingen grund til at være hurtigere end en
  hobbyklient der har fået lov at leve i syv år.
- **Cache produktdata i 24 timer**, priser i 6. To ugeplanlægninger må aldrig
  udløse to fulde prisopslag.
- **Ét login pr. session**, ikke pr. kald. `.ASPXAUTH` lever et år; kun
  bearer-tokenet skal fornys (300 s).
- **Cache kontekstparametrene.** `nemlig_cli` henter `timeslotUtc`, `timestamp`
  og `deliveryZoneId` med to ekstra HTTP-kald **ved hver søgning**
  (`nemlig_cli.py:536`). Det gør vi ikke. Én gang pr. session.
- **Batch prisopdateringer om natten**, ikke ved hvert sidevisning.
- **Circuit breaker.** Tre fejl i træk → hold pause i 15 minutter. Hamrer vi
  løs på et API der har det skidt, bliver vi blokeret — og med rette.

### Om `timeslotUtc` — en opdagelse der reducerer risiko

`nemlig-api.md` §8 lister som usikkerhed #3 at parameteren kan give forkerte
priser. Den er mindre farlig end frygtet: `hknielsen/nemlig-cli` **beregner den
lokalt** ud fra UTC-tid frem for at hente den —
`{yyyyMMddHH}-{minutterTilÅbning}-{minutterTilLukning}`, med leveringsvinduer
06:00–20:00 UTC (`Nemlig.Client/Internal/UrlBuilder.cs`).
`mhattingpete/nemlig-shopper` har samme tilgang i `_generate_default_timeslot()`.

Tre uafhængige implementeringer, to der beregner og én der henter — det peger på
at parameteren er en **tidsbaseret cache-nøgle**, ikke et valg af leveringsvindue.
Det er en god nyhed. Verificér den alligevel (tjek 5 i `nemlig-api.md` §7): vi
skal vide om en forældet værdi giver 400 eller **stille forkerte priser**. Kun
det sidste er farligt.

### Når nemlig er nede

Krav 4 siger at appen skal kunne bruges til madplanlægning når integrationen er
nede. Det er en **domæneregel**, ikke en fejlhåndtering:

- Prisfelter er `Money?`. `null` betyder "ukendt", ikke `0`.
- UI'et viser "Pris ukendt" og en tidsstempel for sidste kendte pris.
- Indkøbslisten genereres fuldt ud **uden** nemlig — mapping og pakkeantal
  kommer fra vores egen database, ikke fra API'et. Kun *prisen* og
  *lagerstatus* mangler.
- "Læg i nemlig-kurv" er deaktiveret med en forklaring.
- Alt andet virker.

Bemærk konsekvensen af §2's rækkefølge: fordi mappingen bor hos os, er en
nedetid hos nemlig et **kosmetisk** problem for planlægningen. Det er hele pointen
med at eje mapping-tabellen.

---

## 4. Datamodel

Lånt fra Mealies model hvor den er god (`Food` som entitet, aliasser, `Unit` med
typer, merge som operation — se `opskriftskilder.md` §6), udvidet med det Mealie
ikke har og vi ikke kan undvære: **pakkestørrelser, spisekammer og
produkt-mapping.**

Kolonnen "Etape" henviser til `plan.md`.

### Husstand og brugere

| Entitet | Felter | Etape |
|---|---|---|
| `Household` | `Id`, `Name`, `DefaultServings` | 1 |
| `AppUser` | `Id`, `HouseholdId`, `Email`, `PasswordHash`, `DisplayName` | 1 |

To rækker i `AppUser`, én i `Household`. Modellér det alligevel — det koster to
kolonner nu og sparer en migration hvis I nogensinde vil dele med nogen.
Registrering er slået fra i koden, ikke bare skjult i UI'et.

### Opskrifter

| Entitet | Felter | Etape |
|---|---|---|
| `Recipe` | `Id`, `Title`, `Servings`, `TotalTimeMinutes`, `Instructions`, `ImageUrl`, `SourceUrl`, `SourceName`, `Attribution`, `IsOwn`, `CreatedByUserId`, `CachedAt` | 1 |
| `RecipeIngredient` | `Id`, `RecipeId`, **`RawText`**, `Quantity?`, `UnitId?`, `FoodId?`, `Note`, `SortOrder`, `GroupPurpose?` | 1 |
| `RecipeTag` | `Id`, `Name`, `Kind` (`Diæt`, `Anledning`, `Køkken`) | 1 |

**`RawText` gemmes altid, også når parsingen lykkes.** Det er den vigtigste
kolonne i tabellen. Når mængden er forkert, er `"1 lille bakke cherrytomater"`
det eneste der kan fortælle os hvorfor — og når vi forbedrer parseren, kan vi
køre den igen over alt gammelt data. `Quantity`, `UnitId` og `FoodId` er alle
nullable: en uparset linje er en gyldig tilstand, ikke en fejl.

`SourceUrl` + `SourceName` + `Attribution` opfylder ophavsretskravet fra
`opskriftskilder.md` §7. Vis dem i UI'et.

### Ingredienser, enheder, omregning

| Entitet | Felter | Etape |
|---|---|---|
| `Food` | `Id`, `CanonicalName`, `IsPantryStaple`, `DefaultUnitId`, `AisleLabel`, `Notes` | 1 |
| `FoodAlias` | `Id`, `FoodId`, `Alias`, `NormalizedAlias` *(unik)* | 1 |
| `Unit` | `Id`, `Name`, `Abbreviation`, `UnitType` (`Mass`/`Volume`/`Count`), `ToBaseFactor`, `IsStandard` | 1 |
| `FoodUnitConversion` | `Id`, `FoodId`, `FromUnitId`, `ToUnitId`, `Factor` | 2 |

Basisenheder: **g**, **ml**, **stk**. `ToBaseFactor` gør `1 dl → 100 ml` og
`1 kg → 1000 g` til en multiplikation.

**`FoodUnitConversion` er ikke valgfri i en dansk kontekst.** Danske opskrifter
måler tørvarer i decilitre. `1 dl hvedemel ≈ 60 g`, `1 dl sukker ≈ 85 g`,
`1 dl havregryn ≈ 40 g`. Uden en densitetstabel pr. `Food` kan vi ikke lægge
`2 dl mel` og `250 g mel` sammen — og den slags sker hele tiden på tværs af en
uges opskrifter. Start med ~30 almindelige varer og udvid når noget mangler.
`fed hvidløg`, `spsk`, `knivspids` hører også hjemme her.

`IsPantryStaple` på `Food` er default-svaret på "har vi det derhjemme". Det
konkrete svar bor i `PantryItem`.

### Madplan

| Entitet | Felter | Etape |
|---|---|---|
| `MealPlan` | `Id`, `HouseholdId`, `IsoYear`, `IsoWeek`, `Notes` *(unik på husstand+år+uge)* | 1 |
| `MealPlanEntry` | `Id`, `MealPlanId`, `Date`, `MealType`, `RecipeId`, `Servings` | 1 |
| `PantryItem` | `Id`, `HouseholdId`, `FoodId`, `State` (`Har`, `LøbetTør`), `UpdatedAt` | 2 |

`Servings` pr. *entry*, ikke pr. opskrift — I laver dobbelt portion mandag og
normal onsdag. Skaleringsfaktoren er `Entry.Servings / Recipe.Servings`.

### Mapping — projektets hjerte

| Entitet | Felter | Etape |
|---|---|---|
| `ProductMapping` | `Id`, `FoodId`, `NemligProductId`, `ProductName`, **`PackageSize`**, **`PackageUnitId`**, `IsPreferred`, `ConfirmedByUserId`, `ConfirmedAt`, `Source` (`Ordrehistorik`/`Manuel`/`Forslag`) | 2 |
| `ProductSnapshot` | `Id`, `NemligProductId`, `ObservedAt`, `Price`, `UnitPrice`, `UnitPriceLabel`, `InStock`, `CampaignJson` | 2 |

**Flere mappings pr. `Food` er tilladt**, med én `IsPreferred`. Nogle gange vil
man have økologisk, nogle gange det billige. `ConfirmedByUserId` + `ConfirmedAt`
er ikke pynt: de dokumenterer at et menneske har set og godkendt netop dette
match, hvilket er kravet fra opgavebeskrivelsen.

`ProductSnapshot` er både cache **og** begyndelsen på prishistorik. Ved at gemme
observationer frem for at overskrive en pris, får I "denne uge er 180 kr. dyrere
end sidste" gratis senere, uden en migration nu. Det er §"senere"-kravet der
designes så det ikke spærrer.

### Indkøbsliste og kurv

| Entitet | Felter | Etape |
|---|---|---|
| `ShoppingList` | `Id`, `MealPlanId`, `GeneratedAt`, `State` | 2 |
| `ShoppingListLine` | `Id`, `ShoppingListId`, `FoodId`, `NeededQuantity`, `NeededUnitId`, `ProductMappingId?`, `PackCount`, `EstimatedPrice?`, `Status`, `ManualOverride`, `ExcludedReason?` | 2 |
| `BasketSyncLog` | `Id`, `ShoppingListId`, `SyncedAt`, `UserId`, `LinesPosted`, `Outcome`, `DetailsJson` | 3 |

`ShoppingListLine.Status`: `Ok`, `ManglerMapping`, `Udsolgt`, `Spisekammer`,
`FravalgtManuelt`.

**`BasketSyncLog` er ikke overengineering.** Det er den eneste måde at besvare
"hvorfor ligger der tre poser ris i kurven?" — og eftersom kurv-synkronisering er
den ene handling der rører verden uden for appen, skal den efterlade et spor.

---

## 5. Mapping-motoren — kerneproblemet

Du skrev at det svære hverken er API'et eller UI'et. Det er rigtigt, og
researchen bekræfter det: `mhattingpete/nemlig-shopper` har allerede løst
API-delen og parsing-delen i 795 linjer — og har **stadig** ingen mapping-tabel,
ingen aggregering på tværs af opskrifter, intet spisekammer og ingen
pakkematematik. Præcis det du peger på er det ingen har bygget.

Pipelinen kører **én gang pr. madplan**, ikke pr. opskrift. Rækkefølgen er ikke
til forhandling: aggregering skal ske **før** produktopslag, ellers får man de
fem forskellige hakkede oksekød du beskriver.

```
opskriftslinjer (hele ugen)
   │
   ├─1─ parse        "500 g hakket oksekød 8-12%" → {500, g, "hakket oksekød", "8-12%"}
   ├─2─ normalisér   → Food#42 "hakket oksekød"          (alias-opslag)
   ├─3─ skalér       × (Entry.Servings / Recipe.Servings)
   ├─4─ AGGREGÉR     alle linjer pr. Food, i basisenhed  ← før produktopslag!
   ├─5─ spisekammer  fjern IsPantryStaple, medmindre LøbetTør
   ├─6─ produkt      ProductMapping → nemlig-vare + pakkestørrelse
   ├─7─ pakkeantal   ceil(behov / pakkestørrelse) + rimelighedstjek
   └─8─ pris         ProductSnapshot, eller "ukendt"
        │
        └─► ukendt Food eller manglende mapping → menneskeligt valg. Aldrig et gæt.
```

### 5.1 Parsing (trin 1)

Deterministisk. Regex plus en dansk enhedsordbog. Ingen LLM.

Skal håndtere: `500 g`, `2 spsk`, `1½ dl`, `¼ tsk`, `2 fed hvidløg`, `1 stk`,
`1 bakke`, `1 dåse`, `en håndfuld`, `salt og peber` (ingen mængde), `2-3 gulerødder`
(interval → tag det højeste), `1 lille løg` (størrelsesadjektiv → note).

`mhattingpete/nemlig-shopper`s `recipe_parser.py` er **MIT** og har ordbogen og
brøktabellen (`½ ⅓ ⅔ ¼ ¾ ⅕ ⅛`, plus `1/2`-former) færdig. Genbrug den — direkte
hvis I vælger Python, som oversat reference hvis I vælger C#. Kreditér den.

**Fejler parsingen, er det ikke en fejl.** Linjen får `Quantity = null`, havner
på indkøbslisten med sin `RawText` og et flag "tjek selv". Bedre end et gæt.

### 5.2 Normalisering (trin 2)

`NormalizedAlias` = små bogstaver, trimmet, kollapsede mellemrum, fjernede
mængdeord og støjord (`frisk`, `økologisk`, `ca.`, `finthakket`), bevarede
danske tegn (æ, ø, å). **Ikke** stemming — dansk stemming laver mere skade end
gavn på ordet "ris".

Vigtigt: `hakket` fjernes **ikke**. "hakket oksekød" og "oksekød" er forskellige
varer. Støjordslisten skal være kort og konservativ; det er bedre at have to
`Food`-rækker og merge dem end at slå to varer sammen der ikke er ens.

Opslag: `NormalizedAlias` → `Food`. Rammer vi ikke, oprettes en ny `Food` som
`Ubekræftet` og lægges i kø til mennesket.

**Merge-knappen er ikke valgfri.** I *vil* komme til at have både "flødeost" og
"flødeoste". Mealie har `PUT /foods/merge` af netop den grund. Uden den råddirer
datamodellen stille over et halvt år.

### 5.3 Aggregering (trin 4)

Læg sammen pr. `Food` i basisenhed. `Mass`, `Volume` og `Count` blandes kun via
`FoodUnitConversion`. Findes omregningen ikke — `2 fed hvidløg` + `1 tsk
hvidløgspulver` — så **slå dem ikke sammen**. Vis to linjer og lad mennesket se
det. En forkert sammenlægning er værre end to linjer.

### 5.4 Pakkestørrelse (trin 6–7)

Det er her "300 g pasta bliver til én pose á 500 g" afgøres, og det er den
mest oversete detalje i hele projektet.

Tre kilder til pakkestørrelsen, i prioriteret rækkefølge:

1. **Menneskets bekræftelse.** Gemmes på `ProductMapping`. Er den sat, vinder den.
2. **`Description`-feltet.** Søge-API'et giver strenge som `"0,60 l / Classic"`
   og `"12 x 0,25 l / Classic"`. Parsérbart, inklusive multipakker.
3. **Aritmetik:** `PackageSize = Price / UnitPriceCalc` når `UnitPriceLabel` er
   `kr/kg` eller `kr/l`. Giver størrelsen i kg eller liter.

**Advarsel om kilde 3:** står varen på tilbud, kan `Price` være kampagneprisen
mens `UnitPriceCalc` er beregnet på normalprisen (eller omvendt). Brug den kun
som forslag der skal bekræftes, aldrig som sandhed. Bekræft **én gang** ved
oprettelsen af mappingen, og gem resultatet — så er problemet væk for altid for
netop den vare.

`PackCount = ceil(NeededQuantity / PackageSize)`.

**Rimelighedstjek — vis en advarsel, gennemfør ikke stille:**
- `PackCount > 5` → "det ser meget ud, er enheden rigtig?"
- Overskud > 3× behovet → "du køber 1 kg for at bruge 200 g"
- `PackCount = 0` fordi behovet er 0 → udelad linjen

Det fanger klassikeren hvor `2 spsk olivenolie` bliver til 2 liter, fordi nogen
har mappet `spsk` forkert.

### 5.5 Fuzzy matching — kun til at foreslå

Fuzzy matching bruges **aldrig** til at vælge. Kun til at rangere de forslag et
menneske ser. Det er forskellen på et system man kan stole på og et man skal
kontrollere hver uge.

Rangér nemlig-søgeresultater efter, i vægtet rækkefølge:

1. **Købt før** — findes varen i `GetBasicOrderHistory`, vinder den næsten altid.
   Se §6.
2. **Token-set-lighed** mod `Food.CanonicalName` (rapidfuzz i Python, FuzzySharp
   på NuGet). Token-set, ikke Levenshtein: "oksekød, hakket 8-12%" skal matche
   "hakket oksekød".
3. **Kategori-match** — `Product.Category`/`SubCategory` mod `Food.AisleLabel`.
   Fanger at "smør" ikke er "smørbart pålæg".
4. **På lager** (`IsAvailableInStock`) — udsolgte nedprioriteres, skjules ikke.
5. **Enhedspris** — ved ellers lige kandidater, den billigste.
6. **Straf for lange brandede navne** — "Änglamark Økologisk Hakket Oksekød
   8-12% 400g" er ofte rigtigt, men "Hakket oksekød 8-12%" er oftere det I mener.

Vis top 5. Mennesket vælger. Valget gemmes som `ProductMapping` og spørges
aldrig igen.

**Arbejdsmængden falder eksponentielt.** Uge 1: måske 40 valg. Uge 2: 10.
Uge 8: nul, medmindre I laver noget nyt. Det er hele forretningsmodellen i
mapping-tabellen, og det er derfor den skal være persistent fra dag ét og ikke
en cache.

### 5.6 Hvornår giver en LLM mening?

Du bad om ærlighed her, så:

**Nej — og det er ikke tæt på:**
- Enhedsomregning, aggregering, pakkematematik. Det er aritmetik. En LLM gør det
  langsommere, dyrere og af og til forkert. Skriv koden.
- Alias-opslag. Det er et hashopslag.
- Valg af produkt. Det er et menneskes beslutning, jf. dit eget krav.

**Måske — men prøv koden først:**
- Parsing af rodede ingredienslinjer. En dansk regex + ordbog klarer 90 %+, og de
  10 % er *synlige* (de får `Quantity = null`). Vent med LLM'en til I ved hvilke
  linjer der faktisk fejler; jeg tror listen bliver kort nok til at rette i hånden.
- Generering af søgestreng: `"1 bakke cherrytomater, halverede"` → `"cherrytomater"`.
  En stopordsliste klarer det meste.

**Ja, hvis noget:**
- Førstegangs-bulk-normalisering af en importeret opskriftssamling, hvor I sidder
  med 200 ingredienslinjer og vil have et udkast til `Food`-tabellen. Én
  engangskørsel med menneskelig gennemgang bagefter.

**Min anbefaling: byg version 1 med nul LLM.** Ikke af principper, men fordi
mapping-tabellen gør problemet **mindre over tid**. En LLM løser et problem der
skrumper af sig selv. Bygger I LLM'en først, får I aldrig at vide hvor lille
problemet egentlig var — og I betaler for hver uge.

> ⚠️ **Og der er en konflikt du skal tage stilling til.** Krav 5 siger "ingen
> tredjeparter får vores data". Et LLM-kald sender jeres opskrifter og
> indkøbsvaner til Anthropic eller OpenAI. Det *er* en tredjepart. Det er ikke
> nødvendigvis forkert — men det er en beslutning, ikke en detalje, og den skal
> tages bevidst. Se åbent spørgsmål 4.

---

## 6. Ordrehistorik som startkapital

Det her stod ikke i din opgavebeskrivelse, og det er den enkeltstående idé jeg
helst vil have dig til at tage med.

`GET /webapi/order/GetBasicOrderHistory` (tillid **A** — uændret siden 2019) plus
`GET /webapi/v2/order/GetOrderHistory/{id}` giver **hver vare I har købt, med
varenummer og pakkestørrelse**.

Kør den én gang over de sidste ~20 ordrer, og I har:

- En liste over de varer familien faktisk køber — inklusive de mærker og
  størrelser I foretrækker, uden at nogen har skullet formulere en præference.
- Et forslag til `Food`-tabellen: hyppigt købte varer er jeres reelle
  ingrediensunivers.
- En rangeringsprior der slår enhver fuzzy matching, fordi den er baseret på
  faktisk adfærd og ikke på strenglighed.
- Et realistisk bud på hvilke varer der er **spisekammervarer** — køber I mel
  hver 8. uge og mælk hver uge, er mel en spisekammervare. Det kan udledes af
  indkøbsfrekvensen frem for at skulle sættes i hånden.

Det gør appen brugbar fra første uge i stedet for efter tre ugers oplæring, og
det er kun ét endpoint. Derfor er det etape 2 i `plan.md` og ikke en senere idé.

---

## 7. Checkout — hvordan "byg det ikke" håndhæves

Krav 1 er ufravigeligt, så det skal ikke bare være en aftale.

1. **`INemligBasket` har ingen ordremetode.** Der er ingen at kalde.
2. **Ingen af checkout-endpointerne findes i koden** — heller ikke som konstant,
   heller ikke udkommenteret.
3. **En test der fejler bygget** hvis nogen tilføjer dem:
   ```
   grep -ri "placeorder\|registernewpayment\|getcreditcards" src/  →  skal give 0 hits
   ```
   Det lyder paranoidt indtil den dag nogen — et menneske, eller en assistent der
   "hjælper" med at gøre flowet færdigt — tilføjer det i god tro.
4. **UI'et siger det højt.** Knappen hedder "Læg i nemlig-kurv", og under den
   står "Bestillingen gennemføres af dig hos nemlig".
5. **`BasketSyncLog`** gør enhver kurvændring sporbar.

Det er den eneste robuste tolkning af "byg ikke engang funktionen": koden kender
ikke adressen.

---

## 8. Hemmeligheder

- `.env` i `.gitignore` **fra første commit**. `.env.example` med tomme værdier
  committes. *(Repoets nuværende `.gitignore` har allerede `.env` — det er på plads.)*
- Nøgler: `NEMLIG_USERNAME`, `NEMLIG_PASSWORD`, `MADPLAN_DB_PATH`,
  `MADPLAN_ADMIN_EMAIL`. Ingen defaults i koden — appen skal **nægte at starte**
  hvis de mangler, ikke falde tilbage på noget.
- Kodeordet læses via `IConfiguration`, holdes aldrig i en statisk variabel og
  logges aldrig. Log-scrubbing på `Password`, `access_token`, `.ASPXAUTH`.
- Fixtures anonymiseres før commit: adresser, navne, kundenummer, ordrenumre.
- Self-hosting betyder at kodeordet ligger på en maskine i jeres hjem. Eksponér
  den ikke direkte mod internettet — Tailscale eller Cloudflare Tunnel, ikke
  port-forwarding.
- Overvej at slå to-faktor til på nemlig-kontoen **først når** I ved om det
  bryder login-flowet. Det er værd at teste under browser-sessionen (tjek 8 i
  `nemlig-api.md` §7), for hvis det bryder integrationen, er det en afvejning I
  skal tage bevidst frem for at opdage en tirsdag aften.
