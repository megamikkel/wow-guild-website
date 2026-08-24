# PAPI — Deployment

Target: **0 kr./month.**

| Piece | Service | Free-tier notes |
| --- | --- | --- |
| App | Vercel Hobby | Fluid compute, 300 s max function duration |
| Postgres | Neon Free | 0.5 GB, 100 compute-hours/mo, scale-to-zero |
| Sync cron | GitHub Actions `schedule` | Vercel Hobby cron is once-daily only, so Actions calls `/api/sync` every 30 min (best-effort timing; auto-disabled after 60 days of repo inactivity — any commit re-arms it) |
| Discord notifications | Webhooks | free, no bot hosting |

## Modes

- **Demo mode** (default in dev, or `PAPI_DEMO_MODE=true`): embedded PGlite
  Postgres, migrated + seeded with fixtures on boot; external syncs are
  skipped; demo logins enabled. Nothing external required.
- **Production**: requires `DATABASE_URL`; the app **fails fast at startup**
  if production is missing it and demo mode wasn't explicitly enabled —
  production can never silently serve demo data.

## First deployment

1. Create a Neon project → copy the connection string.
2. Vercel → import the GitHub repo (framework auto-detected).
3. Set env vars from `.env.example`: `DATABASE_URL`, `AUTH_SECRET`,
   `PAPI_SITE_URL`, `PAPI_SYNC_SECRET`, plus the Discord/Blizzard/WCL/
   Raid-Helper credentials you have. Missing integrations degrade gracefully
   to "Not configured" on `/admin/integrations`.
4. Run migrations against Neon: `DATABASE_URL=… npm run db:migrate`.
5. Discord developer portal: add redirect
   `https://<site>/api/auth/callback/discord`.
6. GitHub repo settings: variable `SYNC_URL=https://<site>/api/sync`,
   secret `SYNC_SECRET=<PAPI_SYNC_SECRET>` → the scheduled workflow starts
   syncing.

## Local development

```
npm install
npm run dev        # demo mode, no configuration needed
npm test           # vitest unit tests
npm run lint && npm run typecheck && npm run build
```

## Security checklist (implemented)

- RBAC enforced in server layouts/pages/actions (`requireRole`) — middleware
  is UX only
- Secrets only in env vars; `.env*` gitignored; none in client bundles
  (adapters are server-only modules)
- Zod validation on all forms and all external API responses
- Rate limiting + honeypot on the public application form
- Auth.js handles OAuth state/PKCE + CSRF on auth routes; server actions are
  origin-checked by Next.js
- Security headers (nosniff, frame-deny, referrer-policy) in `next.config.ts`
- `/dashboard` + `/admin` sent `X-Robots-Tag: noindex`
- Audit log on administrative actions
- Sync endpoint requires bearer secret; returns 503 if unconfigured
