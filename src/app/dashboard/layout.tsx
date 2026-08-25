import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { MobileNav, SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { auth } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/dashboard");

  if (!hasRole(session.user.role, "MEMBER")) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center px-4">
          <h1 className="display-heading text-3xl">Almost in.</h1>
          <p className="mt-3 text-ink-muted">
            You&apos;re signed in with Discord, but you&apos;re not a verified member of the PAPI
            Discord server yet. Join the server (or poke an officer) and sign in again.
          </p>
          <Link
            href="/apply"
            className="mt-6 rounded-md bg-papi-indigo px-5 py-3 font-display text-sm font-bold tracking-[0.1em] text-white uppercase"
          >
            Or apply to join
          </Link>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="min-h-[70vh]">{children}</main>
      <SiteFooter />
      <MobileNav />
    </>
  );
}
