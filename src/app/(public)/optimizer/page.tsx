import type { Metadata } from "next";

import { OptimizerClient } from "./OptimizerClient";

export const metadata: Metadata = {
  title: "Gear optimizer",
  description:
    "Find the best combination of the gear you already own, ranked by real SimulationCraft simulations.",
};

export default function OptimizerPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <header className="mb-10 max-w-2xl">
        <p className="banner mb-3">Gear optimizer</p>
        <h1 className="display-heading text-4xl text-papi-indigo sm:text-5xl">
          Find dit bedste gear
        </h1>
        <p className="mt-4 text-lg text-ink-muted">
          Indsæt din <code className="font-mono">/simc</code>-streng, vælg Single Target
          eller AoE, og få den bedste kombination af det gear du allerede har — equipped
          og i bags. Hver eneste DPS-tal kommer fra en rigtig SimulationCraft-simulering;
          intet er estimeret.
        </p>
      </header>
      <OptimizerClient />
    </div>
  );
}
