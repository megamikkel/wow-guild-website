import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PapiLogo } from "@/components/Logo";
import { auth, signOut } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";

export const metadata: Metadata = {
  title: "Command",
  robots: { index: false, follow: false },
};

const adminNav = [
  { href: "/admin", label: "Command" },
  { href: "/admin/applications", label: "Recruitment" },
  { href: "/admin/trials", label: "Trials" },
  { href: "/admin/integrations", label: "Integrations" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/admin");
  if (!hasRole(session.user.role, "OFFICER")) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 text-center">
        <p className="stat-oversized text-7xl text-papi-red">403</p>
        <p className="display-heading mt-4 text-2xl">Officers only.</p>
        <p className="mt-2 text-ink-muted">This area needs an officer rank in Discord.</p>
        <Link href="/dashboard" className="mt-8 text-papi-blue hover:underline">
          Back to your dashboard
        </Link>
      </main>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-edge/60 bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4">
          <Link href="/admin" aria-label="PAPI command">
            <PapiLogo />
          </Link>
          <nav aria-label="Officer" className="flex items-center gap-1 overflow-x-auto">
            {adminNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded px-3 py-2 font-display text-xs font-bold tracking-[0.14em] whitespace-nowrap text-ink-muted uppercase transition-colors hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-3">
            <Link href="/" className="hidden text-xs text-ink-muted hover:text-ink sm:block">
              Public site
            </Link>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button type="submit" className="text-xs text-ink-muted hover:text-ink">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <div className="split-line-soft" aria-hidden />
      </header>
      <main className="min-h-[80vh]">{children}</main>
    </>
  );
}
