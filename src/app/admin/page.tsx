import Link from "next/link";

import { ProgressBar, SectionHeading, StatusPill, Surface } from "@/components/ui";
import {
  getApplications,
  getNextRaid,
  getProgression,
  getRosterHealth,
  getTrials,
} from "@/domain/queries";
import { formatRelative } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminCommandPage() {
  const [applications, trials, nextRaid, health, progression] = await Promise.all([
    getApplications(),
    getTrials(),
    getNextRaid(),
    getRosterHealth(),
    getProgression(),
  ]);

  const newApps = applications.filter((a) => a.status === "NEW");
  const inReview = applications.filter((a) => a.status === "REVIEW");
  const activeTrials = trials.filter((t) => t.status === "ACTIVE");
  const trialsDue = activeTrials.filter(
    (t) => t.expectedEndDate.getTime() - Date.now() < 5 * 86_400_000,
  );
  const missingSignups = nextRaid
    ? nextRaid.breakdown.totalTarget - nextRaid.breakdown.totalConfirmed
    : 0;

  const actions: Array<{ label: string; href: string; tone: "danger" | "warn" | "blue" }> = [];
  if (newApps.length > 0)
    actions.push({
      label: `${newApps.length} new application${newApps.length > 1 ? "s" : ""} to triage`,
      href: "/admin/applications",
      tone: "danger",
    });
  if (trialsDue.length > 0)
    actions.push({
      label: `${trialsDue.length} trial review${trialsDue.length > 1 ? "s" : ""} due`,
      href: "/admin/trials",
      tone: "warn",
    });
  if (missingSignups > 0 && nextRaid)
    actions.push({
      label: `Next raid missing ${missingSignups} player${missingSignups > 1 ? "s" : ""}`,
      href: `/raids/${nextRaid.event.id}`,
      tone: "blue",
    });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="stat-label mb-1">Officer command center</p>
          <h1 className="display-heading text-4xl sm:text-5xl">PAPI Command</h1>
        </div>
        {actions.length > 0 ? (
          <StatusPill tone="danger">
            {actions.length} action{actions.length > 1 ? "s" : ""} required
          </StatusPill>
        ) : (
          <StatusPill tone="ok">All clear</StatusPill>
        )}
      </header>

      {actions.length > 0 ? (
        <div className="mb-10 grid gap-3">
          {actions.map((a) => (
            <Link key={a.label} href={a.href}>
              <Surface
                className={`flex items-center justify-between p-4 transition-colors hover:bg-surface-2 ${
                  a.tone === "danger" ? "border-papi-red/40" : a.tone === "warn" ? "border-warn/40" : "border-papi-blue/40"
                }`}
              >
                <span className="font-display text-sm font-bold tracking-wide uppercase">
                  {a.label}
                </span>
                <span aria-hidden className="text-ink-muted">→</span>
              </Surface>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <SectionHeading kicker="Raid" title="Next raid" />
          {nextRaid ? (
            <Surface className="p-6">
              <div className="flex items-baseline justify-between">
                <p className="display-heading text-2xl">
                  {nextRaid.event.targetBoss ?? nextRaid.event.title}
                </p>
                <span className="font-mono text-2xl tabular-nums">
                  {nextRaid.breakdown.totalConfirmed}/{nextRaid.breakdown.totalTarget}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink-muted">
                {formatRelative(nextRaid.event.startTime)}
                {missingSignups > 0
                  ? ` · missing ${missingSignups} (${nextRaid.breakdown.noResponse} no response, ${nextRaid.breakdown.absent} absent)`
                  : " · full house"}
              </p>
              <div className="mt-4 grid gap-2">
                {(["TANK", "HEALER", "DPS"] as const).map((role) => {
                  const r = nextRaid.breakdown.byRole[role];
                  return (
                    <div key={role} className="flex items-center gap-3 text-xs">
                      <span className="stat-label w-16">{role}</span>
                      <div className="flex-1">
                        <ProgressBar
                          pct={(r.confirmed / r.target) * 100}
                          accent={r.confirmed >= r.target ? "ok" : "red"}
                          label={`${role} coverage`}
                        />
                      </div>
                      <span className="w-10 text-right font-mono tabular-nums">
                        {r.confirmed}/{r.target}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Surface>
          ) : (
            <p className="text-ink-muted">Nothing scheduled.</p>
          )}
        </section>

        <section>
          <SectionHeading kicker="Roster" title="Roster health" />
          <Surface className="grid gap-4 p-6">
            {health.map((h) => (
              <div key={h.role} className="flex items-center gap-3 text-sm">
                <span className="stat-label w-16">{h.role}</span>
                <div className="flex-1">
                  <ProgressBar
                    pct={Math.min(h.pct, 100)}
                    accent={h.pct >= 100 ? "ok" : h.pct >= 85 ? "blue" : "red"}
                    label={`${h.role} roster strength`}
                  />
                </div>
                <span
                  className={`w-16 text-right font-mono tabular-nums ${h.pct < 85 ? "text-papi-red" : ""}`}
                >
                  {h.pct}%{h.pct < 85 ? " ⚠" : ""}
                </span>
              </div>
            ))}
            <p className="text-xs text-ink-faint">
              Active raiders + trials vs. target composition.
            </p>
          </Surface>
        </section>

        <section>
          <SectionHeading kicker="Recruitment" title="Pipeline" />
          <Surface className="p-6">
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              {(["NEW", "REVIEW", "INTERVIEW", "TRIAL"] as const).map((s) => (
                <div key={s}>
                  <p className="stat-label">{s}</p>
                  <p className="stat-oversized mt-1 text-4xl">
                    {applications.filter((a) => a.status === s).length}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-ink-muted">
              {inReview.length > 0
                ? `${inReview.length} waiting on a reviewer.`
                : newApps.length === 0
                  ? "Quiet day. No fresh meat yet."
                  : "Fresh applications await triage."}
            </p>
            <Link
              href="/admin/applications"
              className="mt-3 inline-block font-display text-xs font-bold tracking-[0.14em] text-papi-blue uppercase hover:underline"
            >
              Open board →
            </Link>
          </Surface>
        </section>

        <section>
          <SectionHeading kicker="Progression" title="Progress" />
          <Surface className="p-6">
            {progression.progressBoss ? (
              <>
                <p className="display-heading text-2xl">{progression.progressBoss.bossName}</p>
                <div className="mt-2 flex items-baseline gap-4">
                  <span className="stat-oversized text-5xl text-papi-red">
                    {progression.progressBoss.bestPct?.toFixed(1)}%
                  </span>
                  <span className="text-sm text-ink-muted">
                    {progression.progressBoss.pulls} pulls
                  </span>
                </div>
              </>
            ) : (
              <p className="text-ink-muted">
                {progression.killed}/{progression.total} — between bosses.
              </p>
            )}
            <p className="mt-3 text-sm text-ink-muted">
              Active trials: {activeTrials.length}
              {trialsDue.length > 0 ? ` · ${trialsDue.length} review due` : ""}
            </p>
          </Surface>
        </section>
      </div>
    </div>
  );
}
