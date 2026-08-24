import Link from "next/link";

import { PapiLogo, PapiMark } from "@/components/Logo";
import { guildConfig } from "@/config/guild";
import { auth, signOut } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";

const publicNav = [
  { href: "/", label: "Home" },
  { href: "/roster", label: "Roster" },
  { href: "/progression", label: "Progression" },
  { href: "/raids", label: "Raids" },
  { href: "/recruitment", label: "Recruitment" },
];

export async function SiteHeader() {
  const session = await auth();
  const role = session?.user?.role ?? "PUBLIC";
  const isMember = hasRole(role, "MEMBER");
  const isOfficer = hasRole(role, "OFFICER");

  return (
    <header className="sticky top-0 z-40 border-b border-edge/60 bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4">
        <Link href="/" aria-label="PAPI home" className="shrink-0">
          <PapiLogo />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {publicNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded px-3 py-2 font-display text-xs font-bold tracking-[0.14em] text-ink-muted uppercase transition-colors hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
          {isMember ? (
            <Link
              href="/dashboard"
              className="rounded px-3 py-2 font-display text-xs font-bold tracking-[0.14em] text-papi-blue uppercase transition-colors hover:text-ink"
            >
              Dashboard
            </Link>
          ) : null}
          {isOfficer ? (
            <Link
              href="/admin"
              className="rounded px-3 py-2 font-display text-xs font-bold tracking-[0.14em] text-papi-blue uppercase transition-colors hover:text-ink"
            >
              Command
            </Link>
          ) : null}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/apply"
            className="rounded-md bg-papi-red px-4 py-2 font-display text-xs font-bold tracking-[0.12em] text-papi-white uppercase transition-colors hover:bg-[#c92d20]"
          >
            Apply
          </Link>
          {session?.user ? (
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="hidden rounded px-2 py-2 text-xs text-ink-muted transition-colors hover:text-ink md:block"
                title={`Signed in as ${session.user.name}`}
              >
                Sign out
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="hidden px-2 py-2 text-xs text-ink-muted transition-colors hover:text-ink md:block"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
      <div className="split-line-soft" aria-hidden />
    </header>
  );
}

export async function MobileNav() {
  const session = await auth();
  const isMember = hasRole(session?.user?.role ?? "PUBLIC", "MEMBER");
  const items = [
    { href: "/", label: "Home" },
    { href: "/raids", label: "Raids" },
    { href: "/roster", label: "Roster" },
    { href: "/progression", label: "Guild" },
    isMember
      ? { href: "/dashboard", label: "Profile" }
      : { href: "/login", label: "Sign in" },
  ];
  return (
    <nav
      aria-label="Mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-canvas-deep/95 backdrop-blur md:hidden"
    >
      <div className="grid grid-cols-5">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center py-3 font-display text-[10px] font-bold tracking-[0.12em] text-ink-muted uppercase hover:text-ink"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-edge/60 pb-24 md:pb-0">
      <div className="split-line" aria-hidden />
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col justify-between gap-8 sm:flex-row">
          <div>
            <PapiMark size={36} />
            <p className="mt-3 max-w-xs text-sm text-ink-muted">{guildConfig.tagline}</p>
            <p className="mt-2 text-xs text-ink-faint">
              {guildConfig.region.toUpperCase()} · {guildConfig.realm.name} · {guildConfig.focus}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 text-sm">
            <div>
              <p className="stat-label mb-3">Guild</p>
              <ul className="space-y-2 text-ink-muted">
                <li><Link href="/roster" className="hover:text-ink">Roster</Link></li>
                <li><Link href="/progression" className="hover:text-ink">Progression</Link></li>
                <li><Link href="/raids" className="hover:text-ink">Raids</Link></li>
              </ul>
            </div>
            <div>
              <p className="stat-label mb-3">Join</p>
              <ul className="space-y-2 text-ink-muted">
                <li><Link href="/recruitment" className="hover:text-ink">Recruitment</Link></li>
                <li><Link href="/apply" className="hover:text-ink">Apply</Link></li>
                <li>
                  <a href={guildConfig.socials.discordInvite} rel="noopener noreferrer" className="hover:text-ink">
                    Discord
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <p className="mt-10 text-xs text-ink-faint">
          Data powered by{" "}
          <a href="https://raider.io" rel="noopener noreferrer" className="underline hover:text-ink-muted">
            Raider.IO
          </a>
          ,{" "}
          <a href="https://www.warcraftlogs.com" rel="noopener noreferrer" className="underline hover:text-ink-muted">
            Warcraft Logs
          </a>{" "}
          and the Blizzard API. World of Warcraft and related marks are trademarks of Blizzard
          Entertainment. PAPI is not affiliated with Blizzard.
        </p>
      </div>
    </footer>
  );
}
