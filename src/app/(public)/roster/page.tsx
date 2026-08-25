import type { Metadata } from "next";
import Link from "next/link";

import { RoleBadge } from "@/components/RoleBadge";
import { SectionHeading, StatusPill } from "@/components/ui";
import { guildConfig } from "@/config/guild";
import { getRoster } from "@/domain/queries";
import { SpecBadge } from "@/components/wow";
import { classColorStyle } from "@/lib/wow";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Roster",
  description: `The ${guildConfig.name} raid roster — classes, specs, item level, Mythic+ scores and progression.`,
};

const ROLE_FILTERS = ["ALL", "TANK", "HEALER", "DPS"] as const;
const STATUS_FILTERS = ["ALL", "RAIDER", "TRIAL", "MEMBER", "ALT"] as const;

/** Filter labels in Danish; the values stay the database's own. */
const FILTER_DA: Record<string, string> = {
  ALL: "Alle",
  TANK: "Tanks",
  HEALER: "Healere",
  DPS: "DPS",
  RAIDER: "Raidere",
  TRIAL: "På prøve",
  MEMBER: "Medlemmer",
  ALT: "Alts",
};

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
              {FILTER_DA[r]}
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
              {FILTER_DA[s]}
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
                    <span className="flex items-center gap-2.5">
                      <SpecBadge
                        className={c.className}
                        specName={c.specName}
                        iconUrl={c.specIconUrl}
                        size={30}
                      />
                      <span>
                        <Link
                          href={`/roster/${c.realmSlug}/${encodeURIComponent(c.name)}`}
                          className="font-display font-bold hover:underline"
                          style={classColorStyle(c.className)}
                        >
                          {c.name}
                        </Link>
                        {/* One realm, every row — on a phone it is pure width,
                            and it costs the role chip its place on screen. */}
                        <span className="hidden text-xs text-ink-faint sm:ml-2 sm:inline">
                          {c.realmName}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {c.specName} {c.className}
                  </td>
                  <td className="px-4 py-3">
                    {/* On a phone the word costs the chip its place on
                        screen; the icon and the label both stay available. */}
                    <RoleBadge role={c.role} labelClassName="hidden sm:inline" />
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
