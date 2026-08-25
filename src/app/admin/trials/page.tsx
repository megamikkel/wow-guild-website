import { ProgressBar, SectionHeading, StatusPill, Surface } from "@/components/ui";
import { getTrials } from "@/domain/queries";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TrialsPage() {
  const trials = await getTrials();
  const active = trials.filter((t) => t.status === "ACTIVE");
  const closed = trials.filter((t) => t.status !== "ACTIVE");

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <SectionHeading kicker={`${active.length} i gang`} title="Prøvetid" />
      {active.length === 0 ? (
        <p className="text-ink-muted">Ingen på prøve lige nu. Bænken er som den er.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {active.map((t) => {
            const totalDays = Math.max(
              1,
              Math.round((t.expectedEndDate.getTime() - t.startDate.getTime()) / 86_400_000),
            );
            const dayNumber = Math.min(
              totalDays,
              Math.max(1, Math.ceil((Date.now() - t.startDate.getTime()) / 86_400_000)),
            );
            const reviewDue = t.expectedEndDate.getTime() - Date.now() < 5 * 86_400_000;
            return (
              <Surface key={t.id} className={`p-5 ${reviewDue ? "border-warn/50" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="display-heading text-xl">{t.characterName}</h2>
                  {reviewDue ? (
                    <StatusPill tone="warn">Skal vurderes</StatusPill>
                  ) : (
                    <StatusPill tone="blue">I gang</StatusPill>
                  )}
                </div>
                <p className="stat-label mt-2">
                  Dag {dayNumber} af {totalDays}
                </p>
                <div className="mt-2">
                  <ProgressBar
                    pct={(dayNumber / totalDays) * 100}
                    accent="purple"
                    label={`${t.characterName} trial progress`}
                  />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="stat-label">Fremmøde</dt>
                    <dd className="mt-0.5 font-mono tabular-nums">
                      {t.attendancePct != null ? `${Math.round(t.attendancePct)}%` : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="stat-label">Raids</dt>
                    <dd className="mt-0.5 font-mono tabular-nums">{t.raidsAttended}</dd>
                  </div>
                </dl>
                {t.performanceNote ? (
                  <p className="mt-3 text-sm text-ink-muted">{t.performanceNote}</p>
                ) : null}
                <p className="mt-3 text-xs text-ink-faint">
                  Startede {formatDate(t.startDate)} · afgørelse senest {formatDate(t.expectedEndDate)}
                </p>
              </Surface>
            );
          })}
        </div>
      )}

      {closed.length > 0 ? (
        <section className="mt-12">
          <SectionHeading kicker="Historik" title="Afsluttede" />
          <ul className="divide-y divide-edge border-y border-edge">
            {closed.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                <span>{t.characterName}</span>
                <span className="font-display text-xs font-bold tracking-widest text-ink-faint">
                  {t.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="mt-10 text-xs text-ink-faint">
        Tallene er til hjælp — ingen algoritme bestemmer hvem der bliver. Det er en officer-beslutning.
      </p>
    </div>
  );
}
