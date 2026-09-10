# Mintmark Facebook Radar – V1

Et lille, selvstændigt og **read-only** værktøj, der kigger igennem de nyeste opslag i
udvalgte private danske Facebook-grupper om TCG/Pokémon-handel og finder de få opslag,
hvor personen faktisk beder om hjælp til pris, værdi, markedspris eller hvor et produkt
kan findes billigst.

Værktøjet **skriver, kommenterer, liker eller kontakter aldrig nogen** på Facebook. Det
åbner ingen profiler, henter ingen billeder og læser ingen kommentarer. Det forsøger
aldrig at omgå CAPTCHA, checkpoints, MFA eller andre sikkerhedsmekanismer – hvis Facebook
beder om manuel godkendelse, stopper programmet og beder dig ordne det selv i browseren.

Alt kører lokalt: Node.js, TypeScript, Playwright (Chromium), SQLite og en minimal
lokal webserver. Ingen cloud-database.

## Kom i gang

Kræver Node.js 20 eller nyere. Virker på Windows, macOS og Linux.

```bash
cd mintmark-facebook-radar
npm install
npx playwright install chromium
npm run login
npm run scan
npm run dashboard
```

| Kommando            | Hvad den gør                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| `npm run login`     | Åbner Chromium (synligt) på facebook.com. Du logger selv ind. Sessionen gemmes i `playwright-profile/`. |
| `npm run scan`      | Åbner hver gruppe, scroller kontrolleret, henter op til 50 nyere opslag pr. gruppe, gemmer nye i SQLite og klassificerer dem. |
| `npm run dashboard` | Starter review-interfacet på <http://localhost:3742>.                                           |
| `npm run classify`  | Klassificerer kun opslag der endnu ikke er klassificeret (uden at åbne browseren).             |
| `npm run diagnose`  | Diagnostic mode: gemmer sanitiseret DOM, screenshot og parser-oversigt i `data/diagnostics/`.   |
| `npm run try`       | Prøver classifieren af på tekster uden Facebook og uden database. Se nedenfor.                  |
| `npm run check`     | Lint + TypeScript-check + tests.                                                                |

Intet Facebook-password gemmes nogensinde – hverken i kode, `.env` eller database.
Browserprofilen (`playwright-profile/`), databasen og logs ligger i `.gitignore`.

## Konfigurér de fire grupper

Redigér `config/groups.json`. Udskift `GROUP_URL` med den fulde URL til hver gruppe
(kopiér den fra adresselinjen når du er inde i gruppen):

```json
[
  { "id": "group1", "name": "Pokémon Køb & Salg DK", "url": "https://www.facebook.com/groups/123456789012345" },
  { "id": "group2", "name": "TCG Handel Danmark",   "url": "https://www.facebook.com/groups/tcghandeldk" },
  { "id": "group3", "name": "Facebook gruppe 3",     "url": "GROUP_URL" },
  { "id": "group4", "name": "Facebook gruppe 4",     "url": "GROUP_URL" }
]
```

- `id` skal være unikt og bruges i databasen – ændr det ikke bagefter.
- `name` vises i dashboardet.
- Grupper hvor `url` stadig er `GROUP_URL` springes over med en advarsel, så du kan
  konfigurere dem én ad gangen.

## Klassificering (LLM eller regler)

Klassificeringen ligger bag et lille interface (`src/classifier/types.ts`), så
udbyderen kan skiftes senere. Der følger to implementationer med:

- **`anthropic`** – Claude via Anthropic API med struktureret JSON-output. Bruges
  automatisk når `ANTHROPIC_API_KEY` er sat. Model vælges med `RADAR_LLM_MODEL`
  (default `claude-opus-5`).
- **`rules`** – en indbygget, deterministisk dansk regel-classifier uden netværk.
  Bruges når der ikke er nogen API-nøgle, og som reference i tests.

Kopiér `.env.example` til `.env` og udfyld det du har brug for:

```
ANTHROPIC_API_KEY=sk-ant-...
RADAR_CLASSIFIER=anthropic      # eller rules
RADAR_MAX_POSTS_PER_GROUP=50
RADAR_HEADLESS=false            # true = usynligt browservindue under scan
RADAR_PORT=3742
```

Kategorier: `PRICE_HELP`, `VALUATION_HELP`, `MARKET_HELP`, `PRODUCT_SEARCH` (kan være
relevante) samt `SALE_ONLY`, `BUY_ONLY`, `TRADE_ONLY`, `OTHER` (aldrig relevante).
At ordet "pris" forekommer gør ikke et opslag relevant: "Pris 900 kr." er `SALE_ONLY`,
"Er 900 kr. en fair pris?" er `PRICE_HELP`. Vi optimerer efter høj precision.

### Prøv classifieren af på rigtige tekster

Uden at åbne Facebook eller røre databasen:

```bash
npm run try -- "Er 900 kr. en fair pris?"
npm run try -- --file opslag.txt      # ét opslag pr. linje, eller adskil med en linje med ---
```

Nyttigt til at finjustere kategorier og precision på faktiske opslag fra grupperne,
før man kører et rigtigt scan.

## Review-interfacet

Forsiden viser relevante opslag sorteret: ikke gennemgået først, derefter confidence
faldende, derefter nyeste først. Hvert kort viser kategori, confidence, gruppe, tekst,
tidspunkt og et "Åbn på Facebook"-link. Knapper:

- ✅ **Korrekt hit** – AI'en havde ret (true positive)
- ❌ **Forkert hit** – AI'en tog fejl (false positive)
- ☑ **Behandlet** – du har gjort noget ved opslaget
- ↺ – nulstil review

Visninger: relevante, irrelevante, alle og forkert klassificerede. Menneskets vurdering
gemmes separat fra AI'ens (`human_relevant` vs. `relevant`), og dashboardet viser antal
analyserede opslag, AI-hits, true positives, false positives og precision.

## Hvis Facebook bliver ved med at vise CAPTCHA

En helt frisk browserprofil har ingen historik, og Playwrights egen Chromium ser
fremmed ud for Facebook. Prøv din installerede Chrome i stedet ved at sætte i `.env`:

```
RADAR_BROWSER_CHANNEL=chrome
```

Understøttede værdier: `chrome`, `chrome-beta`, `msedge`, `msedge-beta`. Det er et
valg af hvilken browser der startes, ikke maskering eller anden evasion. Værktøjet
forsøger aldrig at omgå CAPTCHA, checkpoints eller MFA - kommer der en kontrol,
gennemfører du den selv i vinduet.

## Hvis Facebook ændrer markup

Alle Facebook-selectors ligger ét sted: `src/facebook/selectors.ts`. Kør
`npm run diagnose` for at få en sanitiseret kopi af DOM'en (uden scripts, formularværdier
og query-strenge), et screenshot og en `summary.json` med hvad parseren kunne finde. Ret
selectors, kør `npm test` (parser-testen bruger en fixture i `tests/fixtures/`) og scan igen.

Parsing-fejl på et enkelt opslag logges og springes over – scanningen fortsætter.
Opslag uden Facebook post-id gemmes med en hash af gruppe + tekst som nøgle, så
dedup stadig virker.

## Struktur

```
src/
  facebook/     browser.ts auth.ts scanner.ts parser.ts selectors.ts diagnostics.ts types.ts
  classifier/   classifier.ts prompt.ts rules.ts anthropic.ts types.ts
  database/     db.ts migrations.ts repositories.ts
  dashboard/    server.ts routes.ts views.ts
  config/       config.ts
  logger.ts scan.ts login.ts dashboard.ts diagnose.ts
config/groups.json
data/           radar.db, logs/, diagnostics/   (ignoreret af git)
playwright-profile/                              (ignoreret af git)
tests/
```

## Logging

Logs skrives til konsollen og `data/logs/radar-YYYY-MM-DD.log`: scanning startet,
gruppe startet, antal fundne/nye opslag, parsing- og classification-fejl, scan afsluttet.
Nøgler der ligner cookies, tokens eller auth-state maskeres før de skrives.

## Ikke i V1

Mintmark-produktmatching, automatiske kommentarer/likes/beskeder, scraping af profiler
eller kommentarer, Telegram/Discord/email-notifikationer, Task Scheduler, cloud-deployment,
proxyer, CAPTCHA-bypass, stealth/evasion og fingerprint-manipulation.

## Udvikling

```bash
npm run lint
npm run typecheck
npm test
```

Testene kræver Chromium (`npx playwright install chromium`). Sæt evt.
`RADAR_CHROMIUM_PATH` til en eksisterende Chromium-binær.
