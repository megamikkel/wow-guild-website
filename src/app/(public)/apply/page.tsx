import type { Metadata } from "next";

import { guildConfig } from "@/config/guild";
import { ApplyForm } from "./ApplyForm";

export const metadata: Metadata = {
  title: "Apply",
  description: `Apply to join ${guildConfig.name} — ${guildConfig.focus} on ${guildConfig.realm.name} (${guildConfig.region.toUpperCase()}).`,
};

export default function ApplyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-10">
        <p className="stat-label mb-2">Recruitment</p>
        <h1 className="display-heading text-5xl">Apply to PAPI</h1>
        <p className="mt-3 text-ink-muted">
          Five minutes, no essay questions. Officers read every application and you&apos;ll hear
          back either way.
        </p>
        <div className="stripe mt-6 max-w-40" aria-hidden />
      </header>
      <ApplyForm />
    </div>
  );
}
