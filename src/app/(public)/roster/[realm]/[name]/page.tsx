import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RoleGlyph, SectionHeading, StatBlock, StatusPill } from "@/components/ui";
import { guildConfig } from "@/config/guild";
import { getCharacter } from "@/domain/queries";
import { classColorStyle } from "@/lib/wow";
import { formatDate, formatRelative } from "@/lib/format";

export const dynamic = "force-dynamic";

type Params = Promise<{ realm: string; name: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { name } = await params;
  return { title: `${decodeURIComponent(name)} — Character` };
}

export default async function CharacterPage({ params }: { params: Params }) {
  const { realm, name } = await params;
  const data = await getCharacter(realm, decodeURIComponent(name));
  if (!data) notFound();
  const { character: c, runs, performance } = data;

  const links = [
    { label: "Raider.IO", href: guildConfig.external.raiderIoCharacterUrl(c.realmSlug, c.name) },
    {
      label: "Warcraft Logs",
      href: guildConfig.external.warcraftLogsCharacterUrl(c.realmSlug, c.name),
    },
    { label: "Armory", href: guildConfig.external.armoryCharacterUrl(c.realmSlug, c.name) },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <header className="mb-10">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="display-heading text-5xl sm:text-6xl" style={classColorStyle(c.className)}>
            {c.name}
          </h1>
          {c.rosterStatus === "TRIAL" ? <StatusPill tone="blue">Trial</StatusPill> : null}
        </div>
        <p className="mt-2 flex items-center gap-2 text-ink-muted">
          <RoleGlyph role={c.role} />
          {c.specName} {c.className} · {c.realmName} · {c.guildRank}
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              rel="noopener noreferrer"
              className="font-display text-xs font-bold tracking-[0.14em] text-papi-purple uppercase hover:underline"
            >
              {l.label} ↗
            </a>
          ))}
        </div>
      </header>

      <div className="mb-12 grid grid-cols-2 gap-8 sm:grid-cols-4">
        <StatBlock label="Item level" value={c.itemLevel ?? "—"} size="lg" />
        <StatBlock
          label="Mythic+"
          value={c.mythicPlusScore ? Math.round(c.mythicPlusScore).toLocaleString("en-GB") : "—"}
          size="lg"
          accent="purple"
        />
        <StatBlock label="Raid" value={c.raidProgressSummary ?? "—"} size="lg" />
        <StatBlock
          label="Attendance"
          value={c.attendancePct != null ? `${Math.round(c.attendancePct)}%` : "—"}
          size="lg"
          sub={c.avgPerformance != null ? `${Math.round(c.avgPerformance)} avg performance` : undefined}
        />
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <SectionHeading kicker="Raider.IO" title="Recent Mythic+" />
          {runs.length === 0 ? (
            <p className="text-ink-muted">No recent keys on record.</p>
          ) : (
            <ul className="divide-y divide-edge border-y border-edge">
              {runs.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <div>
                    <p>{r.dungeon}</p>
                    <p className="text-xs text-ink-faint">{formatRelative(r.completedAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`stat-oversized text-2xl ${r.timed ? "text-papi-purple" : "text-ink-faint"}`}>
                      +{r.level}
                    </span>
                    {r.timed ? (
                      <StatusPill tone="ok">Timed</StatusPill>
                    ) : (
                      <StatusPill tone="muted">Over</StatusPill>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionHeading kicker="Warcraft Logs" title="Recent performance" />
          {performance.length === 0 ? (
            <p className="text-ink-muted">No parses recorded yet.</p>
          ) : (
            <ul className="divide-y divide-edge border-y border-edge">
              {performance.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <div>
                    <p>{p.bossName}</p>
                    <p className="text-xs text-ink-faint">
                      {p.metric.toUpperCase()} · {formatDate(p.recordedAt)}
                    </p>
                  </div>
                  <span className="stat-oversized text-2xl">
                    {p.percentile != null ? Math.round(p.percentile) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
