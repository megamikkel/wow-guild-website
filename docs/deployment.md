# PAPI — Deployment

Target: **0 kr./month.**

## Fastest route: Cloudflare Pages (static)

Cloudflare Pages builds this repository directly — **no secrets, no tokens, no
GitHub Actions involved**. Free tier: unlimited requests and bandwidth, 500
builds per month, custom domains included.

In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to
Git**, pick `megamikkel/wow-guild-website`, then set exactly:

| Setting | Value |
| --- | --- |
| Production branch | `claude/papi-wow-guild-platform-4nxyiy` |
| Framework preset | **None** |
| Build command | `node scripts/build-static-preview.mjs` |
| Build output directory | `out` |

Nothing else. The build script sets its own environment. Deploy, and the site
is live at `<project>.pages.dev`, rebuilt on every push.

**What ships:** home, progression, roster with a page per character, raids with
a page per raid, and recruitment — pre-rendered from the demo fixtures, with
`_headers` restoring the security headers that `next.config.ts` can only apply
at request time.

**What cannot:** a static host runs no server, so sign-in, the member
dashboard, the officer tools and form submission are absent. A banner on every
page says so, and the build is excluded from search engines. For those, the
site needs a Node runtime — see Vercel below.

### If the project was created as a Worker rather than a Page

Cloudflare has merged the two products, so "Create → Workers" also serves
static sites. `wrangler.jsonc` in the repository root configures exactly that:
no server code, just `./out` uploaded as assets, with the exported `404.html`
serving unknown paths. `npx wrangler deploy` needs no arguments.

`wrangler.jsonc` also declares its own `build.command`, which wrangler runs
before uploading. That means Cloudflare's default build settings work
untouched: whatever the dashboard runs first, `npx wrangler deploy` then
produces `./out` itself and deploys it.

The dashboard's `npm run build` is the **application** build — a Next.js
server bundle, not files. It is harmless but redundant here; setting the build
command to `npm run build:cloudflare` skips the wasted work.

### Alternative: let GitHub build and push it

`.github/workflows/deploy-cloudflare.yml` does the same thing from CI. It needs
a repository **variable** `CLOUDFLARE_PROJECT_NAME` (the workflow skips without
it) and two **secrets**: `CLOUDFLARE_API_TOKEN` — created from the
"Cloudflare Pages — Edit" template — and `CLOUDFLARE_ACCOUNT_ID`, which is the
hex string in any dashboard URL. Use this only if you would rather not give
Cloudflare access to the repository; the direct connection above is simpler.

## Full application: Vercel Hobby

Vercel builds Next.js natively, so there is nothing to configure — no
Dockerfile, no adapter, no build command. The Hobby plan is free, permanent
and needs no credit card.

**The one restriction that matters:** Hobby is **non-commercial only**, and
single-developer (no shared dashboard). A guild site qualifies; if PAPI ever
sells merch through the site, that moves it to Pro at $20/month.

Free allowance, as of 2026: 100 GB data transfer, 1M function invocations,
4 CPU-hours of active compute, 100 deployments/day, 200 projects. Exceeding a
limit **pauses the project rather than billing you** — there is no overage on
Hobby.

### Path A — deploy in two minutes, no database

Demo mode runs the whole platform on an embedded PGlite Postgres, seeded with
fixtures at boot. No external services at all.

1. vercel.com → **Add New… → Project** → import
   `megamikkel/wow-guild-website` → pick branch `claude/papi-wow-guild-platform-4nxyiy`.
2. Framework is detected as Next.js. Leave every build setting alone.
3. Add two environment variables:

   ```
   PAPI_DEMO_MODE = true
   AUTH_SECRET    = <output of: openssl rand -base64 32>
   ```

4. Deploy.

`PAPI_DEMO_MODE=true` must be set **explicitly**. Without it the app refuses to
start in production rather than silently serving fake data — that guard is
deliberate (`src/lib/env.ts`).

What you get: every page, the demo logins on `/login` (raider / officer /
admin), the full recruitment pipeline. What you do not get: persistence.
The database lives in the function's memory, so anything submitted disappears
when the instance recycles, and each cold start re-seeds. Fine for showing
people the site; not fine for real applications.

### Path B — a real deployment

Add [Neon](https://neon.com) free Postgres: 0.5 GB storage and 100
compute-hours per project per month, no credit card, scale-to-zero after 5
minutes idle. Limits are hard cutoffs — the database suspends rather than
charging you.

1. Create a Neon project, copy the connection string.
2. Apply the schema from your machine:
   ```sh
   DATABASE_URL="postgres://…" npm run db:migrate
   ```
3. In Vercel set `DATABASE_URL`, `AUTH_SECRET`, `PAPI_SITE_URL`, and
   `PAPI_SYNC_SECRET` (`openssl rand -hex 32`). Leave `PAPI_DEMO_MODE` unset
   or `false`.
4. Redeploy.
5. Discord developer portal → add the OAuth redirect
   `https://<your-domain>/api/auth/callback/discord`, then set
   `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_GUILD_ID` and
   `DISCORD_ROLE_MAP`.
6. GitHub repo settings → variable `SYNC_URL=https://<domain>/api/sync` and
   secret `SYNC_SECRET` matching `PAPI_SYNC_SECRET`. The scheduled workflow
   then drives the integration syncs.

Integrations you have not configured degrade to "Not configured" on
`/admin/integrations` rather than breaking anything.

## The GitHub Pages preview (built, waiting on one switch)

`.github/workflows/preview.yml` publishes a static preview of the public site
to GitHub Pages — free on a public repository, no account or card. It builds
and deploys on every push to the feature branch.

It is complete and has been run. It stops at one step:

```
Create Pages site failed.
Error: Resource not accessible by integration
```

A workflow's `GITHUB_TOKEN` can **deploy** to a Pages site but cannot
**create** one; GitHub withholds that permission from automation by design.
Pushing a `gh-pages` branch no longer auto-enables Pages either.

**To activate it**, once, by hand:

> Repository **Settings → Pages → Build and deployment → Source →
> GitHub Actions**

Then re-run the workflow (Actions tab → *Deploy preview to GitHub Pages* →
Run workflow). The site appears at
`https://megamikkel.github.io/wow-guild-website/` and updates on every push
from then on. `enablement: true` in the workflow becomes a no-op once Pages
exists, so nothing needs changing afterwards.

What the preview contains: home, progression, roster (a page per character),
raids (a page per raid) and recruitment, pre-rendered with the demo fixtures.
What it cannot contain, because a file host runs no server: sign-in, the
member dashboard, the officer tools, and form submission. A banner on every
page says so, and the preview is excluded from search engines.

## Why not the others

| Option | Verdict |
| --- | --- |
| **Netlify** | Works, but Next.js runs through an adapter — more moving parts for no gain |
| **Cloudflare Workers** (the full app, not Pages) | Would need `@opennextjs/cloudflare` plus D1 or Hyperdrive, and PGlite's filesystem-backed migrations do not survive the Workers runtime. Cloudflare *Pages* serves the static site perfectly well — see above |
| **Render free tier** | Real container, but the free service sleeps after inactivity and cold starts run tens of seconds — poor for a recruitment page |
| **Railway / Fly.io** | No longer meaningfully free; both moved to trial credit |

If you ever want a container host anyway, add `output: "standalone"` to
`next.config.ts` — the build already traces PGlite's WASM and the migration
SQL correctly, verified against a standalone build.

## Local development

```sh
npm install
npm run dev        # demo mode, no configuration needed
npm test           # vitest unit tests
npm run lint && npm run typecheck && npm run build
```

## Security checklist (implemented)

- RBAC enforced in server layouts, pages and actions (`requireRole`) —
  middleware is UX only
- Secrets only in env vars; `.env*` gitignored; none reach client bundles
- Zod validation on all forms and all external API responses
- Rate limiting and a honeypot on the public application form
- Auth.js handles OAuth state/PKCE; server actions are origin-checked by Next
- Security headers (nosniff, frame-deny, referrer-policy) in `next.config.ts`
- `/dashboard` and `/admin` sent `X-Robots-Tag: noindex`
- Audit log on administrative actions
- Sync endpoint requires a bearer secret; returns 503 when unconfigured

**Before a real deployment**, set a real `AUTH_SECRET`. In demo mode the app
falls back to a hardcoded development secret so it can boot with no
configuration — that value is public, in this repository, and must never
protect real sessions.
