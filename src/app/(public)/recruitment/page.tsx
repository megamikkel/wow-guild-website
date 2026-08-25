import type { Metadata } from "next";

import { CtaLink, PriorityBadge, RoleGlyph, SectionHeading, Surface } from "@/components/ui";
import { guildConfig } from "@/config/guild";
import { getProgression, getRecruitmentNeeds } from "@/domain/queries";
import { classColorStyle } from "@/lib/wow";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bliv medlem",
  description: `${guildConfig.name} is recruiting for ${guildConfig.currentTier.difficulty} progression. See open spots and apply.`,
};

export default async function RecruitmentPage() {
  const [needs, progression] = await Promise.all([getRecruitmentNeeds(), getProgression()]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <header className="mb-12 max-w-3xl">
        <p className="banner mb-3">Rekruttering</p>
        <h1 className="display-heading text-5xl text-papi-indigo sm:text-6xl">
          Vi mangler et par stykker
        </h1>
        <p className="mt-4 text-lg text-ink-muted">
          {guildConfig.name} raider {guildConfig.raidSchedule.map((s) => s.day.toLowerCase()).join(" og ")}{" "}
          fra {guildConfig.raidSchedule[0].start} til {guildConfig.raidSchedule[0].end}. To aftener
          om ugen, {progression.killed}/{progression.total} {guildConfig.currentTier.difficulty} — og
          så er der fri resten af tiden. Vi spiller for at hygge os, ikke for at nå toplisten.
        </p>
      </header>

      <SectionHeading kicker="Ledige pladser" title="Det vi mangler" />
      <div className="mb-12 grid gap-3 sm:grid-cols-2">
        {needs.map((n) => (
          <Surface
            key={n.id}
            className={`flex items-center justify-between gap-4 p-5 ${n.priority === "CLOSED" ? "opacity-60" : ""} ${n.priority === "HIGH" ? "border-stripe-red/40" : ""}`}
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
          <p className="stat-label mb-2">Hvad vi forventer</p>
          <ul className="space-y-1.5 text-sm text-ink-muted">
            <li>At du dukker op, når du har skrevet dig på</li>
            <li>At du har styr på din egen klasse</li>
            <li>At du siger til, hvis du ikke kan</li>
            <li>God tone. Vi gider ikke drama</li>
          </ul>
        </div>
        <div>
          <p className="stat-label mb-2">Hvad du får</p>
          <ul className="space-y-1.5 text-sm text-ink-muted">
            <li>Faste raids to aftener om ugen</li>
            <li>Officerer der har set videoen inden</li>
            <li>Plads til alle, også når det går skidt</li>
            <li>En guild der stadig er her næste tier</li>
          </ul>
        </div>
        <div className="flex flex-col items-start justify-center gap-3">
          <CtaLink href="/apply">Søg om plads</CtaLink>
          <p className="text-xs text-ink-faint">Tager cirka fem minutter. Vi svarer på alle ansøgninger.</p>
        </div>
      </Surface>
    </div>
  );
}
