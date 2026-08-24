import { env } from "@/lib/env";

/**
 * Outbound Discord notifications via webhook — no bot, no gateway
 * connection. Fire-and-forget with one retry; a Discord outage must never
 * break a user-facing flow, so failures are logged and swallowed.
 */

export type DiscordNotification = {
  title: string;
  description?: string;
  /** Decimal color. Defaults to PAPI blue. */
  color?: number;
  url?: string;
};

const PAPI_BLUE = 0x397cef;
export const PAPI_RED = 0xe13527;

export async function notifyDiscord(notification: DiscordNotification): Promise<boolean> {
  const webhookUrl = env.discord.webhookUrl;
  if (!webhookUrl) {
    if (env.isDemoMode) {
      console.info(`[discord:demo] ${notification.title}`);
      return true;
    }
    return false;
  }

  const payload = {
    username: "PAPI",
    embeds: [
      {
        title: notification.title,
        description: notification.description,
        color: notification.color ?? PAPI_BLUE,
        url: notification.url,
        timestamp: new Date().toISOString(),
      },
    ],
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) return true;
      if (res.status === 429) {
        const body = (await res.json().catch(() => null)) as { retry_after?: number } | null;
        await new Promise((r) => setTimeout(r, ((body?.retry_after ?? 1) + 0.2) * 1000));
        continue;
      }
      console.error(`[discord] webhook failed: ${res.status}`);
      return false;
    } catch (err) {
      console.error("[discord] webhook error", err);
    }
  }
  return false;
}
