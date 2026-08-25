import Link from "next/link";
import { notFound } from "next/navigation";

import { RoleGlyph, SectionHeading, StatusPill, Surface } from "@/components/ui";
import { getApplicationDetail } from "@/domain/queries";
import { TRANSITIONS, type ApplicationStatus } from "@/domain/recruitment";
import { classColorStyle } from "@/lib/wow";
import { formatDateTime, formatRelative } from "@/lib/format";
import { addApplicationNote, updateApplicationStatus } from "../actions";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "ok" | "warn" | "danger" | "blue" | "muted"> = {
  NEW: "danger",
  REVIEW: "warn",
  INTERVIEW: "blue",
  TRIAL: "blue",
  ACCEPTED: "ok",
  DECLINED: "muted",
};

const FIELDS: Array<[label: string, key: "previousGuild" | "raidExperience" | "availability" | "expectations" | "whyPapi" | "comment"]> = [
  ["Previous guild", "previousGuild"],
  ["Raid experience", "raidExperience"],
  ["Availability", "availability"],
  ["Expectations", "expectations"],
  ["Why PAPI", "whyPapi"],
  ["Comment", "comment"],
];

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const appId = Number(id);
  if (!Number.isInteger(appId)) notFound();
  const data = await getApplicationDetail(appId);
  if (!data) notFound();
  const { application: app, notes } = data;
  const nextStatuses = TRANSITIONS[app.status as ApplicationStatus] ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Link
        href="/admin/applications"
        className="font-display text-xs font-bold tracking-[0.14em] text-ink-muted uppercase hover:text-ink"
      >
        ← Board
      </Link>

      <header className="mt-4 mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="display-heading text-4xl" style={classColorStyle(app.className)}>
            {app.characterName}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-ink-muted">
            <RoleGlyph role={app.role} />
            {app.specName} {app.className} · {app.realm} · @{app.discordName}
          </p>
          <p className="mt-1 text-xs text-ink-faint">
            Applied {formatDateTime(app.createdAt)} ({formatRelative(app.createdAt)})
          </p>
        </div>
        <StatusPill tone={STATUS_TONE[app.status] ?? "muted"}>{app.status}</StatusPill>
      </header>

      {/* Pipeline actions */}
      {nextStatuses.length > 0 ? (
        <div className="mb-10 flex flex-wrap gap-2">
          {nextStatuses.map((status) => (
            <form key={status} action={updateApplicationStatus}>
              <input type="hidden" name="id" value={app.id} />
              <input type="hidden" name="status" value={status} />
              <button
                type="submit"
                className={`rounded-md px-4 py-2.5 font-display text-xs font-bold tracking-[0.12em] uppercase transition-colors ${
                  status === "DECLINED"
                    ? "border border-edge text-ink-muted hover:border-stripe-red/50 hover:text-stripe-red"
                    : status === "ACCEPTED"
                      ? "bg-ok text-white hover:bg-ok"
                      : "bg-papi-purple text-white hover:bg-papi-indigo"
                }`}
              >
                Move to {status}
              </button>
            </form>
          ))}
        </div>
      ) : null}

      <div className="grid gap-10 md:grid-cols-[1.4fr_1fr]">
        <section>
          <SectionHeading kicker="Application" title="Answers" />
          <dl className="grid gap-5">
            {FIELDS.map(([label, key]) => {
              const value = app[key];
              if (!value) return null;
              return (
                <div key={key}>
                  <dt className="stat-label mb-1">{label}</dt>
                  <dd className="text-sm whitespace-pre-wrap text-ink">{value}</dd>
                </div>
              );
            })}
            {app.altSpecs ? (
              <div>
                <dt className="stat-label mb-1">Alternative specs</dt>
                <dd className="text-sm">{app.altSpecs}</dd>
              </div>
            ) : null}
          </dl>
          <div className="mt-6 flex flex-wrap gap-4">
            {app.warcraftLogsUrl ? (
              <a
                href={app.warcraftLogsUrl}
                rel="noopener noreferrer"
                className="font-display text-xs font-bold tracking-[0.14em] text-papi-purple uppercase hover:underline"
              >
                Warcraft Logs ↗
              </a>
            ) : null}
            {app.raiderIoUrl ? (
              <a
                href={app.raiderIoUrl}
                rel="noopener noreferrer"
                className="font-display text-xs font-bold tracking-[0.14em] text-papi-purple uppercase hover:underline"
              >
                Raider.IO ↗
              </a>
            ) : null}
          </div>
        </section>

        <section>
          <SectionHeading kicker="Officers only" title="Notes" />
          <form action={addApplicationNote} className="mb-5">
            <input type="hidden" name="id" value={app.id} />
            <label htmlFor="note-body" className="sr-only">
              Add note
            </label>
            <textarea
              id="note-body"
              name="body"
              rows={3}
              required
              maxLength={2000}
              placeholder="Add an officer note… (never public)"
              className="w-full rounded-md border border-edge bg-surface-2 px-3 py-2.5 text-sm placeholder:text-ink-faint focus:border-papi-purple focus:outline-none"
            />
            <button
              type="submit"
              className="mt-2 rounded-md border border-papi-purple/50 px-4 py-2 font-display text-xs font-bold tracking-[0.12em] text-papi-purple uppercase hover:bg-papi-purple-wash"
            >
              Add note
            </button>
          </form>
          {notes.length === 0 ? (
            <p className="text-sm text-ink-faint">No notes yet.</p>
          ) : (
            <ul className="grid gap-3">
              {notes.map((n) => (
                <li key={n.id}>
                  <Surface className="p-4">
                    <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                    <p className="mt-2 text-xs text-ink-faint">
                      {n.authorName} · {formatRelative(n.createdAt)}
                    </p>
                  </Surface>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
