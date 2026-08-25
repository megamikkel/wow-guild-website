# PAPI — Product Spec

PAPI is not a guild homepage. It is the guild's **digital operating system**:
the website is the command center, Discord is the communication layer,
external WoW services deliver the data.

## Audiences & jobs-to-be-done

| Audience | Job | Success looks like |
| --- | --- | --- |
| Visitor / recruit | Understand who PAPI is in ~5 seconds, apply | "These people have their act together" |
| Member | See everything relevant in 20 seconds | Next raid, own status, guild pulse on `/dashboard` |
| Officer | See exactly what needs attention | Actions-required triage on `/admin` |

## Feature scope

### MVP 1 (built)
- **Public**: homepage (recruitment machine), progression, roster, character
  profiles, raids overview/detail, recruitment, application form
- **Auth**: Discord OAuth (`identify guilds.members.read`), server-side RBAC
  (PUBLIC → MEMBER → TRIAL → RAIDER → OFFICER → ADMIN), demo logins in demo mode
- **Member**: dashboard (next raid + own signup, personal stats, readiness,
  activity)
- **Officer**: command center with actions-required, recruitment pipeline
  (NEW → REVIEW → INTERVIEW → TRIAL → ACCEPTED/DECLINED) with officer-only
  notes and audit log, trial tracking, integration health
- **Integrations**: Raider.IO, Raid-Helper (read-only), Warcraft Logs,
  Battle.net roster, Discord webhooks — all server-side, cached in Postgres
- **Foundation**: normalized database, demo mode with realistic fixtures,
  design system, CI, tests

### MVP 2 (next)
Battle.net account linking (character ownership), advanced attendance,
roster health trends, raid readiness (enchants/vault via Blizzard equipment
API), richer activity feed sources, Discord notifications for raids/kills,
advanced performance analysis.

### Explicitly NOT building
Forum, private messaging, loot council/DKP, custom signup engine (Raid-Helper
owns signups), WCL/Raider.IO clones, Discord replacement. PAPI aggregates and
improves; it does not reinvent.

## Tone

Confident, competitive, a little funny, never corporate. Example: empty
application queue reads "Quiet day. No fresh meat yet." Usability always
beats personality.

## End goal

- Recruit: *"These people run their guild professionally."*
- Member: *"Everything relevant in 20 seconds."*
- Officer: *"I see exactly what needs my attention."*
- Visitor: *"This does not look like a normal guild site."*
