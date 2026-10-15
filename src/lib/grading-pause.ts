/** Grading calls that never come back, counted in a row for one child. */
export const GRADING_FAILURE_CAP = 3;

export const GRADING_PAUSE_MESSAGE = "Take a break and come back later. Your level stays the same.";

export type SettledGrade =
  | { action: "again"; failures: number }
  | { action: "rest"; failures: number }
  | { action: "score"; correct: boolean };

function storedFailures(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

/**
 * A grading call that never comes back asks the child to try again.
 * The third failure in a row stops that ask.
 * A reply that comes back is a grade: an unreadable one is marked incorrect.
 * Either grade clears the failure count at the call site.
 */
export function settleGradingCall(
  outcome: "graded" | "absent" | "unreadable",
  correct: boolean | null,
  previousFailures: number,
): SettledGrade {
  if (outcome === "absent") {
    const failures = storedFailures(previousFailures) + 1;
    return { action: failures >= GRADING_FAILURE_CAP ? "rest" : "again", failures };
  }
  return { action: "score", correct: outcome === "unreadable" ? false : correct === true };
}
