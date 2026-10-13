/**
 * VKOLE grade cap.
 * 1. The grade number stops at 12. Two correct answers on grade 12, standard 3 stay there.
 * 2. When capped is true, rotate the grade 12 questions. Do not open grade 13.
 */
export const VKOLE_TOP_GRADE = 12;

export function capVkoleGrade(grade: number): number {
  const level = Math.round(grade);
  if (!Number.isFinite(level)) return 1;
  return Math.min(VKOLE_TOP_GRADE, Math.max(1, level));
}

export function moveVkoleRung(input: {
  grade: number;
  step: number;
  correct: boolean;
  correctStreak: number;
  missStreak: number;
}): { grade: number; step: number; correctAtLevel: number; incorrectStreak: number; capped: boolean } {
  let grade = capVkoleGrade(input.grade);
  let step = Math.min(2, Math.max(0, Math.round(input.step)));
  let correctAtLevel = input.correct ? input.correctStreak + 1 : 0;
  let incorrectStreak = input.correct ? 0 : input.missStreak + 1;
  let capped = false;
  if (input.correct && correctAtLevel >= 2) {
    correctAtLevel = 0;
    incorrectStreak = 0;
    if (step < 2) step += 1;
    else if (grade < VKOLE_TOP_GRADE) {
      grade += 1;
      step = 0;
    } else capped = true;
  } else if (!input.correct && incorrectStreak >= 2) {
    correctAtLevel = 0;
    incorrectStreak = 0;
    if (step > 0) step -= 1;
    else if (grade > 1) {
      grade -= 1;
      step = 2;
    }
  }
  return { grade, step, correctAtLevel, incorrectStreak, capped };
}

export function rotateQuestions<T extends { prompt: string }>(
  items: T[],
  seed: number,
  seenKeys: Set<string>,
  keyOf: (prompt: string) => string,
): T | null {
  if (!items.length) return null;
  const fresh = items.filter((item) => !seenKeys.has(keyOf(item.prompt)));
  const pool = fresh.length ? fresh : items;
  return pool[Math.abs(seed) % pool.length] ?? null;
}
