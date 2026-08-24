import Image from "next/image";

import { assetPath } from "@/lib/asset-path";

/**
 * The PAPI guild badge — a vintage sports-club emblem with the guild mascot.
 * The full badge carries the wordmark inside it, so at display sizes it stands
 * alone; the separate wordmark exists only for tight horizontal lockups
 * (navigation) where the badge is too small to read its own type.
 *
 * Two source files: a display master and a light variant for small contexts,
 * so a 38px header badge never pulls the hero-sized asset.
 */
const ASPECT = 776 / 1163; // width / height of the badge artwork

export function PapiBadge({
  size = 44,
  priority = false,
  className,
}: {
  size?: number;
  priority?: boolean;
  className?: string;
}) {
  const small = size <= 130;
  return (
    <Image
      src={assetPath(small ? "/brand/papi-logo-sm.png" : "/brand/papi-logo.png")}
      alt="PAPI guild badge"
      width={Math.round(size * ASPECT)}
      height={size}
      priority={priority}
      loading={priority ? undefined : "eager"}
      className={className}
    />
  );
}

export function PapiWordmark({ className }: { className?: string }) {
  return (
    <span className={`display-heading tracking-tight text-papi-indigo ${className ?? ""}`}>
      PAPI
    </span>
  );
}

/** Badge + wordmark, for navigation bars. */
export function PapiLogo({ size = 44 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <PapiBadge size={size} priority />
      <span className="flex flex-col leading-none">
        <PapiWordmark className="text-xl" />
        <span className="mt-1 font-display text-[8px] font-bold tracking-[0.18em] text-papi-purple uppercase">
          Est. always dad
        </span>
      </span>
    </span>
  );
}
