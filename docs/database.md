# PAPI — Database

PostgreSQL, schema in `src/lib/db/schema.ts` (Drizzle), migrations in
`/drizzle`. Demo mode runs the same schema on embedded PGlite, migrated and
seeded at first use (`src/lib/db/seed.ts`).

## Entities

```
users ─────────────┐            (Discord identity + PAPI role)
                   │ userId
characters ────────┤            (roster; synced from Blizzard/Raider.IO)
  │ characterId    │
  ├── mythic_plus_runs          (Raider.IO recent keys)
  ├── character_performance ──── raid_reports (WCL percentiles per report)
  └── raid_signups ──── raid_events   (Raid-Helper, read-only mirror)

boss_progress                   (per boss of current tier; WCL-derived)
raid_reports                    (WCL report index)

recruitment_needs               (PAPI-owned: what we recruit)
applications ── application_notes (officer-only)
            └── trials          (also linkable to characters)

activity_events                 (unified guild feed, any source)
integration_connections         (health per external service)
sync_runs                       (sync history)
audit_logs                      (administrative actions)
guild_settings                  (key/value)
```

## Conventions

- **External ids** are stored on every synced entity (`raidHelperId`,
  `wclCode`, `blizzardId`, `raiderIoRunId`) with unique indexes → syncs are
  idempotent upserts.
- **Enums** are Postgres enums (`papi_role`, `application_status`,
  `signup_status`, `boss_status`, …) so illegal states are unrepresentable.
- `application_notes` and `audit_logs` are officer/admin data — no public
  query path exists for them (enforced in `src/domain/queries.ts` +
  `requireRole` on the pages/actions that read them).
- Timestamps are `timestamptz`. Display formatting uses the guild timezone
  from `src/config/guild.ts`.
- Attendance/performance aggregates are denormalized onto `characters`
  (`attendancePct`, `avgPerformance`) by sync jobs; raw signals stay in
  `raid_signups` / `character_performance`.

## Migrations

```
npm run db:generate   # after editing schema.ts
npm run db:migrate    # apply to $DATABASE_URL (production/staging)
```

Demo mode applies the same migration files automatically at boot.
