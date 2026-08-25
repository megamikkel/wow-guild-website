import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PapiLogo } from "@/components/Logo";
import { auth, signIn } from "@/lib/auth";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Log ind",
  robots: { index: false },
};

function safeNext(next: string | undefined): string {
  // Only allow internal redirect targets.
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await auth();
  const { next } = await searchParams;
  const target = safeNext(next);
  if (session?.user) redirect(target);

  const discordConfigured = Boolean(env.discord.clientId && env.discord.clientSecret);
  const demo = env.isDemoMode;

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <PapiLogo size={40} />
        </div>
        <div className="rounded-xl border border-edge bg-surface p-6">
          <h1 className="display-heading mb-1 text-xl">Log ind</h1>
          <p className="mb-6 text-sm text-ink-muted">
            Discord er dit login i PAPI. Medlemmer og officerer logger ind her.
          </p>

          {discordConfigured ? (
            <form
              action={async () => {
                "use server";
                await signIn("discord", { redirectTo: target });
              }}
            >
              <button
                type="submit"
                className="w-full rounded-md bg-[#5865F2] px-5 py-3 font-display text-sm font-bold tracking-[0.1em] text-white uppercase transition-colors hover:bg-[#4752c4]"
              >
                Fortsæt med Discord
              </button>
            </form>
          ) : (
            <p className="rounded border border-edge bg-surface-2 p-3 text-xs text-ink-muted">
              Discord-login er ikke sat op i dette miljø.
            </p>
          )}

          {demo ? (
            <div className="mt-6">
              <p className="stat-label mb-3">Demo — prøv en rolle</p>
              <div className="grid gap-2">
                {(
                  [
                    ["member", "Raider — Frost"],
                    ["officer", "Officer — Luna"],
                    ["admin", "Admin — Mikkel"],
                  ] as const
                ).map(([account, label]) => (
                  <form
                    key={account}
                    action={async () => {
                      "use server";
                      await signIn("demo", { account, redirectTo: target });
                    }}
                  >
                    <button
                      type="submit"
                      className="w-full rounded-md border border-papi-purple/40 px-4 py-2.5 text-left font-display text-xs font-bold tracking-[0.1em] text-papi-purple uppercase transition-colors hover:bg-papi-purple-wash"
                    >
                      {label}
                    </button>
                  </form>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <p className="mt-6 text-center text-xs text-ink-faint">
          <Link href="/" className="hover:text-ink-muted">
            ← Tilbage til sitet
          </Link>
        </p>
      </div>
    </main>
  );
}
