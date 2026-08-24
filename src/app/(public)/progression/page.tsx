import type { Metadata } from "next";

import { ProgressBar, SectionHeading, StatusPill, Surface } from "@/components/ui";
import { guildConfig } from "@/config/guild";
import { getProgression, getRecentReports } from "@/domain/queries";
import { formatDate, formatRelative } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Progression",
  description: `${guildConfig.name} raid progression in ${guildConfig.currentTier.name} (${guildConfig.currentTier.difficulty}).`,
};

export default async function ProgressionPage() {
  const [progression, reports] = await Promise.all([getProgression(), getRecentReports()]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <SectionHeading
        kicker={guildConfig.currentTier.name}
        title="Current progression"
        right={
          progression.lastSyncedAt ? (
            <p className="text-xs text-ink-faint">
              Last updated {formatRelative(progression.lastSyncedAt)}
            </p>
          ) : null
        }
      />

      <p className="mb-10">
        <span className="stat-oversized text-8xl">{progression.killed}</span>
        <span className="stat-oversized text-8xl text-ink-faint"> / {progression.total}</span>
        <span className="stat-label ml-4">{guildConfig.currentTier.difficulty}</span>
      </p>

      <ol className="grid gap-3">
        {progression.bosses.map((boss) => (
          <li key={boss.id}>
            <Surface
              className={`grid gap-4 p-5 sm:grid-cols-[3rem_1fr_auto] sm:items-center ${
                boss.status === "LOCKED" ? "opacity-55" : ""
              } ${boss.status === "PROGRESS" ? "border-stripe-red/50" : ""}`}
            >
              <span className="stat-oversized hidden text-3xl text-ink-faint sm:block">
                {String(boss.bossSlot).padStart(2, "0")}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="display-heading text-xl">{boss.bossName}</h2>
                  {boss.status === "KILLED" ? (
                    <StatusPill tone="ok">✓ Killed</StatusPill>
                  ) : boss.status === "PROGRESS" ? (
                    <StatusPill tone="danger">
                      <span className="live-dot" aria-hidden /> Progress
                    </StatusPill>
                  ) : (
                    <StatusPill tone="muted">Locked</StatusPill>
                  )}
                </div>
                {boss.status === "KILLED" && boss.killedAt ? (
                  <p className="mt-1 text-sm text-ink-muted">
                    First kill {formatDate(boss.killedAt)} · {boss.pulls} pulls
                  </p>
                ) : null}
                {boss.status === "PROGRESS" ? (
                  <div className="mt-3 max-w-xl">
                    <div className="flex items-baseline gap-4">
                      <span className="stat-oversized text-5xl text-stripe-red">
                        {boss.bestPct?.toFixed(1)}%
                      </span>
                      <span className="text-sm text-ink-muted">
                        best · {boss.pulls} pulls
                        {boss.lastRaidStartPct != null && boss.lastRaidEndPct != null
                          ? ` · last raid ${boss.lastRaidStartPct}% → ${boss.lastRaidEndPct}%`
                          : ""}
                      </span>
                    </div>
                    <div className="mt-3">
                      <ProgressBar
                        pct={100 - (boss.bestPct ?? 100)}
                        accent="red"
                        label={`${boss.bossName} progress`}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
              {boss.status !== "LOCKED" ? (
                <p className="font-mono text-sm text-ink-faint tabular-nums sm:text-right">
                  {boss.pulls} pulls
                </p>
              ) : (
                <span />
              )}
            </Surface>
          </li>
        ))}
      </ol>

      <section className="mt-14">
        <SectionHeading kicker="Warcraft Logs" title="Recent reports" />
        {reports.length === 0 ? (
          <p className="text-ink-muted">No reports yet — the first one lands here after raid night.</p>
        ) : (
          <ul className="divide-y divide-edge border-y border-edge">
            {reports.map((r) => (
              <li key={r.id} className="flex items-baseline justify-between gap-4 py-3">
                <div>
                  <a
                    href={r.url}
                    rel="noopener noreferrer"
                    className="text-sm text-papi-purple hover:underline"
                  >
                    {r.title}
                  </a>
                  <p className="text-xs text-ink-faint">{formatDate(r.startTime)}</p>
                </div>
                <span className="font-mono text-xs text-ink-faint">{r.wclCode}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
