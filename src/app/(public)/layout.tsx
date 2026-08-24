import { MobileNav, SiteFooter, SiteHeader } from "@/components/SiteChrome";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="min-h-[70vh]">
        {children}
      </main>
      <SiteFooter />
      <MobileNav />
    </>
  );
}
