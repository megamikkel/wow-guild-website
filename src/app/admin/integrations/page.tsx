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
        kicker={env.isDemoMode ? "Demo mode — fixture data" : "Live"}
        title="Integrations"
      />
      <div className="grid gap-3">
        {integrations.map((i) => (
          <Surface key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="font-display font-bold">{LABELS[i.name] ?? i.name}</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {i.lastSyncAt ? `Last sync ${formatRelative(i.lastSyncAt)}` : "Never synced"}
                {i.lastSuccessAt && i.lastSuccessAt.getTime() !== i.lastSyncAt?.getTime()
                  ? ` · last success ${formatRelative(i.lastSuccessAt)}`
                  : ""}
              </p>
              {i.lastError ? (
                <p className="mt-1 max-w-lg text-xs text-stripe-red">{i.lastError}</p>
              ) : null}
            </div>
            {i.state === "CONNECTED" ? (
              <StatusPill tone="ok">● Connected</StatusPill>
            ) : i.state === "DEGRADED" ? (
              <StatusPill tone="warn">● Degraded</StatusPill>
            ) : i.state === "ERROR" ? (
              <StatusPill tone="danger">● Error</StatusPill>
            ) : (
              <StatusPill tone="muted">Not configured</StatusPill>
            )}
          </Surface>
        ))}
      </div>
      <p className="mt-8 text-xs text-ink-faint">
        Diagnostics never include secrets. Sync runs via <code>POST /api/sync</code> (bearer
        {" "}<code>PAPI_SYNC_SECRET</code>), typically triggered by the scheduled GitHub Action.
      </p>
    </div>
  );
}
