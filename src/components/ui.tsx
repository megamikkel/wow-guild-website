import Link from "next/link";
import type { ReactNode } from "react";

import { ROLE_ICON, roleKey } from "@/components/icons/roles";

/** Small shared presentational building blocks. */

export function SectionHeading({
  kicker,
  title,
  right,
}: {
  kicker?: string;
  title: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        {kicker ? <p className="banner mb-2">{kicker}</p> : null}
        <h2 className="display-heading text-2xl text-papi-indigo sm:text-3xl">{title}</h2>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function Surface({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-edge bg-surface shadow-[0_1px_2px_rgba(12,19,56,0.04)] ${className}`}>
      {children}
    </div>
  );
}

export function StatBlock({
  label,
  value,
  sub,
  accent = "ink",
  size = "md",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: "ink" | "red" | "purple";
  size?: "md" | "lg" | "xl";
}) {
  const color =
    accent === "red"
      ? "text-stripe-red"
      : accent === "purple"
        ? "text-papi-purple"
        : "text-papi-indigo";
  const sizeCls =
    size === "xl"
      ? "text-6xl sm:text-7xl"
      : size === "lg"
        ? "text-4xl sm:text-5xl"
        : "text-2xl sm:text-3xl";
  return (
    <div>
      <p className="stat-label">{label}</p>
      <p className={`stat-oversized mt-1 ${sizeCls} ${color}`}>{value}</p>
      {sub ? <p className="mt-1 text-sm text-ink-muted">{sub}</p> : null}
    </div>
  );
}

export function ProgressBar({
  pct,
  accent = "purple",
  label,
}: {
  pct: number;
  accent?: "purple" | "red" | "ok";
  label?: string;
}) {
  const color =
    accent === "red" ? "bg-stripe-red" : accent === "ok" ? "bg-ok" : "bg-papi-purple";
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-2 w-full overflow-hidden rounded-full bg-surface-3"
    >
      <div className={`bar-fill h-full rounded-full ${color}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

/** Recruitment priority, in the words an officer would actually use. */
const PRIORITY_DA: Record<string, string> = {
  HIGH: "Søges",
  MEDIUM: "Måske",
  LOW: "Lav",
  CLOSED: "Lukket",
};

export function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    HIGH: "bg-stripe-red text-white border-stripe-red",
    MEDIUM: "bg-papi-purple-wash text-papi-purple border-papi-purple/30",
    LOW: "bg-surface-3 text-ink-muted border-edge",
    CLOSED: "bg-surface-3 text-ink-faint border-edge line-through",
  };
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 font-display text-[11px] font-bold tracking-[0.14em] ${styles[priority] ?? styles.LOW}`}
    >
      {PRIORITY_DA[priority] ?? priority}
    </span>
  );
}

export function StatusPill({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "danger" | "muted" | "blue";
  children: ReactNode;
}) {
  const map = {
    ok: "text-ok border-ok/40 bg-ok/10",
    warn: "text-warn border-warn/40 bg-warn/10",
    danger: "text-stripe-red border-stripe-red/40 bg-stripe-red/10",
    blue: "text-papi-purple border-papi-purple/35 bg-papi-purple-wash",
    muted: "text-ink-muted border-edge bg-surface-3",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-display text-[11px] font-bold tracking-[0.12em] uppercase ${map[tone]}`}
    >
      {children}
    </span>
  );
}

export function RoleGlyph({
  role,
  className = "",
  size = 16,
}: {
  role: string;
  className?: string;
  size?: number;
}) {
  // The Dad Trinity in monochrome — shape carries the meaning, the caller
  // supplies the colour. Never colour alone.
  const Icon = ROLE_ICON[roleKey(role)];
  return <Icon size={size} monochrome className={`inline-block ${className}`} />;
}

export function CtaLink({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 font-display text-sm font-bold tracking-[0.1em] uppercase transition-colors";
  const styles = {
    primary: "bg-papi-indigo text-white hover:bg-papi-purple",
    secondary: "border-2 border-papi-indigo text-papi-indigo hover:bg-papi-purple-wash",
    ghost: "text-ink-muted hover:text-ink",
  } as const;
  return (
    <Link href={href} className={`${base} ${styles[variant]} ${className}`}>
      {children}
    </Link>
  );
}
