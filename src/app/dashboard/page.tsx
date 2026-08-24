import Link from "next/link";

import { Countdown } from "@/components/Countdown";
import { SectionHeading, StatBlock, StatusPill, Surface } from "@/components/ui";
import { getMemberDashboard } from "@/domain/queries";
import { auth } from "@/lib/auth";
import { formatRelative, formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Up late";
  if (hour < 11) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const session = await auth();
  const { nextRaid, activity, progression, character, signupStatus } = await getMemberDashboard(
    session?.user?.dbUserId,
  );
  const name = session?.user?.name ?? character?.name ?? "raider";

  const readiness = character
    ? [
        {
          label: "Character data synced",
          ok: Boolean(character.syncedAt && Date.now() - character.syncedAt.getTime() < 24 * 3_600_000),
          detail: character.syncedAt ? formatRelative(character.syncedAt) : "never",
        },
        {
          label: "Signed for next raid",
          ok: signupStatus === "CONFIRMED",
          detail: signupStatus ? signupStatus.toLowerCase().replace("_", " ") : "no response",
        },
        {
          label: "Item level on curve",
          ok: (character.itemLevel ?? 0) >= 705,
          detail: character.itemLevel ? String(character.itemLevel) : "unknown",
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <header className="mb-10">
        <p className="stat-label mb-1">Member dashboard</p>
        <h1 className="display-heading text-4xl sm:text-5xl">
          {greeting()}, <span className="text-papi-purple">{name}</span>.
        </h1>
      </header>

      {/* Next raid */}
      <Surface className="mb-8 grid gap-6 p-6 sm:grid-cols-[1.2fr_1fr] sm:p-8">
        {nextRaid ? (
          <>
            <div>
              <p className="stat-label">Next raid</p>
              <p className="display-heading mt-1 text-3xl">
                {nextRaid.event.targetBoss ?? nextRaid.event.title}
              </p>
              <p className="mt-1 text-ink-muted">
                {formatRelative(nextRaid.event.startTime)} · {formatTime(nextRaid.event.startTime)}
              </p>
              <div className="mt-4">
                <Countdown target={nextRaid.event.startTime.toISOString()} className="text-3xl" />
              </div>
            </div>
            <div className="flex flex-col justify-center gap-3">
              <div className="flex items-center justify-between">
                <span className="stat-label">You</span>
                {signupStatus === "CONFIRMED" ? (
                  <StatusPill tone="ok">Signed — yes</StatusPill>
                ) : signupStatus === "ABSENT" ? (
                  <StatusPill tone="danger">Absent</StatusPill>
                ) : signupStatus ? (
                  <StatusPill tone="warn">{signupStatus.toLowerCase()}</StatusPill>
                ) : (
                  <StatusPill tone="warn">Not signed — Raid-Helper awaits</StatusPill>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="stat-label">Guild</span>
                <span className="font-mono text-lg tabular-nums">
                  {nextRaid.breakdown.totalConfirmed} / {nextRaid.breakdown.totalTarget}
                </span>
              </div>
              <Link
                href={`/raids/${nextRaid.event.id}`}
                className="font-display text-xs font-bold tracking-[0.14em] text-papi-purple uppercase hover:underline"
              >
                View raid →
              </Link>
            </div>
          </>
        ) : (
          <p className="text-ink-muted">No raid scheduled. A rare night off — go touch grass.</p>
        )}
      </Surface>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Your week */}
        <section>
          <SectionHeading kicker="You" title="Your week" />
          {character ? (
            <div className="grid gap-6">
              <StatBlock
                label="Raid attendance"
                value={character.attendancePct != null ? `${Math.round(character.attendancePct)}%` : "—"}
              />
              <StatBlock
                label="M+ score"
                value={
                  character.mythicPlusScore
                    ? Math.round(character.mythicPlusScore).toLocaleString("en-GB")
                    : "—"
                }
                accent="purple"
              />
              <StatBlock
                label="Latest raid performance"
                value={character.avgPerformance != null ? Math.round(character.avgPerformance) : "—"}
              />
              <Link
                href={`/roster/${character.realmSlug}/${encodeURIComponent(character.name)}`}
                className="font-display text-xs font-bold tracking-[0.14em] text-papi-purple uppercase hover:underline"
              >
                {character.name} — full profile →
              </Link>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">
              No character linked to your account yet. An officer can link your main on the
              roster.
            </p>
          )}
        </section>

        {/* Raid readiness */}
        <section>
          <SectionHeading kicker="Checks" title="Raid readiness" />
          {readiness.length === 0 ? (
            <p className="text-sm text-ink-muted">Link a character to see readiness checks.</p>
          ) : (
            <ul className="grid gap-3">
              {readiness.map((r) => (
                <li
                  key={r.label}
                  className="flex items-center justify-between gap-3 rounded-lg border border-edge bg-surface px-4 py-3 text-sm"
                >
                  <span>{r.label}</span>
                  {r.ok ? (
                    <StatusPill tone="ok">✓ {r.detail}</StatusPill>
                  ) : (
                    <StatusPill tone="warn">! {r.detail}</StatusPill>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Guild activity */}
        <section>
          <SectionHeading kicker="Guild" title="Activity" />
          <ol className="divide-y divide-edge border-y border-edge">
            {activity.map((a) => (
              <li key={a.id} className="py-2.5">
                <p className="text-sm">{a.title}</p>
                <p className="text-xs text-ink-faint">{formatRelative(a.occurredAt)}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-ink-muted">
            Boss progress:{" "}
            <span className="font-mono text-stripe-red">
              {progression.progressBoss?.bestPct?.toFixed(1) ?? "—"}%
            </span>{" "}
            on {progression.progressBoss?.bossName ?? "—"}
          </p>
        </section>
      </div>
    </div>
  );
}
