import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Countdown } from "@/components/Countdown";
import { ProgressBar, RoleGlyph, SectionHeading, StatusPill, Surface } from "@/components/ui";
import { getRaidDetail, getRaids } from "@/domain/queries";
import { IS_STATIC_EXPORT } from "@/lib/render-mode";
import { classColorStyle } from "@/lib/wow";
import { formatDate, formatTime } from "@/lib/format";

export const dynamic = "force-static";

export const metadata: Metadata = { title: "Raid" };

/**
 * Enumerates scheduled raids so the static preview build can pre-render each
 * detail page. The normal build renders these on demand, and must not reach
 * for the database here — production has no connection at build time.
 */
export async function generateStaticParams() {
  if (!IS_STATIC_EXPORT) return [];
  const { upcoming, past } = await getRaids();
  return [...upcoming, ...past].map(({ event }) => ({ id: String(event.id) }));
}

const STATUS_ORDER = ["CONFIRMED", "TENTATIVE", "BENCH", "ABSENT", "NO_RESPONSE"] as const;
const STATUS_LABEL: Record<string, { label: string; tone: "ok" | "warn" | "muted" | "danger" | "blue" }> = {
  CONFIRMED: { label: "Confirmed", tone: "ok" },
  TENTATIVE: { label: "Tentative", tone: "warn" },
  BENCH: { label: "Bench", tone: "blue" },
  ABSENT: { label: "Absent", tone: "danger" },
  NO_RESPONSE: { label: "No response", tone: "muted" },
};

export default async function RaidDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const raidId = Number(id);
  if (!Number.isInteger(raidId)) notFound();
  const data = await getRaidDetail(raidId);
  if (!data) notFound();
  const { event, signups, breakdown } = data;
  const isUpcoming = event.startTime.getTime() > Date.now();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <header className="mb-10">
        <p className="stat-label">{event.difficulty}</p>
        <h1 className="display-heading mt-1 text-4xl sm:text-5xl">
          {event.targetBoss ?? event.title}
        </h1>
        <p className="mt-2 text-ink-muted">
          {formatDate(event.startTime)} · {formatTime(event.startTime)}
          {event.endTime ? `–${formatTime(event.endTime)}` : ""}
        </p>
        {isUpcoming ? (
          <div className="mt-4">
            <Countdown target={event.startTime.toISOString()} className="text-3xl" />
          </div>
        ) : null}
      </header>

      <div className="mb-12 grid gap-4 sm:grid-cols-3">
        {(["TANK", "HEALER", "DPS"] as const).map((role) => {
          const r = breakdown.byRole[role];
          return (
            <Surface key={role} className="p-5">
              <p className="stat-label flex items-center gap-2">
                <RoleGlyph role={role} /> {role}S
              </p>
              <p className="stat-oversized mt-2 text-4xl">
                {r.confirmed}
                <span className="text-ink-faint"> / {r.target}</span>
              </p>
              <div className="mt-3">
                <ProgressBar
                  pct={(r.confirmed / r.target) * 100}
                  accent={r.confirmed >= r.target ? "ok" : "purple"}
                  label={`${role} confirmed`}
                />
              </div>
            </Surface>
          );
        })}
      </div>

      <SectionHeading
        kicker={`${breakdown.totalConfirmed} / ${breakdown.totalTarget} confirmed`}
        title="Signups"
      />
      <div className="grid gap-8 md:grid-cols-2">
        {STATUS_ORDER.map((status) => {
          const group = signups.filter((s) => s.status === status);
          if (group.length === 0) return null;
          const meta = STATUS_LABEL[status];
          return (
            <section key={status}>
              <p className="mb-3">
                <StatusPill tone={meta.tone}>
                  {meta.label} · {group.length}
                </StatusPill>
              </p>
              <ul className="divide-y divide-edge border-y border-edge">
                {group.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="font-display font-bold" style={classColorStyle(s.className ?? "")}>
                      {s.name}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-ink-muted">
                      {s.role ? <RoleGlyph role={s.role} /> : null}
                      {s.specName} {s.className}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="mt-10 text-xs text-ink-faint">
        Signups are managed in Discord via Raid-Helper — this page mirrors them read-only.
      </p>
    </div>
  );
}
