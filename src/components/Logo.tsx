/**
 * The PAPI mark — an original emblem drawn from the brand palette.
 * Two interlocking chevrons (red descending, blue ascending) forming an
 * abstract "P" negative space on navy: the same red→blue split used in the
 * site's signature line. Deliberately NOT a circle/wave — no resemblance to
 * other brands.
 */
export function PapiMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="PAPI emblem"
      className={className}
    >
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#07065F" />
      {/* red chevron — strikes down from the top left */}
      <path d="M14 12h20l14 20-8 0-12-16H22v40h-8V12Z" fill="#E13527" />
      {/* blue chevron — rises from the bottom right */}
      <path d="M50 52H32L26 42h9l7 6h0V30l8 6v16Z" fill="#397CEF" />
      {/* white counter — the P's eye */}
      <path d="M28 22h8l6 8-6 8h-8V22Z" fill="#FBFBFC" />
    </svg>
  );
}

export function PapiWordmark({ className }: { className?: string }) {
  return (
    <span className={`display-heading tracking-tight ${className ?? ""}`}>
      <span className="text-papi-white">PAP</span>
      <span className="text-papi-blue">I</span>
    </span>
  );
}

export function PapiLogo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <PapiMark size={size} />
      <PapiWordmark className="text-xl" />
    </span>
  );
}
