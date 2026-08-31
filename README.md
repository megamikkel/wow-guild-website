# PAPI — Guild Platform

The digital operating system for the PAPI World of Warcraft guild: the
website is the command center, Discord is the communication layer, and
Battle.net, Raider.IO, Raid-Helper and Warcraft Logs deliver the data.

> We don't raid to participate. We raid to progress.

## Quick start

```sh
npm install
npm run dev
```

That's it — with no configuration the platform boots in **demo mode**: an
embedded Postgres (PGlite) is migrated and seeded with realistic fixtures
(roster, raids, signups, progression, applications, trials, activity), and
three demo logins (raider / officer / admin) are available on `/login`.

## What's inside

| Area | Routes |
| --- | --- |
| Public | `/` `/progression` `/roster` `/roster/[realm]/[name]` `/raids` `/raids/[id]` `/recruitment` `/apply` `/optimizer` |
| Member | `/dashboard` (Discord login, MEMBER+) |
| Officer | `/admin` `/admin/applications` `/admin/trials` `/admin/integrations` (OFFICER+) |
| API | `/api/auth/*` (Auth.js) · `POST /api/sync` (bearer-protected background sync) · `/api/optimizer` (gear optimization jobs) |

**Stack**: Next.js 15 · TypeScript · Tailwind CSS 4 · PostgreSQL · Drizzle ·
Auth.js (Discord OAuth) · Zod · Vitest. One app, no microservices, $0/month
on free tiers.

## Deploy

Free on **Vercel Hobby** — no credit card, Next.js detected automatically.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmegamikkel%2Fwow-guild-website&env=PAPI_DEMO_MODE,AUTH_SECRET&envDescription=Set%20PAPI_DEMO_MODE%20to%20true%20for%20a%20zero-config%20demo%2C%20and%20AUTH_SECRET%20to%20a%20random%20string)

Two environment variables get you a working deployment with seeded demo data:
`PAPI_DEMO_MODE=true` and `AUTH_SECRET` (any random string). For real
persistence, add a free [Neon](https://neon.com) Postgres and set
`DATABASE_URL` instead. Full steps, including Discord OAuth and the scheduled
sync, are in [docs/deployment.md](docs/deployment.md).

## Documentation

- [Product spec](docs/product-spec.md)
- [Gear optimizer](docs/gear-optimizer.md) — `/simc` string → best owned gear, via SimulationCraft
- [Architecture](docs/architecture.md) — system diagram, layering, caching
- [Database](docs/database.md)
- [Integrations](docs/integrations.md) — APIs, auth, rate limits, data ownership
- [Design system](docs/design-system.md)
- [Deployment](docs/deployment.md) — Vercel + Neon + GitHub Actions sync

## Commands

```sh
npm run dev          # dev server (demo mode without config)
npm test             # unit tests
npm run lint         # eslint
npm run typecheck    # tsc
npm run build        # production build
npm run db:generate  # regenerate migrations after schema changes
npm run db:migrate   # apply migrations to $DATABASE_URL
npm run optimize     # gear optimizer CLI (needs SimulationCraft, see docs)
```

## Configuration

Copy `.env.example` to `.env.local` and fill in what you have. Every
integration degrades gracefully when unconfigured; production requires
`DATABASE_URL` and refuses to fall back to demo data silently.

---

Data powered by Raider.IO, Warcraft Logs and the Blizzard API. World of
Warcraft is a trademark of Blizzard Entertainment; PAPI is not affiliated
with Blizzard.
