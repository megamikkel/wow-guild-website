import type { Metadata } from "next";
import Link from "next/link";

import { Countdown } from "@/components/Countdown";
import { RoleGlyph, SectionHeading, Surface } from "@/components/ui";
import { getRaids } from "@/domain/queries";
import { formatDate, formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Raids",
  description: "Upcoming and recent PAPI raid nights, signups and role coverage.",
};

export default async function RaidsPage() {
  const { upcoming, past } = await getRaids();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <SectionHeading kicker="Raid-Helper" title="Upcoming raids" />
      {upcoming.length === 0 ? (
        <p className="mb-12 text-ink-muted">Nothing scheduled right now. Enjoy the reset.</p>
      ) : (
        <div className="mb-14 grid gap-4 lg:grid-cols-2">
          {upcoming.map(({ event, breakdown }, i) => (
            <Surface key={event.id} className={`p-6 ${i === 0 ? "border-papi-blue/40" : ""}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="stat-label">{event.difficulty}</p>
                  <h2 className="display-heading mt-1 text-2xl">
                    {event.targetBoss ?? event.title}
                  </h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    {formatDate(event.startTime)} · {formatTime(event.startTime)}
                    {event.endTime ? `–${formatTime(event.endTime)}` : ""}
                  </p>
                </div>
                {i === 0 ? (
                  <Countdown target={event.startTime.toISOString()} className="text-xl" />
                ) : null}
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                {(["TANK", "HEALER", "DPS"] as const).map((role) => (
                  <span key={role} className="inline-flex items-center gap-1.5 text-ink-muted">
                    <RoleGlyph role={role} />
                    <span className="font-mono tabular-nums">
                      {breakdown.byRole[role].confirmed}/{breakdown.byRole[role].target}
                    </span>
                  </span>
                ))}
                <span className="font-mono text-papi-blue tabular-nums">
                  {breakdown.totalConfirmed}/{breakdown.totalTarget} confirmed
                </span>
              </div>
              <Link
                href={`/raids/${event.id}`}
                className="mt-4 inline-block font-display text-xs font-bold tracking-[0.14em] text-papi-blue uppercase hover:underline"
              >
                View raid →
              </Link>
            </Surface>
          ))}
        </div>
      )}

      <SectionHeading kicker="History" title="Previous raids" />
      {past.length === 0 ? (
        <p className="text-ink-muted">No raid history yet.</p>
      ) : (
        <ul className="divide-y divide-edge/60 border-y border-edge/60">
          {past.map(({ event, breakdown }) => (
            <li key={event.id}>
              <Link
                href={`/raids/${event.id}`}
                className="flex flex-wrap items-baseline justify-between gap-3 py-3 transition-colors hover:bg-surface"
              >
                <div>
                  <p className="text-sm">
                    {event.targetBoss ?? event.title}
                    <span className="ml-2 text-xs text-ink-faint">{event.difficulty}</span>
                  </p>
                  <p className="text-xs text-ink-faint">{formatDate(event.startTime)}</p>
                </div>
                <span className="font-mono text-xs text-ink-muted tabular-nums">
                  {breakdown.totalConfirmed} attended
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
