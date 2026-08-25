import Link from "next/link";

import { Countdown } from "@/components/Countdown";
import { PapiBadge } from "@/components/Logo";
import {
  CtaLink,
  PriorityBadge,
  ProgressBar,
  RoleGlyph,
  SectionHeading,
  StatBlock,
  Surface,
} from "@/components/ui";
import { guildConfig } from "@/config/guild";
import {
  getActivity,
  getNextRaid,
  getProgression,
  getRecruitmentNeeds,
} from "@/domain/queries";
import { classColorStyle } from "@/lib/wow";
import { formatDate, formatRelative, formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [nextRaid, progression, needs, activity] = await Promise.all([
    getNextRaid(),
    getProgression(),
    getRecruitmentNeeds(),
    getActivity(5),
  ]);

  const schedule = guildConfig.raidSchedule
    .map((s) => s.day.slice(0, 3).toUpperCase())
    .join(" + ");
  const openNeeds = needs.filter((n) => n.priority !== "CLOSED");

  return (
    <>
      {/* ————— HERO — built around the badge ————— */}
      <section className="paper relative overflow-hidden">
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pt-14 pb-16 sm:pt-16 lg:grid-cols-[1fr_auto] lg:gap-14 lg:pb-20">
          <div>
            <p className="banner mb-5">
              {guildConfig.region.toUpperCase()} · {guildConfig.realm.name} ·{" "}
              {guildConfig.focus}
            </p>
            <h1 className="display-heading text-4xl leading-[0.95] tracking-tighter text-papi-indigo sm:text-6xl lg:text-7xl">
              We don&apos;t raid
              <br />
              to participate.
              <br />
              <span className="text-papi-purple">We raid to progress.</span>
            </h1>

            <div className="mt-9 flex flex-wrap items-end gap-x-10 gap-y-6">
              <StatBlock
                label="Progression"
                value={
                  <>
                    {progression.killed}
                    <span className="text-ink-faint">/</span>
                    {progression.total}
                  </>
                }
                sub={`${guildConfig.currentTier.difficulty} · ${guildConfig.currentTier.name}`}
                size="lg"
              />
              <StatBlock
                label="Raid days"
                value={schedule}
                sub={`${guildConfig.raidSchedule[0].start} — ${guildConfig.raidSchedule[0].end} server time`}
                size="lg"
                accent="purple"
              />
            </div>

            <div className="mt-9 flex flex-wrap gap-3">
              <CtaLink href="/apply">Apply to PAPI</CtaLink>
              <CtaLink href="/progression" variant="secondary">
                View progression
              </CtaLink>
            </div>
          </div>

          <div className="order-first justify-self-center lg:order-none lg:justify-self-end">
            <PapiBadge size={420} priority className="h-52 w-auto sm:h-72 lg:h-[420px]" />
          </div>
        </div>
        <div className="stripe" aria-hidden />
      </section>

      {/* ————— NEXT RAID ————— */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <SectionHeading kicker="Live from Raid-Helper" title="Next raid" />
        {nextRaid ? (
          <Surface className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="stat-label">{nextRaid.event.difficulty}</p>
              <p className="display-heading mt-1 text-3xl sm:text-4xl">
                {nextRaid.event.targetBoss ?? nextRaid.event.title}
              </p>
              <p className="mt-2 text-ink-muted">
                {formatDate(nextRaid.event.startTime)} · {formatTime(nextRaid.event.startTime)}
              </p>
              <div className="mt-6">
                <Countdown target={nextRaid.event.startTime.toISOString()} className="text-4xl sm:text-5xl" />
              </div>
              <p className="mt-6">
                <span className="stat-oversized text-3xl text-papi-purple">
                  {nextRaid.breakdown.totalConfirmed}
                </span>
                <span className="stat-oversized text-3xl text-ink-faint">
                  {" "}/ {nextRaid.breakdown.totalTarget}
                </span>{" "}
                <span className="stat-label ml-2">confirmed</span>
              </p>
            </div>
            <div className="flex flex-col justify-center gap-4">
              {(["TANK", "HEALER", "DPS"] as const).map((role) => {
                const r = nextRaid.breakdown.byRole[role];
                return (
                  <div key={role}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="inline-flex items-center gap-2 font-display text-xs font-bold tracking-[0.14em] text-ink-muted uppercase">
                        <RoleGlyph role={role} /> {role}
                      </span>
                      <span className="font-mono tabular-nums">
                        {r.confirmed} / {r.target}
                      </span>
                    </div>
                    <ProgressBar
                      pct={(r.confirmed / r.target) * 100}
                      accent={r.confirmed >= r.target ? "ok" : "purple"}
                      label={`${role} signups`}
                    />
                  </div>
                );
              })}
              <Link
                href={`/raids/${nextRaid.event.id}`}
                className="mt-2 font-display text-xs font-bold tracking-[0.14em] text-papi-purple uppercase hover:underline"
              >
                View raid →
              </Link>
            </div>
          </Surface>
        ) : (
          <Surface className="p-8 text-ink-muted">
            No raid on the calendar right now. The next one lands here the moment it&apos;s
            scheduled.
          </Surface>
        )}
      </section>

      {/* ————— PROGRESSION ————— */}
      <section className="paper border-y border-edge">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <SectionHeading
            kicker="Warcraft Logs"
            title="Current progression"
            right={
              <Link
                href="/progression"
                className="font-display text-xs font-bold tracking-[0.14em] text-papi-purple uppercase hover:underline"
              >
                Full progression →
              </Link>
            }
          />
          <div className="flex flex-wrap items-end gap-10">
            <p>
              <span className="stat-oversized text-7xl text-ink sm:text-8xl">
                {progression.killed}
              </span>
              <span className="stat-oversized text-7xl text-ink-faint sm:text-8xl"> / {progression.total}</span>
              <span className="stat-label ml-4">{guildConfig.currentTier.difficulty}</span>
            </p>
            {progression.progressBoss ? (
              <div className="min-w-56 flex-1">
                <p className="stat-label">Now progressing</p>
                <p className="display-heading mt-1 text-2xl">{progression.progressBoss.bossName}</p>
                <div className="mt-3 flex items-baseline gap-3">
                  <span className="stat-oversized text-4xl text-stripe-red">
                    {progression.progressBoss.bestPct?.toFixed(1)}%
                  </span>
                  <span className="text-sm text-ink-muted">
                    best pull · {progression.progressBoss.pulls} pulls
                  </span>
                </div>
                <div className="mt-3">
                  <ProgressBar
                    pct={100 - (progression.progressBoss.bestPct ?? 100)}
                    accent="red"
                    label={`${progression.progressBoss.bossName} progress`}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* ————— RECRUITMENT ————— */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <SectionHeading kicker="Recruitment" title="We want you." />
        <div className="grid gap-3 sm:grid-cols-2">
          {needs.map((n) => (
            <Surface
              key={n.id}
              className={`flex items-center justify-between gap-4 p-4 ${n.priority === "CLOSED" ? "opacity-60" : ""}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-ink-muted">
                  <RoleGlyph role={n.role} className="opacity-80" />
                </span>
                <div>
                  <p className="font-display font-bold" style={classColorStyle(n.className)}>
                    {n.specName ? `${n.specName} ` : ""}
                    {n.className}
                  </p>
                  {n.note ? <p className="text-xs text-ink-muted">{n.note}</p> : null}
                </div>
              </div>
              <PriorityBadge priority={n.priority} />
            </Surface>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <CtaLink href="/apply">Apply to PAPI</CtaLink>
          <p className="text-sm text-ink-muted">
            {openNeeds.length > 0
              ? "Exceptional players outside these needs are always considered."
              : "Roster is full right now — exceptional applications still get read."}
          </p>
        </div>
      </section>

      {/* ————— ACTIVITY ————— */}
      <section className="mx-auto max-w-6xl px-4 pb-4">
        <SectionHeading kicker="Guild activity" title="Recent" />
        <ol className="divide-y divide-edge border-y border-edge">
          {activity.map((a) => (
            <li key={a.id} className="flex items-baseline gap-4 py-3">
              <span className="w-20 shrink-0 font-mono text-xs text-ink-faint tabular-nums">
                {formatRelative(a.occurredAt)}
              </span>
              <div>
                <p className="text-sm">{a.title}</p>
                {a.detail ? <p className="text-xs text-ink-muted">{a.detail}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
