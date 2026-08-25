import type { Metadata } from "next";

import { CtaLink, StatusPill } from "@/components/ui";

export const metadata: Metadata = {
  title: "Ansøgning modtaget",
  robots: { index: false },
};

export default function ApplySuccessPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-start px-4 py-24">
      <p className="stat-label mb-3">Recruitment</p>
      <h1 className="display-heading text-5xl sm:text-6xl">
        Ansøgning
        <br />
        modtaget.
      </h1>
      <div className="stripe mt-6 mb-8 w-40" aria-hidden />
      <p className="text-lg text-ink-muted">
        Vi kigger på den og skriver til dig på Discord. Hold øje med dine beskeder — og
        få lige varmet de keybinds op.
      </p>
      <p className="mt-6 flex items-center gap-3">
        <span className="stat-label">Status</span>
        <StatusPill tone="blue">Under behandling</StatusPill>
      </p>
      <div className="mt-10">
        <CtaLink href="/" variant="secondary">
          Tilbage til forsiden
        </CtaLink>
      </div>
    </div>
  );
}
