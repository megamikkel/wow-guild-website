"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { APPLICATION_STATUSES, canTransition } from "@/domain/recruitment";
import { notifyDiscord } from "@/integrations/discord/notify";
import { requireRole } from "@/lib/auth";
import { getDb, tables } from "@/lib/db";

async function audit(actorId: number | undefined, actorName: string, action: string, target: string) {
  const db = await getDb();
  await db.insert(tables.auditLogs).values({ actorId, actorName, action, target });
}

export async function updateApplicationStatus(formData: FormData) {
  const session = await requireRole("OFFICER");
  const input = z
    .object({ id: z.coerce.number().int().positive(), status: z.enum(APPLICATION_STATUSES) })
    .parse({ id: formData.get("id"), status: formData.get("status") });

  const db = await getDb();
  const [app] = await db
    .select()
    .from(tables.applications)
    .where(eq(tables.applications.id, input.id))
    .limit(1);
  if (!app) throw new Error("Application not found");
  if (!canTransition(app.status, input.status)) {
    throw new Error(`Illegal transition ${app.status} → ${input.status}`);
  }

  await db
    .update(tables.applications)
    .set({
      status: input.status,
      reviewerId: session.user.dbUserId ?? app.reviewerId,
      updatedAt: new Date(),
    })
    .where(eq(tables.applications.id, input.id));

  await audit(
    session.user.dbUserId,
    session.user.name ?? "officer",
    `application.status:${app.status}->${input.status}`,
    `application:${input.id}`,
  );

  if (input.status === "TRIAL") {
    await db.insert(tables.trials).values({
      applicationId: app.id,
      characterName: app.characterName,
      startDate: new Date(),
      expectedEndDate: new Date(Date.now() + 28 * 86_400_000),
      status: "ACTIVE",
    });
    await db.insert(tables.activityEvents).values({
      kind: "roster",
      title: `${app.characterName} starts their trial`,
      detail: `${app.specName} ${app.className}`,
      source: "papi",
      occurredAt: new Date(),
    });
    await notifyDiscord({
      title: `Trial started — ${app.characterName}`,
      description: `${app.specName} ${app.className} moves to trial. Four weeks on the clock.`,
    });
  }
  if (input.status === "ACCEPTED") {
    await db.insert(tables.activityEvents).values({
      kind: "roster",
      title: `${app.characterName} joined the roster`,
      detail: `${app.specName} ${app.className}`,
      source: "papi",
      occurredAt: new Date(),
    });
    await notifyDiscord({
      title: `New member — ${app.characterName}`,
      description: `${app.specName} ${app.className} is now a full member of PAPI.`,
    });
  }

  revalidatePath("/admin/applications");
  revalidatePath(`/admin/applications/${input.id}`);
  revalidatePath("/admin");
}

export async function addApplicationNote(formData: FormData) {
  const session = await requireRole("OFFICER");
  const input = z
    .object({
      id: z.coerce.number().int().positive(),
      body: z.string().trim().min(1).max(2000),
    })
    .parse({ id: formData.get("id"), body: formData.get("body") });

  const db = await getDb();
  await db.insert(tables.applicationNotes).values({
    applicationId: input.id,
    authorId: session.user.dbUserId,
    authorName: session.user.name ?? "officer",
    body: input.body,
  });
  await audit(
    session.user.dbUserId,
    session.user.name ?? "officer",
    "application.note",
    `application:${input.id}`,
  );
  revalidatePath(`/admin/applications/${input.id}`);
}
