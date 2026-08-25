"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { applicationSchema } from "@/domain/application-schema";
import { notifyDiscord, PAPI_RED } from "@/integrations/discord/notify";
import { getDb, tables } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { specRole } from "@/lib/wow";

export type ApplyFormState = {
  ok: boolean;
  errors?: Record<string, string>;
  message?: string;
};

export async function submitApplication(
  _prev: ApplyFormState,
  formData: FormData,
): Promise<ApplyFormState> {
  const hdrs = await headers();
  const ip = (hdrs.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  const limited = rateLimit(`apply:${ip}`, { limit: 3, windowMs: 15 * 60_000 });
  if (!limited.ok) {
    return {
      ok: false,
      message: `Easy there. Try again in ${Math.ceil(limited.retryAfterSec / 60)} minutes.`,
    };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = applicationSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!errors[key]) errors[key] = issue.message;
    }
    return { ok: false, errors, message: "A few fields need another look." };
  }
  const data = parsed.data;

  // Honeypot tripped: pretend success, store nothing.
  if (raw.website && String(raw.website).length > 0) {
    redirect("/apply/success");
  }

  const db = await getDb();
  const [application] = await db
    .insert(tables.applications)
    .values({
      discordName: data.discordName,
      characterName: data.characterName,
      realm: data.realm,
      className: data.className,
      specName: data.specName,
      altSpecs: data.altSpecs || null,
      role: specRole(data.className, data.specName),
      warcraftLogsUrl: data.warcraftLogsUrl || null,
      raiderIoUrl: data.raiderIoUrl || null,
      previousGuild: data.previousGuild || null,
      raidExperience: data.raidExperience,
      availability: data.availability,
      expectations: data.expectations || null,
      whyPapi: data.whyPapi,
      comment: data.comment || null,
      status: "NEW",
    })
    .returning();

  await db.insert(tables.activityEvents).values({
    kind: "recruitment",
    title: `New application: ${data.specName} ${data.className}`,
    detail: `${data.characterName} — ${data.realm}`,
    source: "papi",
    occurredAt: new Date(),
  });

  // Officers hear about it in Discord; failure here never blocks the applicant.
  await notifyDiscord({
    title: `New application — ${data.specName} ${data.className}`,
    description: `**${data.characterName}** (${data.realm}) applied to PAPI.`,
    color: PAPI_RED,
  });

  redirect(`/apply/success?id=${application.id}`);
}
