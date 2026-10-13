/** A parent gate, not a password. It is not stored. */
export const PARENT_GATE_MATH = "17 × 4 − 8";
export const PARENT_GATE_WORD = "parent";
const MATH_ANSWER = "60";

export function parentGatePasses(mathAnswer: string, word: string): boolean {
  return mathAnswer.trim() === MATH_ANSWER && word.trim().toLowerCase() === PARENT_GATE_WORD;
}

export const PARENT_GATE_MS = 5 * 60 * 1000;

export function gateStillOpen(grantedAt: number | null, now: number): boolean {
  if (grantedAt == null) return false;
  return now - grantedAt >= 0 && now - grantedAt < PARENT_GATE_MS;
}
