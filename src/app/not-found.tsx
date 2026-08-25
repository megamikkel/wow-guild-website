import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 text-center">
      <p className="stat-oversized text-8xl text-stripe-red">404</p>
      <p className="display-heading mt-4 text-2xl">Wipe. This page doesn&apos;t exist.</p>
      <p className="mt-2 text-ink-muted">Release and run back.</p>
      <Link
        href="/"
        className="mt-8 rounded-md border border-papi-purple/50 px-5 py-3 font-display text-sm font-bold tracking-[0.1em] text-papi-purple uppercase hover:bg-papi-purple-wash"
      >
        Back to home
      </Link>
    </main>
  );
}
