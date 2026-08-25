import type { Metadata } from "next";
import { Archivo, Inter, JetBrains_Mono } from "next/font/google";

import { guildConfig } from "@/config/guild";
import { assetPath } from "@/lib/asset-path";
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
    default: `${guildConfig.name} — WoW-guild på ${guildConfig.realm.name}`,
    template: `%s · ${guildConfig.name}`,
  },
  description: `${guildConfig.name} er en dansk World of Warcraft-guild på ${guildConfig.realm.name} (${guildConfig.region.toUpperCase()}). ${guildConfig.focusLong}. ${guildConfig.tagline}`,
  icons: { icon: assetPath("/favicon.svg"), apple: assetPath("/brand/papi-logo-180.png") },
  openGraph: {
    siteName: guildConfig.name,
    type: "website",
    locale: "da_DK",
    images: [{ url: assetPath("/brand/papi-og.png"), width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="da"
      className={`${archivo.variable} ${inter.variable} ${jetbrains.variable}`}
    >
      <body className="min-h-screen bg-canvas text-ink antialiased">{children}</body>
    </html>
  );
}
