import type { Metadata } from "next";
import { Archivo, Inter, JetBrains_Mono } from "next/font/google";

import { guildConfig } from "@/config/guild";
import "@/styles/globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PAPI_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: `${guildConfig.name} — ${guildConfig.focus} Guild`,
    template: `%s · ${guildConfig.name}`,
  },
  description: `${guildConfig.name} — ${guildConfig.focus} guild on ${guildConfig.realm.name} (${guildConfig.region.toUpperCase()}). ${guildConfig.tagline}`,
  icons: { icon: "/favicon.svg" },
  openGraph: {
    siteName: guildConfig.name,
    type: "website",
    locale: "en_GB",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${inter.variable} ${jetbrains.variable}`}
    >
      <body className="min-h-screen bg-canvas text-ink antialiased">{children}</body>
    </html>
  );
}
