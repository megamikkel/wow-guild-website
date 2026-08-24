import { guildConfig } from "@/config/guild";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "short",
  timeZone: guildConfig.timezone,
});
const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: guildConfig.timezone,
});
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: guildConfig.timezone,
});

export const formatDate = (d: Date) => dateFmt.format(d);
export const formatTime = (d: Date) => timeFmt.format(d);
export const formatDateTime = (d: Date) => dateTimeFmt.format(d);

export function formatRelative(d: Date, now = new Date()): string {
  const diffMs = now.getTime() - d.getTime();
  const future = diffMs < 0;
  const abs = Math.abs(diffMs);
  const mins = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);
  let core: string;
  if (mins < 1) core = "just now";
  else if (mins < 60) core = `${mins} min`;
  else if (hours < 24) core = `${hours}h`;
  else if (days === 1) core = future ? "tomorrow" : "yesterday";
  else core = `${days}d`;
  if (core === "just now" || core === "tomorrow" || core === "yesterday") return core;
  return future ? `in ${core}` : `${core} ago`;
}

/** "01d 04h 31m" style countdown parts. */
export function countdownParts(target: Date, now = new Date()) {
  let remaining = Math.max(0, target.getTime() - now.getTime());
  const days = Math.floor(remaining / 86_400_000);
  remaining -= days * 86_400_000;
  const hours = Math.floor(remaining / 3_600_000);
  remaining -= hours * 3_600_000;
  const minutes = Math.floor(remaining / 60_000);
  remaining -= minutes * 60_000;
  const seconds = Math.floor(remaining / 1_000);
  return { days, hours, minutes, seconds };
}

export const pad2 = (n: number) => String(n).padStart(2, "0");
