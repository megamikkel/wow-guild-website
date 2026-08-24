/**
 * The PAPI mark — an original emblem built from the brand palette.
 * A single chunky "P" letterform split the way the site's signature line is:
 * red stem, electric-blue bowl, chamfered corners for the esports edge.
 * Geometry is tuned to stay legible down to favicon size.
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
      <rect width="64" height="64" rx="14" fill="#07065F" />
      {/* stem */}
      <path d="M15 11h11v42H15z" fill="#E13527" />
      {/* bowl with its counter cut out */}
      <path
        d="M26 11h15l8 8v15l-8 8H26V11zm0 11v10h10l2-2v-6l-2-2H26z"
        fill="#397CEF"
        fillRule="evenodd"
      />
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
