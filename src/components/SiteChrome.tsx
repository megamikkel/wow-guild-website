import Link from "next/link";

import { PapiBadge, PapiLogo } from "@/components/Logo";
import { SignOutButton } from "@/components/SignOutButton";
import { guildConfig } from "@/config/guild";
import { auth } from "@/lib/auth";
import { IS_STATIC_EXPORT } from "@/lib/render-mode";
import { hasRole } from "@/lib/rbac";

const publicNav = [
  { href: "/", label: "Forside" },
  { href: "/roster", label: "Roster" },
  { href: "/progression", label: "Fremgang" },
  { href: "/raids", label: "Raids" },
  { href: "/recruitment", label: "Bliv medlem" },
];

export async function SiteHeader() {
  // A static build has no request, so there is no session to read and no
  // server action to bind a sign-out form to.
  const session = IS_STATIC_EXPORT ? null : await auth();
  const role = session?.user?.role ?? "PUBLIC";
  const isMember = hasRole(role, "MEMBER");
  const isOfficer = hasRole(role, "OFFICER");

  return (
    <header className="sticky top-0 z-40 border-b border-edge bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-6 px-4">
        <Link href="/" aria-label="PAPI home" className="shrink-0">
          <PapiLogo />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {publicNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded px-3 py-2 font-display text-xs font-bold tracking-[0.14em] text-ink-muted uppercase transition-colors hover:text-papi-purple"
            >
              {item.label}
            </Link>
          ))}
          {isMember ? (
            <Link
              href="/dashboard"
              className="rounded px-3 py-2 font-display text-xs font-bold tracking-[0.14em] text-papi-purple uppercase transition-colors hover:text-papi-indigo"
            >
              Min side
            </Link>
          ) : null}
          {isOfficer ? (
            <Link
              href="/admin"
              className="rounded px-3 py-2 font-display text-xs font-bold tracking-[0.14em] text-papi-purple uppercase transition-colors hover:text-papi-indigo"
            >
              Officer
            </Link>
          ) : null}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/apply"
            className="rounded-md bg-papi-indigo px-4 py-2.5 font-display text-xs font-bold tracking-[0.12em] text-white uppercase transition-colors hover:bg-papi-purple"
          >
            Søg
          </Link>
          {IS_STATIC_EXPORT ? null : session?.user ? (
            <SignOutButton title={`Signed in as ${session.user.name}`} />
          ) : (
            <Link
              href="/login"
              className="hidden px-2 py-2 text-xs text-ink-muted transition-colors hover:text-ink md:block"
            >
              Log ind
            </Link>
          )}
        </div>
      </div>
      <div className="stripe-thin" aria-hidden />
    </header>
  );
}

export async function MobileNav() {
  const session = IS_STATIC_EXPORT ? null : await auth();
  const isMember = hasRole(session?.user?.role ?? "PUBLIC", "MEMBER");
  // The static build has no /login and no /dashboard to send anyone to, so the
  // fifth tab would 404. Recruiting is what the public site is for anyway.
  const lastTab = IS_STATIC_EXPORT
    ? { href: "/apply", label: "Søg" }
    : isMember
      ? { href: "/dashboard", label: "Min side" }
      : { href: "/login", label: "Log ind" };
  const items = [
    { href: "/", label: "Forside" },
    { href: "/raids", label: "Raids" },
    { href: "/roster", label: "Roster" },
    { href: "/progression", label: "Guild" },
    lastTab,
  ];
  return (
    <nav
      aria-label="Mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-canvas/95 backdrop-blur md:hidden"
    >
      <div className="grid grid-cols-5">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center py-3 font-display text-[10px] font-bold tracking-[0.12em] text-ink-muted uppercase hover:text-papi-purple"
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
    <footer className="mt-20 pb-24 md:pb-0">
      <div className="stripe" aria-hidden />
      <div className="paper">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="flex flex-col justify-between gap-8 sm:flex-row">
            <div>
              <PapiBadge size={92} />
              <p className="mt-4 max-w-xs text-sm text-ink-muted">{guildConfig.tagline}</p>
              <p className="mt-2 text-xs text-ink-faint">
                {guildConfig.region.toUpperCase()} · {guildConfig.realm.name} ·{" "}
                {guildConfig.focus}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-8 text-sm">
              <div>
                <p className="stat-label mb-3">Guilden</p>
                <ul className="space-y-2 text-ink-muted">
                  <li><Link href="/roster" className="hover:text-papi-purple">Roster</Link></li>
                  <li><Link href="/progression" className="hover:text-papi-purple">Fremgang</Link></li>
                  <li><Link href="/raids" className="hover:text-papi-purple">Raids</Link></li>
                </ul>
              </div>
              <div>
                <p className="stat-label mb-3">Vær med</p>
                <ul className="space-y-2 text-ink-muted">
                  <li><Link href="/recruitment" className="hover:text-papi-purple">Bliv medlem</Link></li>
                  <li><Link href="/apply" className="hover:text-papi-purple">Søg om plads</Link></li>
                  <li>
                    <a href={guildConfig.socials.discordInvite} rel="noopener noreferrer" className="hover:text-papi-purple">
                      Discord
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <p className="mt-10 text-xs text-ink-faint">
            Data fra{" "}
            <a href="https://raider.io" rel="noopener noreferrer" className="underline hover:text-ink-muted">
              Raider.IO
            </a>
            ,{" "}
            <a href="https://www.warcraftlogs.com" rel="noopener noreferrer" className="underline hover:text-ink-muted">
              Warcraft Logs
            </a>{" "}
            og Blizzards API. World of Warcraft og tilhørende varemærker tilhører Blizzard
            Entertainment. PAPI er ikke tilknyttet Blizzard.
          </p>
        </div>
      </div>
    </footer>
  );
}
