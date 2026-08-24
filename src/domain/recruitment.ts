/** Recruitment pipeline rules — shared by server actions, UI and tests. */

export const APPLICATION_STATUSES = [
  "NEW",
  "REVIEW",
  "INTERVIEW",
  "TRIAL",
  "ACCEPTED",
  "DECLINED",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** Legal transitions in the recruitment pipeline. */
export const TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  NEW: ["REVIEW", "DECLINED"],
  REVIEW: ["INTERVIEW", "DECLINED"],
  INTERVIEW: ["TRIAL", "DECLINED"],
  TRIAL: ["ACCEPTED", "DECLINED"],
  ACCEPTED: [],
  DECLINED: ["REVIEW"],
};

export function canTransition(from: string, to: string): boolean {
  return (TRANSITIONS[from as ApplicationStatus] ?? []).includes(to as ApplicationStatus);
}
