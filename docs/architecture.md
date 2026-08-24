# PAPI — Architecture

One application. No microservices. Server-rendered Next.js talking to its own
Postgres; external APIs only ever touched by server-side sync jobs.

```
                    WORLD OF WARCRAFT
                           │
                           ▼
                     Battle.net API
                           │
             ┌─────────────┼─────────────┐
             │             │             │
             ▼             ▼             ▼
        RAID-HELPER     RAIDER.IO    WARCRAFT LOGS
         raids           M+           performance
         signups         score        reports
         attendance      chars        progression
             │             │             │
             └─────────────┼─────────────┘
                           │   (scheduled sync, server-side only)
                           ▼
                      PAPI BACKEND  (Next.js route handlers + server actions)
                           │
                    PAPI DATABASE  (Postgres via Drizzle; PGlite in demo mode)
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
         PAPI WEBSITE               DISCORD
         dashboard                  OAuth identity + roles
         roster                     webhook notifications
         recruitment                communication stays here
         progression
         officer tools
```

## Stack (decision record)

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15 (App Router, RSC) | Server-rendered public pages + app-like member/officer areas in one codebase; mature Auth.js support; the repo's Astro starter carried no content worth keeping |
| Language | TypeScript strict | required |
| Styling | Tailwind CSS 4 | design tokens in CSS (`src/styles/globals.css`) |
| Database | PostgreSQL, Drizzle ORM + SQL migrations | typed schema, `drizzle-kit generate/migrate` |
| Demo DB | PGlite (embedded Postgres) | full platform with zero external services; see `docs/deployment.md` |
| Auth | Auth.js v5, Discord provider, JWT sessions | Discord is the identity; roles mapped server-side |
| Validation | Zod | forms and every external API response |
| Hosting | Vercel Hobby + Neon Free (target) | $0; see deployment doc |
| Sync scheduling | GitHub Actions cron → `POST /api/sync` | Vercel Hobby cron is once-daily only |

## Layering rules

```
External API → integrations/<name>/adapter.ts → zod validation → normalize → DB
Pages/components → src/domain/queries.ts → DB          (never external shapes)
Mutations → server actions → requireRole() → DB (+ audit log)
```

- `src/config/guild.ts` — single place for guild identity (realm, schedule,
  tier, targets). Placeholders live here, not scattered in components.
- `src/lib/rbac.ts` — role hierarchy; **all checks server-side**. Middleware
  only does optimistic redirects; layouts/pages/actions enforce.
- `src/integrations/*` — one folder per external service; nothing outside it
  may import external response types.
- Sync results land in `sync_runs` + `integration_connections` (health page).
- Stale-while-revalidate at the database level: pages always read local data;
  an external outage means stale data, never a broken site.

## Caching / freshness targets

| Data | Freshness |
| --- | --- |
| Raid events + signups | 15–30 min (sync cadence) |
| Boss progress / reports | 30 min on raid nights, else hours |
| Roster (Blizzard) | 1–6 h |
| M+ (Raider.IO) | 1–6 h |
| Closed raids / old reports | immutable after close |

The single `/api/sync` endpoint accepts `?integration=` filters so different
cadences can be scheduled without code changes.
