# PAPI — Integrations

All integrations are **free tier**, server-side only, and isolated in
`src/integrations/<name>/`. Every adapter: fetch → zod-validate → normalize →
idempotent upsert. Verified against official docs (2026-08); rate limits and
auth summarized below.

## Source of truth

| Data | Owner |
| --- | --- |
| Guild identity/config, applications, trials, officer notes, needs | **PAPI** |
| Discord identity, roles, communication | **Discord** |
| Raid events, signups, (attendance input) | **Raid-Helper** |
| Guild roster (who is in the guild) | **Blizzard** |
| Character info | **Blizzard + Raider.IO** |
| Mythic+ | **Raider.IO** |
| Reports, boss performance, progression, attendance snapshots | **Warcraft Logs** |

PAPI never edits data it doesn't own; those flows stay read-only mirrors.

## Discord

- **OAuth**: `identify guilds.members.read`. After sign-in the backend calls
  `GET /users/@me/guilds/{DISCORD_GUILD_ID}/member` with the user token —
  returns the member object incl. role ids, **no bot needed**. 404 → not a
  guild member → PUBLIC.
- Role ids → PAPI roles via `DISCORD_ROLE_MAP` (role *names* would need a bot
  token; ids avoid that).
- **Outbound**: webhooks only (free, no gateway connection). `notify.ts`
  posts embeds; 429 handled with `retry_after`. Used for: new application,
  trial started, member accepted (more events in MVP 2).

## Raid-Helper (`raid-helper/adapter.ts`)

- Docs: https://raid-helper.dev/documentation/api
- Auth: server API key from the `/apikey` slash command, sent as
  `Authorization` header. `GET /api/v3/servers/{serverId}/events` (with
  `IncludeSignUps: true`); single events are public via
  `GET /api/v2/events/{id}`.
- Absence/Bench/Tentative/Late arrive as pseudo-classes on signups →
  normalized to signup statuses.
- **Read-only**: Raid-Helper owns event creation and signups. No premium
  webhooks needed — we poll on the sync schedule. Rate limits are
  undocumented; we run one request per sync and back off on 429.

## Raider.IO (`raider-io/adapter.ts`)

- Docs: https://raider.io/api — `GET /api/v1/characters/profile` with fields
  `gear,mythic_plus_scores_by_season:current,raid_progression,mythic_plus_recent_runs`.
- Auth: none required. **200 req/min** unauthenticated; optional
  `RAIDERIO_API_KEY` raises limits. The sync spaces requests 400 ms apart and
  browsers never call Raider.IO — a roster page view is 0 external requests.
- ToS: community use, no data resale. Attribution shown in the site footer.

## Warcraft Logs (`warcraft-logs/adapter.ts`)

- API v2 (GraphQL): token via `POST https://www.warcraftlogs.com/oauth/token`
  (client credentials, Basic auth), queries via
  `https://www.warcraftlogs.com/api/v2/client`.
- Free tier: **3,600 points/hour** — our per-sync usage is a single reports
  query (fights included), well under budget. Tokens cached in memory until
  expiry; secrets never reach the client bundle.
- Private logs would need user-consent OAuth — out of scope; guild logs are
  public.

## Battle.net (`blizzard/adapter.ts`)

- Token: `POST https://oauth.battle.net/token` (client credentials). Data:
  `GET https://{region}.api.blizzard.com/data/wow/guild/{realm}/{guild}/roster?namespace=profile-{region}`.
- Free, 36,000 req/h / 100 req/s — one call per sync.
- **MVP 2**: authorization-code flow with scope `wow.profile` +
  `GET /profile/user/wow` lists the user's characters → official character
  ownership verification (Discord identity + Battle.net account = verified
  member). No home-grown verification.

## Error handling contract

Every adapter: retry with backoff, 429 handling, hard timeout, typed
failure result. Failures are recorded in `sync_runs` and surface on
`/admin/integrations` (never with secrets). The UI always renders the last
good data with its sync timestamp ("Last updated 12 minutes ago").
