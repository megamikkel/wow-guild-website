import type { Metadata } from "next";
import Link from "next/link";

import { RoleGlyph, SectionHeading, StatusPill } from "@/components/ui";
import { guildConfig } from "@/config/guild";
import { getRoster } from "@/domain/queries";
import { classColorStyle } from "@/lib/wow";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Roster",
  description: `The ${guildConfig.name} raid roster — classes, specs, item level, Mythic+ scores and progression.`,
};

const ROLE_FILTERS = ["ALL", "TANK", "HEALER", "DPS"] as const;
const STATUS_FILTERS = ["ALL", "RAIDER", "TRIAL", "MEMBER", "ALT"] as const;

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; status?: string; class?: string }>;
}) {
  const roster = await getRoster();
  const params = await searchParams;
  const roleFilter = (params.role ?? "ALL").toUpperCase();
  const statusFilter = (params.status ?? "ALL").toUpperCase();
  const classFilter = params.class ?? "ALL";

  const classes = [...new Set(roster.map((c) => c.className))].sort();
  const filtered = roster.filter(
    (c) =>
      (roleFilter === "ALL" || c.role === roleFilter) &&
      (statusFilter === "ALL" || c.rosterStatus === statusFilter) &&
      (classFilter === "ALL" || c.className === classFilter),
  );

  const filterHref = (patch: Record<string, string>) => {
    const merged = {
      role: roleFilter,
      status: statusFilter,
      class: classFilter,
      ...patch,
    };
    const qs = Object.entries(merged)
      .filter(([, v]) => v !== "ALL")
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    return qs ? `/roster?${qs}` : "/roster";
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <SectionHeading
        kicker={`${roster.length} karakterer`}
        title="Vores roster"
        right={
          <p className="text-xs text-ink-faint">
            Hentet fra Blizzard og Raider.IO
          </p>
        }
      />

      {/* Filters — plain links so they work without JS and stay indexable-safe */}
      <div className="mb-6 flex flex-wrap gap-x-6 gap-y-3">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by role">
          {ROLE_FILTERS.map((r) => (
            <Link
              key={r}
              href={filterHref({ role: r })}
              className={`rounded px-3 py-1.5 font-display text-xs font-bold tracking-[0.12em] uppercase transition-colors ${
                roleFilter === r ? "bg-papi-purple-wash text-papi-purple" : "text-ink-muted hover:text-ink"
              }`}
              aria-current={roleFilter === r ? "true" : undefined}
            >
              {r}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map((s) => (
            <Link
              key={s}
              href={filterHref({ status: s })}
              className={`rounded px-3 py-1.5 font-display text-xs font-bold tracking-[0.12em] uppercase transition-colors ${
                statusFilter === s ? "bg-papi-purple-wash text-papi-purple" : "text-ink-muted hover:text-ink"
              }`}
              aria-current={statusFilter === s ? "true" : undefined}
            >
              {s}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by class">
          <Link
            href={filterHref({ class: "ALL" })}
            className={`rounded px-3 py-1.5 font-display text-xs font-bold tracking-[0.12em] uppercase ${
              classFilter === "ALL" ? "bg-papi-purple-wash text-papi-purple" : "text-ink-muted hover:text-ink"
            }`}
          >
            Alle klasser
          </Link>
          {classes.map((cls) => (
            <Link
              key={cls}
              href={filterHref({ class: cls })}
              className={`rounded px-3 py-1.5 font-display text-xs font-bold tracking-[0.12em] uppercase ${
                classFilter === cls ? "bg-surface-3" : "hover:bg-surface-2"
              }`}
              style={classColorStyle(cls)}
              aria-current={classFilter === cls ? "true" : undefined}
            >
              {cls}
            </Link>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-ink-muted">
          Ingen matcher det filter. Så dyb er vores bænk heller ikke.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-edge">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-edge bg-surface text-left">
                <th className="stat-label px-4 py-3 font-bold">Karakter</th>
                <th className="stat-label px-4 py-3 font-bold">Spec</th>
                <th className="stat-label px-4 py-3 font-bold">Rolle</th>
                <th className="stat-label px-4 py-3 text-right font-bold">ilvl</th>
                <th className="stat-label px-4 py-3 text-right font-bold">M+</th>
                <th className="stat-label px-4 py-3 font-bold">Raid</th>
                <th className="stat-label px-4 py-3 font-bold">Rang</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-edge transition-colors last:border-0 hover:bg-surface">
                  <td className="px-4 py-3">
                    <Link
                      href={`/roster/${c.realmSlug}/${encodeURIComponent(c.name)}`}
                      className="font-display font-bold hover:underline"
                      style={classColorStyle(c.className)}
                    >
                      {c.name}
                    </Link>
                    <span className="ml-2 text-xs text-ink-faint">{c.realmName}</span>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {c.specName} {c.className}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-ink-muted">
                      <RoleGlyph role={c.role} /> {c.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {c.itemLevel ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-papi-purple tabular-nums">
                    {c.mythicPlusScore ? Math.round(c.mythicPlusScore).toLocaleString("en-GB") : "—"}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{c.raidProgressSummary ?? "—"}</td>
                  <td className="px-4 py-3">
                    {c.rosterStatus === "TRIAL" ? (
                      <StatusPill tone="blue">På prøve</StatusPill>
                    ) : (
                      <span className="text-ink-muted">{c.guildRank}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
