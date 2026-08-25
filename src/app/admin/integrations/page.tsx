import { SectionHeading, StatusPill, Surface } from "@/components/ui";
import { getIntegrations } from "@/domain/queries";
import { env } from "@/lib/env";
import { formatRelative } from "@/lib/format";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  discord: "Discord",
  raid_helper: "Raid-Helper",
  raider_io: "Raider.IO",
  warcraft_logs: "Warcraft Logs",
  battle_net: "Battle.net",
};

export default async function IntegrationsPage() {
  const integrations = await getIntegrations();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <SectionHeading
        kicker={env.isDemoMode ? "Demo — testdata" : "Live"}
        title="Integrationer"
      />
      <div className="grid gap-3">
        {integrations.map((i) => (
          <Surface key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="font-display font-bold">{LABELS[i.name] ?? i.name}</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {i.lastSyncAt ? `Sidst hentet ${formatRelative(i.lastSyncAt)}` : "Aldrig hentet"}
                {i.lastSuccessAt && i.lastSuccessAt.getTime() !== i.lastSyncAt?.getTime()
                  ? ` · sidst uden fejl ${formatRelative(i.lastSuccessAt)}`
                  : ""}
              </p>
              {i.lastError ? (
                <p className="mt-1 max-w-lg text-xs text-stripe-red">{i.lastError}</p>
              ) : null}
            </div>
            {i.state === "CONNECTED" ? (
              <StatusPill tone="ok">● Forbundet</StatusPill>
            ) : i.state === "DEGRADED" ? (
              <StatusPill tone="warn">● Ustabil</StatusPill>
            ) : i.state === "ERROR" ? (
              <StatusPill tone="danger">● Fejl</StatusPill>
            ) : (
              <StatusPill tone="muted">Ikke sat op</StatusPill>
            )}
          </Surface>
        ))}
      </div>
      <p className="mt-8 text-xs text-ink-faint">
        Diagnostik indeholder aldrig hemmeligheder. Synkronisering kører via <code>POST /api/sync</code> (bearer
        {" "}<code>PAPI_SYNC_SECRET</code>), typically triggered by the scheduled GitHub Action.
      </p>
    </div>
  );
}
