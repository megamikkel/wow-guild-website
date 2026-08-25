"use client";

import { useEffect, useState } from "react";

import { countdownParts, pad2 } from "@/lib/format";

/**
 * Live raid countdown. Server renders a stable value (suppressed hydration
 * diff), the client ticks it every second. Falls back gracefully without JS.
 */
export function Countdown({ target, className = "" }: { target: string; className?: string }) {
  const targetDate = new Date(target);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { days, hours, minutes, seconds } = countdownParts(targetDate, now ?? new Date(0));
  const live = now !== null && targetDate.getTime() - now.getTime() <= 0;

  if (live) {
    return (
      <span className={`inline-flex items-center gap-2 ${className}`}>
        <span className="live-dot" aria-hidden />
        <span className="stat-oversized text-stripe-red">RAIDET ER I GANG</span>
      </span>
    );
  }

  return (
    <span
      suppressHydrationWarning
      className={`stat-oversized font-mono tabular-nums ${className}`}
      aria-label={`Starts in ${days} days ${hours} hours ${minutes} minutes`}
    >
      {now === null ? "—" : `${pad2(days)}d ${pad2(hours)}h ${pad2(minutes)}m ${pad2(seconds)}s`}
    </span>
  );
}
