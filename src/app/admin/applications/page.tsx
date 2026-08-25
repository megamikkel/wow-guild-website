import Link from "next/link";

import { RoleGlyph, SectionHeading, Surface } from "@/components/ui";
import { getApplications } from "@/domain/queries";
import { APPLICATION_STATUSES } from "@/domain/recruitment";
import { classColorStyle } from "@/lib/wow";
import { formatRelative } from "@/lib/format";

export const dynamic = "force-dynamic";

const COLUMN_LABEL: Record<string, string> = {
  NEW: "Nye",
  REVIEW: "Kigges igennem",
  INTERVIEW: "Til samtale",
  TRIAL: "På prøve",
  ACCEPTED: "Optaget",
  DECLINED: "Afvist",
};

export default async function ApplicationsBoardPage() {
  const applications = await getApplications();
  const pipeline = APPLICATION_STATUSES.filter((s) => s !== "ACCEPTED" && s !== "DECLINED");
  const done = applications.filter((a) => a.status === "ACCEPTED" || a.status === "DECLINED");

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <SectionHeading
        kicker={`${applications.length} i alt`}
        title="Ansøgninger"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {pipeline.map((status) => {
          const column = applications.filter((a) => a.status === status);
          return (
            <section key={status} aria-label={`${COLUMN_LABEL[status]} column`}>
              <p className="stat-label mb-3 flex items-center justify-between">
                <span>{COLUMN_LABEL[status]}</span>
                <span className="font-mono">{column.length}</span>
              </p>
              <div className="grid gap-2">
                {column.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-edge p-4 text-center text-xs text-ink-faint">
                    {status === "NEW" ? "Stille dag. Intet nyt kød endnu." : "Tom"}
                  </p>
                ) : (
                  column.map((a) => (
                    <Link key={a.id} href={`/admin/applications/${a.id}`}>
                      <Surface className="p-4 transition-colors hover:border-papi-purple/50">
                        <p className="font-display font-bold" style={classColorStyle(a.className)}>
                          {a.characterName}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
                          <RoleGlyph role={a.role} />
                          {a.specName} {a.className} · {a.realm}
                        </p>
                        <p className="mt-2 text-xs text-ink-faint">
                          {formatRelative(a.createdAt)} · @{a.discordName}
                        </p>
                      </Surface>
                    </Link>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      {done.length > 0 ? (
        <section className="mt-12">
          <SectionHeading kicker="Afsluttet" title="Besluttet" />
          <ul className="divide-y divide-edge border-y border-edge">
            {done.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/admin/applications/${a.id}`}
                  className="flex items-center justify-between py-2.5 text-sm hover:bg-surface"
                >
                  <span>
                    <span style={classColorStyle(a.className)}>{a.characterName}</span>{" "}
                    <span className="text-ink-faint">
                      · {a.specName} {a.className}
                    </span>
                  </span>
                  <span
                    className={`font-display text-xs font-bold tracking-widest ${a.status === "ACCEPTED" ? "text-ok" : "text-ink-faint"}`}
                  >
                    {a.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
