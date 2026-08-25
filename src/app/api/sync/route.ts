import { NextResponse, type NextRequest } from "next/server";

import { runSync } from "@/integrations/sync";
import { env } from "@/lib/env";

export const maxDuration = 300;

/**
 * Background sync trigger. Called by the scheduled GitHub Action (or any
 * cron) with `Authorization: Bearer $PAPI_SYNC_SECRET`. Vercel Hobby cron
 * only allows daily runs, so an external scheduler drives freshness.
 */
export async function POST(request: NextRequest) {
  const secret = env.syncSecret;
  if (!secret) {
    return NextResponse.json({ error: "sync disabled: PAPI_SYNC_SECRET not set" }, { status: 503 });
  }
  const header = request.headers.get("authorization") ?? "";
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const only = url.searchParams.getAll("integration");
  const results = await runSync(only);
  const ok = results.every((r) => r.ok);
  return NextResponse.json({ ok, results }, { status: ok ? 200 : 502 });
}
