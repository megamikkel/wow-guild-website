"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Surface } from "@/components/ui";
import type {
  JobProgress,
  OptimizerResult,
  SetupResult,
  SimMode,
  SlotItemView,
} from "@/lib/simc/types";

const SLOT_LABELS: Record<string, string> = {
  head: "Head",
  neck: "Neck",
  shoulder: "Shoulder",
  back: "Back",
  chest: "Chest",
  wrist: "Wrist",
  hands: "Hands",
  waist: "Waist",
  legs: "Legs",
  feet: "Feet",
  finger1: "Finger 1",
  finger2: "Finger 2",
  trinket1: "Trinket 1",
  trinket2: "Trinket 2",
  main_hand: "Main Hand",
  off_hand: "Off Hand",
};

const PHASE_LABEL: Record<JobProgress["phase"], string> = {
  parsing: "Parsing SimC",
  baseline: "Simulating current gear",
  screening: "Screening candidates",
  combinations: "Simulating gear setups",
  verifying: "Verifying top candidates",
  done: "Complete",
  error: "Failed",
};

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function SourceTag({ source }: { source: SlotItemView["source"] }) {
  if (source === "empty") return null;
  const isBag = source === "bags";
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 font-display text-[10px] font-bold tracking-[0.12em] ${
        isBag
          ? "border-papi-purple/35 bg-papi-purple-wash text-papi-purple"
          : "border-edge bg-surface-3 text-ink-muted"
      }`}
    >
      {isBag ? "FROM BAGS" : "CURRENT"}
    </span>
  );
}

function GearList({ gear }: { gear: SlotItemView[] }) {
  return (
    <ul className="divide-y divide-edge">
      {gear.map((item) => (
        <li key={item.slot} className="flex items-center justify-between gap-4 py-2.5">
          <div className="min-w-0">
            <p className="stat-label">{SLOT_LABELS[item.slot] ?? item.slot}</p>
            <p className="truncate font-medium text-ink">{item.name}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {item.ilvl ? (
              <span className="font-mono text-sm text-ink-muted">{item.ilvl}</span>
            ) : null}
            <SourceTag source={item.source} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function SetupRow({
  setup,
  expanded,
  onToggle,
}: {
  setup: SetupResult;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-edge last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-4 px-5 py-3 text-left hover:bg-surface-2"
      >
        <span className="flex items-baseline gap-3">
          <span className="font-display text-lg font-bold text-papi-indigo">{setup.rank}.</span>
          <span className="font-mono text-lg text-ink">{fmt(setup.dps)} DPS</span>
          <span className="font-mono text-sm text-ink-faint">±{fmt(setup.dpsError)}</span>
        </span>
        <span className="flex items-center gap-3">
          {setup.withinErrorOfBest ? (
            <span className="font-display text-[10px] font-bold tracking-[0.12em] text-warn">
              TIED WITH BEST
            </span>
          ) : null}
          <span
            className={`font-mono text-sm ${setup.gainPct >= 0 ? "text-ok" : "text-stripe-red"}`}
          >
            {setup.gainPct >= 0 ? "+" : ""}
            {setup.gainPct.toFixed(2)}%
          </span>
          <span aria-hidden className="text-ink-faint">
            {expanded ? "−" : "+"}
          </span>
        </span>
      </button>
      {expanded ? (
        <div className="border-t border-edge bg-surface-2 px-5 py-3">
          <GearList gear={setup.gear} />
        </div>
      ) : null}
    </div>
  );
}

export function OptimizerClient() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<SimMode>("single_target");
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [result, setResult] = useState<OptimizerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(1);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    },
    [],
  );

  const poll = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/optimizer/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Optimization failed.");
        setStatus("error");
        return;
      }
      setProgress(data.progress);
      if (data.status === "done") {
        setResult(data.result);
        setStatus("done");
        return;
      }
      if (data.status === "error") {
        setError(data.error ?? "Optimization failed.");
        setStatus("error");
        return;
      }
      pollRef.current = setTimeout(() => void poll(id), 1500);
    } catch {
      setError("Lost contact with the optimizer.");
      setStatus("error");
    }
  }, []);

  const start = useCallback(async () => {
    setStatus("running");
    setError(null);
    setResult(null);
    setProgress(null);
    try {
      const res = await fetch("/api/optimizer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input, mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not start the optimization.");
        setStatus("error");
        return;
      }
      setProgress(data.progress);
      void poll(data.id);
    } catch {
      setError("Could not reach the optimizer API.");
      setStatus("error");
    }
  }, [input, mode, poll]);

  const running = status === "running";
  const pct =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : null;

  return (
    <div className="space-y-8">
      <Surface className="p-6">
        <label htmlFor="simc-input" className="stat-label">
          SimC string
        </label>
        <p className="mt-1 mb-3 text-sm text-ink-muted">
          Paste the complete output from <code className="font-mono">/simc</code> in game,
          including the <code className="font-mono">### Gear from Bags</code> section.
        </p>
        <textarea
          id="simc-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          rows={12}
          placeholder={'paladin="Kreaturen"\nlevel=90\nspec=retribution\n…'}
          className="w-full rounded-md border border-edge bg-surface-2 p-3 font-mono text-xs text-ink focus:border-papi-purple focus:outline-none"
        />

        <fieldset className="mt-5">
          <legend className="stat-label mb-2">Mode</legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["single_target", "Single Target", "1 target · 300s · Patchwerk"],
                ["aoe", "AoE", "5 targets · 180s · sustained"],
              ] as const
            ).map(([value, label, hint]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                aria-pressed={mode === value}
                className={`rounded-md border-2 px-4 py-2.5 text-left transition-colors ${
                  mode === value
                    ? "border-papi-indigo bg-papi-indigo text-white"
                    : "border-edge text-ink hover:border-papi-purple"
                }`}
              >
                <span className="block font-display text-sm font-bold tracking-[0.1em] uppercase">
                  {label}
                </span>
                <span
                  className={`block text-xs ${mode === value ? "text-white/70" : "text-ink-muted"}`}
                >
                  {hint}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <button
          type="button"
          onClick={() => void start()}
          disabled={running || input.trim().length === 0}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-papi-indigo px-6 py-3 font-display text-sm font-bold tracking-[0.1em] text-white uppercase transition-colors hover:bg-papi-purple disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? "Simulating…" : "Find best gear"}
        </button>
      </Surface>

      {progress && status !== "idle" ? (
        <Surface className="p-6">
          <div className="flex items-baseline justify-between gap-4">
            <p className="font-display text-sm font-bold tracking-[0.1em] text-papi-indigo uppercase">
              {PHASE_LABEL[progress.phase]}
            </p>
            {pct !== null ? (
              <p className="font-mono text-sm text-ink-muted">
                {progress.done} / {progress.total}
              </p>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-ink-muted">{progress.message}</p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-papi-purple transition-[width]"
              style={{ width: `${pct ?? 5}%` }}
            />
          </div>
          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div>
              <dt className="stat-label">Items detected</dt>
              <dd className="font-mono text-ink">{progress.itemsDetected}</dd>
            </div>
            <div>
              <dt className="stat-label">Setups tested</dt>
              <dd className="font-mono text-ink">{progress.candidatesTested}</dd>
            </div>
          </dl>
        </Surface>
      ) : null}

      {error ? (
        <Surface className="border-stripe-red/40 p-6">
          <p className="font-display text-sm font-bold tracking-[0.1em] text-stripe-red uppercase">
            Optimization stopped
          </p>
          <pre className="mt-2 font-mono text-sm break-words whitespace-pre-wrap text-ink">
            {error}
          </pre>
        </Surface>
      ) : null}

      {result ? <ResultView result={result} expanded={expanded} setExpanded={setExpanded} /> : null}
    </div>
  );
}

function ResultView({
  result,
  expanded,
  setExpanded,
}: {
  result: OptimizerResult;
  expanded: number | null;
  setExpanded: (v: number | null) => void;
}) {
  const best = result.bestSetup;
  return (
    <div className="space-y-8">
      <Surface className="p-6">
        <p className="banner mb-3">
          {result.mode === "aoe" ? "Best AoE gear" : "Best single target gear"}
        </p>
        <h2 className="display-heading text-3xl text-papi-indigo">
          {result.character.name}
        </h2>
        <p className="text-ink-muted capitalize">
          {result.character.spec} {result.character.classToken.replace("_", " ")}
        </p>

        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          <div>
            <p className="stat-label">Current DPS</p>
            <p className="stat-oversized mt-1 text-3xl text-papi-indigo">
              {fmt(result.baseline.mean)}
            </p>
            <p className="mt-1 font-mono text-xs text-ink-faint">
              ±{fmt(result.baseline.meanError)}
            </p>
          </div>
          <div>
            <p className="stat-label">Optimized DPS</p>
            <p className="stat-oversized mt-1 text-3xl text-papi-purple">{fmt(best.dps)}</p>
            <p className="mt-1 font-mono text-xs text-ink-faint">±{fmt(best.dpsError)}</p>
          </div>
          <div>
            <p className="stat-label">Gain</p>
            <p
              className={`stat-oversized mt-1 text-3xl ${best.gainDps >= 0 ? "text-ok" : "text-stripe-red"}`}
            >
              {best.gainDps >= 0 ? "+" : ""}
              {best.gainPct.toFixed(2)}%
            </p>
            <p className="mt-1 font-mono text-xs text-ink-faint">
              {best.gainDps >= 0 ? "+" : ""}
              {fmt(best.gainDps)} DPS
            </p>
          </div>
        </div>

        {result.improvementWithinError ? (
          <p className="mt-5 rounded-md border border-warn/40 bg-warn/10 p-3 text-sm text-ink">
            The difference between your current gear and the best setup is inside the
            simulation error. These setups should be considered effectively equal — no
            gear change is justified by this run.
          </p>
        ) : null}
      </Surface>

      {result.gearChanges.length > 0 ? (
        <Surface className="p-6">
          <h3 className="display-heading mb-4 text-xl text-papi-indigo">
            Changes from current gear
          </h3>
          <ul className="space-y-3">
            {result.gearChanges.map((change) => {
              const downgrade =
                change.from?.ilvl != null &&
                change.to?.ilvl != null &&
                change.to.ilvl < change.from.ilvl;
              return (
                <li key={change.slot} className="rounded-md border border-edge p-3">
                  <p className="stat-label">{SLOT_LABELS[change.slot] ?? change.slot}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-ink-muted line-through">
                      {change.from ? `${change.from.ilvl ?? "?"} ${change.from.name}` : "Empty"}
                    </span>
                    <span aria-hidden className="text-ink-faint">
                      →
                    </span>
                    <span className="font-medium text-ink">
                      {change.to ? `${change.to.ilvl ?? "?"} ${change.to.name}` : "Empty"}
                    </span>
                  </div>
                  {downgrade ? (
                    <p className="mt-2 text-xs text-warn">
                      Lower item level, but simulated higher — SimulationCraft measured this
                      setup as stronger, typically through a set bonus or item effect.
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Surface>
      ) : (
        <Surface className="p-6">
          <p className="text-ink-muted">
            No gear change beat your current setup in this simulation. You are already
            wearing the best combination of what you own for this mode.
          </p>
        </Surface>
      )}

      <Surface className="p-6">
        <h3 className="display-heading mb-4 text-xl text-papi-indigo">Best setup</h3>
        <GearList gear={best.gear} />
      </Surface>

      <Surface>
        <h3 className="display-heading border-b border-edge px-5 py-4 text-xl text-papi-indigo">
          Top {result.topSetups.length} setups
        </h3>
        {result.topSetups.map((setup) => (
          <SetupRow
            key={setup.rank}
            setup={setup}
            expanded={expanded === setup.rank}
            onToggle={() => setExpanded(expanded === setup.rank ? null : setup.rank)}
          />
        ))}
      </Surface>

      <Surface className="p-6">
        <h3 className="display-heading mb-4 text-xl text-papi-indigo">Simulation details</h3>
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Mode", result.mode === "aoe" ? "AoE" : "Single Target"],
            ["Targets", String(result.simulation.targets)],
            ["Fight style", result.simulation.fightStyle],
            ["Duration", `${result.simulation.durationSeconds} sec`],
            [
              "Iterations (final)",
              fmt(result.simulation.verificationIterations),
            ],
            ["SimulationCraft", result.simulation.simcVersion],
            ["Game data", result.simulation.wowVersion],
            ["Talent build", "Active"],
            ["Setups tested", fmt(result.candidatesTested)],
            ["SimC runs", fmt(result.simsRun)],
            ["Cache hits", fmt(result.cacheHits)],
            ["Error (best)", `±${fmt(result.bestSetup.dpsError)} DPS`],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="stat-label">{label}</dt>
              <dd className="font-mono text-sm text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        {result.warnings.length > 0 || result.invalidCombinations.length > 0 ? (
          <div className="mt-5 border-t border-edge pt-4">
            <p className="stat-label mb-2">Notes</p>
            <ul className="space-y-1 text-sm text-ink-muted">
              {result.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
              {result.invalidCombinations.length > 0 ? (
                <li>
                  {result.invalidCombinations.length} combination
                  {result.invalidCombinations.length === 1 ? " was" : "s were"} rejected by
                  SimulationCraft as invalid and excluded.
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </Surface>
    </div>
  );
}
