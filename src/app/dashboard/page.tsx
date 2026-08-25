import Link from "next/link";

import { Countdown } from "@/components/Countdown";
import { SectionHeading, StatBlock, StatusPill, Surface } from "@/components/ui";
import { getMemberDashboard } from "@/domain/queries";
import { auth } from "@/lib/auth";
import { formatRelative, formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Sent oppe";
  if (hour < 11) return "Godmorgen";
  if (hour < 18) return "God eftermiddag";
  return "Godaften";
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
          label: "Karakterdata opdateret",
          ok: Boolean(character.syncedAt && Date.now() - character.syncedAt.getTime() < 24 * 3_600_000),
          detail: character.syncedAt ? formatRelative(character.syncedAt) : "aldrig",
        },
        {
          label: "Tilmeldt næste raid",
          ok: signupStatus === "CONFIRMED",
          detail: signupStatus ? signupStatus.toLowerCase().replace("_", " ") : "intet svar",
        },
        {
          label: "Item level følger med",
          ok: (character.itemLevel ?? 0) >= 705,
          detail: character.itemLevel ? String(character.itemLevel) : "ukendt",
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <header className="mb-10">
        <p className="banner mb-3">Min side</p>
        <h1 className="display-heading text-4xl sm:text-5xl">
          {greeting()}, <span className="text-papi-purple">{name}</span>.
        </h1>
      </header>

      {/* Next raid */}
      <Surface className="mb-8 grid gap-6 p-6 sm:grid-cols-[1.2fr_1fr] sm:p-8">
        {nextRaid ? (
          <>
            <div>
              <p className="stat-label">Næste raid</p>
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
                <span className="stat-label">Dig</span>
                {signupStatus === "CONFIRMED" ? (
                  <StatusPill tone="ok">Tilmeldt</StatusPill>
                ) : signupStatus === "ABSENT" ? (
                  <StatusPill tone="danger">Kan ikke</StatusPill>
                ) : signupStatus ? (
                  <StatusPill tone="warn">{signupStatus.toLowerCase()}</StatusPill>
                ) : (
                  <StatusPill tone="warn">Ikke tilmeldt endnu</StatusPill>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="stat-label">Guilden</span>
                <span className="font-mono text-lg tabular-nums">
                  {nextRaid.breakdown.totalConfirmed} / {nextRaid.breakdown.totalTarget}
                </span>
              </div>
              <Link
                href={`/raids/${nextRaid.event.id}`}
                className="font-display text-xs font-bold tracking-[0.14em] text-papi-purple uppercase hover:underline"
              >
                Se raidet →
              </Link>
            </div>
          </>
        ) : (
          <p className="text-ink-muted">Ingen raids sat op. En sjælden fri aften — brug den på noget andet.</p>
        )}
      </Surface>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Your week */}
        <section>
          <SectionHeading kicker="Dig" title="Din uge" />
          {character ? (
            <div className="grid gap-6">
              <StatBlock
                label="Fremmøde"
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
                label="Seneste raid"
                value={character.avgPerformance != null ? Math.round(character.avgPerformance) : "—"}
              />
              <Link
                href={`/roster/${character.realmSlug}/${encodeURIComponent(character.name)}`}
                className="font-display text-xs font-bold tracking-[0.14em] text-papi-purple uppercase hover:underline"
              >
                {character.name} — hele profilen →
              </Link>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">
              Der er ingen karakter koblet til din konto endnu. En officer kan sætte din
              main på i rosteret.
            </p>
          )}
        </section>

        {/* Raid readiness */}
        <section>
          <SectionHeading kicker="Tjek" title="Er du klar?" />
          {readiness.length === 0 ? (
            <p className="text-sm text-ink-muted">Kobl en karakter på for at se tjeklisten.</p>
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
          <SectionHeading kicker="Guilden" title="Hvad der sker" />
          <ol className="divide-y divide-edge border-y border-edge">
            {activity.map((a) => (
              <li key={a.id} className="py-2.5">
                <p className="text-sm">{a.title}</p>
                <p className="text-xs text-ink-faint">{formatRelative(a.occurredAt)}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-ink-muted">
            Fremgang:{" "}
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
