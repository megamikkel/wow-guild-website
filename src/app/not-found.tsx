import Link from "next/link";

import { PapiBadge } from "@/components/Logo";

/**
 * Lives outside the (public) route group, so it gets none of the site chrome
 * for free. It carries its own badge and its own way back — a wrong URL should
 * still look like PAPI, not like a dead host.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 text-center">
      <Link href="/" aria-label="PAPI forside">
        <PapiBadge size={160} priority className="h-28 w-auto sm:h-36" />
      </Link>
      <p className="stat-oversized mt-8 text-8xl text-stripe-red">404</p>
      <p className="display-heading mt-4 text-2xl">Wipe. Den side findes ikke.</p>
      <p className="mt-2 text-ink-muted">Release og løb tilbage.</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-md bg-papi-indigo px-5 py-3 font-display text-sm font-bold tracking-[0.1em] text-white uppercase transition-colors hover:bg-papi-purple"
        >
          Tilbage til forsiden
        </Link>
        <Link
          href="/roster"
          className="rounded-md border border-papi-purple/50 px-5 py-3 font-display text-sm font-bold tracking-[0.1em] text-papi-purple uppercase hover:bg-papi-purple-wash"
        >
          Se rosteret
        </Link>
      </div>
      <div className="stripe mt-10 w-40" aria-hidden />
    </main>
  );
}
