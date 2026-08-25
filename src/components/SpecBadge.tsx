"use client";

import { useState } from "react";

import { classColorVar, specAbbr, specIconUrl } from "@/lib/wow";

/**
 * A spec's icon, with the class-coloured shorthand tile behind it.
 *
 * Three sources, in order: the URL the Battle.net sync resolved through
 * Blizzard's media API, the icon slug we keep for each spec, and — if neither
 * exists or the image fails to load — the tile. The site therefore shows real
 * spec icons on a free static host with no credentials at all, and never shows
 * a broken image if Blizzard moves a file.
 *
 * Client-side because the fallback needs to react to onError; every other
 * piece of WoW chrome stays a server component.
 */
export function SpecBadge({
  className: wowClass,
  specName,
  iconUrl,
  size = 28,
}: {
  className: string;
  specName: string;
  iconUrl?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const label = `${specName} ${wowClass}`;
  const src = iconUrl ?? specIconUrl(wowClass, specName);

  if (src && !failed) {
    return (
      // The URL is Blizzard's CDN, so next/image cannot optimise it and the
      // static export ships no optimiser.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={label}
        title={label}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setFailed(true)}
        className="shrink-0 rounded-md border border-edge-strong"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      title={label}
      aria-label={label}
      role="img"
      className="inline-flex shrink-0 items-center justify-center rounded-md border font-display font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        letterSpacing: "0.02em",
        background: `var(${classColorVar(wowClass)})`,
        borderColor: "rgba(12,19,56,0.25)",
      }}
    >
      {specAbbr(specName)}
    </span>
  );
}
