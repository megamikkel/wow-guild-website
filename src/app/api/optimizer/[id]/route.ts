import { NextResponse } from "next/server";

import { getJob } from "@/lib/simc/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Poll an optimization job: progress while running, result when done. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) {
    return NextResponse.json({ error: "Unknown optimization job." }, { status: 404 });
  }
  return NextResponse.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    result: job.result,
    error: job.error,
  });
}
