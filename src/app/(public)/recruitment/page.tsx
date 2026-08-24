import type { Metadata } from "next";

import { CtaLink, PriorityBadge, RoleGlyph, SectionHeading, Surface } from "@/components/ui";
import { guildConfig } from "@/config/guild";
import { getProgression, getRecruitmentNeeds } from "@/domain/queries";
import { classColorStyle } from "@/lib/wow";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Recruitment",
  description: `${guildConfig.name} is recruiting for ${guildConfig.currentTier.difficulty} progression. See open spots and apply.`,
};

export default async function RecruitmentPage() {
  const [needs, progression] = await Promise.all([getRecruitmentNeeds(), getProgression()]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <header className="mb-12 max-w-3xl">
        <p className="stat-label mb-2">Recruitment</p>
        <h1 className="display-heading text-5xl sm:text-6xl">We want you.</h1>
        <p className="mt-4 text-lg text-ink-muted">
          {guildConfig.name} raids {guildConfig.raidSchedule.map((s) => s.day).join(" and ")},{" "}
          {guildConfig.raidSchedule[0].start}–{guildConfig.raidSchedule[0].end} server time. Two
          nights, {progression.killed}/{progression.total} {guildConfig.currentTier.difficulty} —
          we progress on focus, not on hours.
        </p>
      </header>

      <SectionHeading kicker="Open spots" title="Current needs" />
      <div className="mb-12 grid gap-3 sm:grid-cols-2">
        {needs.map((n) => (
          <Surface
            key={n.id}
            className={`flex items-center justify-between gap-4 p-5 ${n.priority === "CLOSED" ? "opacity-60" : ""} ${n.priority === "HIGH" ? "border-papi-red/40" : ""}`}
          >
            <div className="flex items-center gap-3">
              <span className="text-ink-muted">
                <RoleGlyph role={n.role} />
              </span>
              <div>
                <p className="font-display text-lg font-bold" style={classColorStyle(n.className)}>
                  {n.specName ? `${n.specName} ` : ""}
                  {n.className}
                </p>
                {n.note ? <p className="text-sm text-ink-muted">{n.note}</p> : null}
              </div>
            </div>
            <PriorityBadge priority={n.priority} />
          </Surface>
        ))}
      </div>

      <Surface className="grid gap-6 p-8 sm:grid-cols-3">
        <div>
          <p className="stat-label mb-2">What we expect</p>
          <ul className="space-y-1.5 text-sm text-ink-muted">
            <li>Prepared for every pull</li>
            <li>Stable attendance on both nights</li>
            <li>Logs you&apos;re not afraid to share</li>
            <li>Thick skin, no ego</li>
          </ul>
        </div>
        <div>
          <p className="stat-label mb-2">What you get</p>
          <ul className="space-y-1.5 text-sm text-ink-muted">
            <li>A roster that shows up</li>
            <li>Officers who prepare strategy</li>
            <li>Fair, transparent rotation</li>
            <li>A guild that plans to still exist next tier</li>
          </ul>
        </div>
        <div className="flex flex-col items-start justify-center gap-3">
          <CtaLink href="/apply">Apply to PAPI</CtaLink>
          <p className="text-xs text-ink-faint">Takes ~5 minutes. We reply to every application.</p>
        </div>
      </Surface>
    </div>
  );
}
