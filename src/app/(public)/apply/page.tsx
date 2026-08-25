import type { Metadata } from "next";

import { guildConfig } from "@/config/guild";
import { ApplyForm } from "./ApplyForm";

export const metadata: Metadata = {
  title: "Søg om plads",
  description: `Apply to join ${guildConfig.name} — ${guildConfig.focus} on ${guildConfig.realm.name} (${guildConfig.region.toUpperCase()}).`,
};

export default function ApplyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-10">
        <p className="banner mb-3">Rekruttering</p>
        <h1 className="display-heading text-5xl text-papi-indigo">Søg om plads</h1>
        <p className="mt-3 text-ink-muted">
          Fem minutter, ingen stile. Vi læser alle ansøgninger, og du hører fra os
          uanset hvad.
        </p>
        <div className="stripe mt-6 max-w-40" aria-hidden />
      </header>
      <ApplyForm />
    </div>
  );
}
