import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { findEngine } from "@/lib/simc/engine";
import { startJob } from "@/lib/simc/jobs";
import { OptimizerError } from "@/lib/simc/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  input: z.string().min(1, "SimC input is required"),
  mode: z.enum(["single_target", "aoe"]),
  settings: z
    .object({
      targets: z.number().int().min(1).max(30).optional(),
      durationSeconds: z.number().int().min(30).max(900).optional(),
      screeningIterations: z.number().int().min(100).max(100_000).optional(),
      evaluationIterations: z.number().int().min(100).max(100_000).optional(),
      verificationIterations: z.number().int().min(100).max(500_000).optional(),
      threads: z.number().int().min(0).max(256).optional(),
      maxCombinations: z.number().int().min(1).max(5_000).optional(),
      verifyTop: z.number().int().min(1).max(50).optional(),
    })
    .optional(),
});

/** Start a gear optimization. Returns a job id the client polls. */
export async function POST(request: NextRequest) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  // Fail loudly before starting a job when the engine is missing: an
  // optimization without SimulationCraft is not something this tool
  // approximates.
  try {
    await findEngine();
  } catch (err) {
    if (err instanceof OptimizerError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 503 });
    }
    throw err;
  }

  const job = startJob(parsed.data);
  return NextResponse.json({ id: job.id, status: job.status, progress: job.progress });
}
