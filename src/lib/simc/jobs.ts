import { randomUUID } from "node:crypto";

import { optimizeGear } from "./optimizer";
import {
  type JobProgress,
  OptimizerError,
  type OptimizerJob,
  type SimMode,
  type SimSettings,
} from "./types";

/**
 * In-process job registry.
 *
 * An optimization runs for minutes, far longer than a request should be
 * held open, so the route starts a job and the client polls it. A single
 * long-running Node server is assumed; the registry evicts finished jobs
 * after an hour.
 */

const JOB_TTL_MS = 60 * 60 * 1000;
const jobs = new Map<string, OptimizerJob>();

function evictStale() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (job.status !== "running" && now - job.progress.updatedAt > JOB_TTL_MS) {
      jobs.delete(id);
    }
  }
}

function initialProgress(): JobProgress {
  const now = Date.now();
  return {
    phase: "parsing",
    message: "Parsing SimC input…",
    done: 0,
    total: 0,
    itemsDetected: 0,
    candidatesPlanned: 0,
    candidatesTested: 0,
    startedAt: now,
    updatedAt: now,
  };
}

export interface StartJobInput {
  input: string;
  mode: SimMode;
  settings?: Partial<SimSettings>;
}

export function startJob(request: StartJobInput): OptimizerJob {
  evictStale();
  const id = randomUUID();
  const job: OptimizerJob = {
    id,
    status: "running",
    progress: initialProgress(),
    result: null,
    error: null,
  };
  jobs.set(id, job);

  void optimizeGear({
    input: request.input,
    mode: request.mode,
    settings: request.settings,
    onProgress: (partial) => {
      job.progress = { ...job.progress, ...partial, updatedAt: Date.now() };
    },
  })
    .then((result) => {
      job.result = result;
      job.status = "done";
      job.progress = {
        ...job.progress,
        phase: "done",
        message: "Complete",
        updatedAt: Date.now(),
      };
    })
    .catch((err: unknown) => {
      job.status = "error";
      job.error =
        err instanceof OptimizerError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unknown error while optimizing gear.";
      job.progress = {
        ...job.progress,
        phase: "error",
        message: job.error,
        updatedAt: Date.now(),
      };
    });

  return job;
}

export function getJob(id: string): OptimizerJob | null {
  return jobs.get(id) ?? null;
}
