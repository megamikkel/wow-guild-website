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
      label: `${newApps.length} nye ansøgninger at kigge på`,
      href: "/admin/applications",
      tone: "danger",
    });
  if (trialsDue.length > 0)
    actions.push({
      label: `${trialsDue.length} prøvetider skal vurderes`,
      href: "/admin/trials",
      tone: "warn",
    });
  if (missingSignups > 0 && nextRaid)
    actions.push({
      label: `Der mangler ${missingSignups} til næste raid`,
      href: `/raids/${nextRaid.event.id}`,
      tone: "blue",
    });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="banner mb-3">Officer</p>
          <h1 className="display-heading text-4xl text-papi-indigo sm:text-5xl">Oversigt</h1>
        </div>
        {actions.length > 0 ? (
          <StatusPill tone="danger">
            {actions.length} ting kræver din opmærksomhed
          </StatusPill>
        ) : (
          <StatusPill tone="ok">Alt er fint</StatusPill>
        )}
      </header>

      {actions.length > 0 ? (
        <div className="mb-10 grid gap-3">
          {actions.map((a) => (
            <Link key={a.label} href={a.href}>
              <Surface
                className={`flex items-center justify-between p-4 transition-colors hover:bg-surface-2 ${
                  a.tone === "danger" ? "border-stripe-red/40" : a.tone === "warn" ? "border-warn/40" : "border-papi-purple/40"
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
          <SectionHeading kicker="Raid" title="Næste raid" />
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
                  ? ` · mangler ${missingSignups} (${nextRaid.breakdown.noResponse} uden svar, ${nextRaid.breakdown.absent} kan ikke)`
                  : " · fuldt hus"}
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
            <p className="text-ink-muted">Der er ikke sat noget op.</p>
          )}
        </section>

        <section>
          <SectionHeading kicker="Roster" title="Hvordan ser rosteret ud" />
          <Surface className="grid gap-4 p-6">
            {health.map((h) => (
              <div key={h.role} className="flex items-center gap-3 text-sm">
                <span className="stat-label w-16">{h.role}</span>
                <div className="flex-1">
                  <ProgressBar
                    pct={Math.min(h.pct, 100)}
                    accent={h.pct >= 100 ? "ok" : h.pct >= 85 ? "purple" : "red"}
                    label={`${h.role} roster strength`}
                  />
                </div>
                <span
                  className={`w-16 text-right font-mono tabular-nums ${h.pct < 85 ? "text-stripe-red" : ""}`}
                >
                  {h.pct}%{h.pct < 85 ? " ⚠" : ""}
                </span>
              </div>
            ))}
            <p className="text-xs text-ink-faint">
              Aktive raidere og folk på prøve, målt mod den ønskede sammensætning.
            </p>
          </Surface>
        </section>

        <section>
          <SectionHeading kicker="Rekruttering" title="Ansøgninger" />
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
                ? `${inReview.length} venter på at blive kigget på.`
                : newApps.length === 0
                  ? "Stille dag. Intet nyt kød endnu."
                  : "Der ligger nye ansøgninger."}
            </p>
            <Link
              href="/admin/applications"
              className="mt-3 inline-block font-display text-xs font-bold tracking-[0.14em] text-papi-purple uppercase hover:underline"
            >
              Åbn oversigten →
            </Link>
          </Surface>
        </section>

        <section>
          <SectionHeading kicker="Fremgang" title="Hvor er vi"/>
          <Surface className="p-6">
            {progression.progressBoss ? (
              <>
                <p className="display-heading text-2xl">{progression.progressBoss.bossName}</p>
                <div className="mt-2 flex items-baseline gap-4">
                  <span className="stat-oversized text-5xl text-stripe-red">
                    {progression.progressBoss.bestPct?.toFixed(1)}%
                  </span>
                  <span className="text-sm text-ink-muted">
                    {progression.progressBoss.pulls} forsøg
                  </span>
                </div>
              </>
            ) : (
              <p className="text-ink-muted">
                {progression.killed}/{progression.total} — mellem to bosser.
              </p>
            )}
            <p className="mt-3 text-sm text-ink-muted">
              På prøve: {activeTrials.length}
              {trialsDue.length > 0 ? ` · ${trialsDue.length} skal vurderes` : ""}
            </p>
          </Surface>
        </section>
      </div>
    </div>
  );
}
