import type { SubjectId } from "@/lib/climb-rules";
import { moveVkoleRung } from "@/lib/vkole-cap";
import { singaporePlace } from "@/lib/vkole-singapore";

export const STEPS_IN_GRADE = 3;

const MATH: Record<number, readonly string[]> = {
  1: ["adding within 20", "subtracting within 20", "tens and ones"],
  2: ["adding within 100", "subtracting within 100", "hundreds, tens, and ones"],
  3: ["multiplication", "division", "unit fractions"],
  4: ["multiplying by one digit", "adding like fractions", "rounding"],
  5: ["decimal operations", "adding fractions", "volume"],
  6: ["ratios", "one-step equations", "positive and negative numbers"],
  7: ["proportional relationships", "equations with a coefficient", "probability"],
  8: ["the Pythagorean theorem", "slope", "exponents"],
  9: ["evaluating functions", "solving linear equations", "the mean"],
  10: ["evaluating functions", "solving linear equations", "the mean"],
  11: ["evaluating functions", "solving linear equations", "the mean"],
  12: ["evaluating functions", "solving linear equations", "the mean"],
};

const ELA: Record<number, readonly string[]> = {
  1: ["complete sentences", "plural nouns", "verbs"],
  2: ["capital letters", "adjectives", "contractions"],
  3: ["reading for a reason", "pronouns", "past-tense verbs"],
  4: ["inference", "prepositional phrases", "relative adverbs"],
  5: ["figurative language", "compound sentences", "word meaning in context"],
  6: ["evidence from a text", "intensive pronouns", "personification"],
  7: ["contrast in a sentence", "connotation", "dialogue punctuation"],
  8: ["evaluating an argument", "verbal phrases", "active voice"],
  9: ["author's purpose", "parallel structure", "theme"],
  10: ["author's purpose", "parallel structure", "theme"],
  11: ["author's purpose", "comparing texts", "theme"],
  12: ["author's purpose", "comparing texts", "theme"],
};

const SS: Record<number, readonly string[]> = {
  1: ["time order", "national symbols", "classroom citizenship"],
  2: ["landforms", "change over time", "producers and consumers"],
  3: ["local government", "map directions", "primary sources"],
  4: ["California's place", "the Gold Rush", "a state constitution"],
  5: ["the Declaration of Independence", "the Revolutionary War", "the Great Compromise"],
  6: ["river civilizations", "Athens", "historical maps"],
  7: ["trade routes", "the Magna Carta", "the Reformation"],
  8: ["separation of powers", "the Civil War", "Reconstruction"],
  9: ["the judicial branch", "elections", "opportunity cost"],
  10: ["the judicial branch", "federalism", "trade"],
  11: ["evidence in history", "federalism", "trade"],
  12: ["evidence in history", "federalism", "trade"],
};

const GEN: Record<number, readonly string[]> = {
  1: ["living things", "counting on", "classroom rules"],
  2: ["states of matter", "equal groups", "classroom rules"],
  3: ["states of matter", "equal groups", "a responsibility"],
  4: ["food chains", "equal groups", "a responsibility"],
  5: ["food chains", "number patterns", "a responsibility"],
  6: ["atoms", "number patterns", "checks and balances"],
  7: ["atoms", "number patterns", "checks and balances"],
  8: ["atoms", "number patterns", "checks and balances"],
  9: ["natural selection", "number patterns", "checks and balances"],
  10: ["natural selection", "number patterns", "checks and balances"],
  11: ["natural selection", "number patterns", "checks and balances"],
  12: ["natural selection", "number patterns", "checks and balances"],
};

const SW_STEP = ["sight words", "sight words", "sight words"] as const;

const SP_STEP = ["spelling", "spelling", "spelling"] as const;

const SP: Record<number, readonly string[]> = {
  1: SP_STEP,
  2: SP_STEP,
  3: SP_STEP,
  4: SP_STEP,
  5: SP_STEP,
  6: SP_STEP,
  7: SP_STEP,
  8: SP_STEP,
  9: SP_STEP,
  10: SP_STEP,
  11: SP_STEP,
  12: SP_STEP,
};

const SW: Record<number, readonly string[]> = {
  1: SW_STEP,
  2: SW_STEP,
  3: SW_STEP,
  4: SW_STEP,
  5: SW_STEP,
  6: SW_STEP,
  7: SW_STEP,
  8: SW_STEP,
  9: SW_STEP,
  10: SW_STEP,
  11: SW_STEP,
  12: SW_STEP,
};

const PA_STEP = ["phonemic awareness", "phonemic awareness", "phonemic awareness"] as const;

const PA: Record<number, readonly string[]> = {
  1: PA_STEP,
  2: PA_STEP,
  3: PA_STEP,
  4: PA_STEP,
  5: PA_STEP,
  6: PA_STEP,
  7: PA_STEP,
  8: PA_STEP,
  9: PA_STEP,
  10: PA_STEP,
  11: PA_STEP,
  12: PA_STEP,
};

const SG: Record<number, readonly string[]> = {
  1: ["concrete", "pictorial", "abstract"],
  2: ["concrete", "pictorial", "abstract"],
  3: ["concrete", "pictorial", "abstract"],
  4: ["concrete", "pictorial", "abstract"],
  5: ["concrete", "pictorial", "abstract"],
  6: ["concrete", "pictorial", "abstract"],
  7: ["concrete", "pictorial", "abstract"],
  8: ["concrete", "pictorial", "abstract"],
  9: ["concrete", "pictorial", "abstract"],
  10: ["concrete", "pictorial", "abstract"],
  11: ["concrete", "pictorial", "abstract"],
  12: ["concrete", "pictorial", "abstract"],
};

const LADDERS: Record<SubjectId, Record<number, readonly string[]>> = {
  m: MATH,
  ela: ELA,
  ss: SS,
  gen: GEN,
  sg: SG,
  sw: SW,
  sp: SP,
  pa: PA,
};

export function clampGrade(level: number): number {
  if (!Number.isFinite(level)) return 1;
  return Math.max(1, Math.round(level));
}

export function clampStep(step: number): number {
  if (!Number.isFinite(step)) return 0;
  return Math.min(STEPS_IN_GRADE - 1, Math.max(0, Math.round(step)));
}

export function stepName(subject: SubjectId, grade: number, step: number): string {
  const names = LADDERS[subject][Math.min(12, clampGrade(grade))];
  return names?.[clampStep(step)] ?? `step ${clampStep(step) + 1}`;
}

/** Two correct answers rise one standard. Two misses fall one standard. Grade 12, standard 3 stays. */
export function moveRung(input: {
  grade: number;
  step: number;
  correct: boolean;
  correctStreak: number;
  missStreak: number;
}): { grade: number; step: number; correctAtLevel: number; incorrectStreak: number; capped: boolean } {
  return moveVkoleRung(input);
}

export function stepSentence(
  subject: SubjectId,
  beforeGrade: number,
  beforeStep: number,
  moved: { grade: number; step: number; correctAtLevel: number; incorrectStreak: number; reached: boolean; capped?: boolean },
): string {
  const before = stepName(subject, beforeGrade, beforeStep);
  const after = stepName(subject, moved.grade, moved.step);
  if (moved.capped) return "Two correct answers in a row. Grade 12 is the top. The next questions stay on grade 12 and rotate.";
  if (subject === "sg" && moved.grade > beforeGrade) {
    return `Two correct answers on the abstract step. The level moves up to ${singaporePlace(moved.grade).short}.`;
  }
  if (moved.reached && moved.grade === 12 && moved.step === 2 && moved.correctAtLevel === 1) {
    return `Correct. One more on ${before}, then grade 12 stays and the questions rotate.`;
  }
  const rose = moved.grade > beforeGrade || (moved.grade === beforeGrade && moved.step > beforeStep);
  const fell = moved.grade < beforeGrade || (moved.grade === beforeGrade && moved.step < beforeStep);
  if (rose) return `Two correct answers in a row. The next question is one standard up: ${after}.`;
  if (fell) return `Two incorrect answers in a row. The next question is one standard down: ${after}.`;
  if (!moved.reached && moved.incorrectStreak === 0) return `Two incorrect answers in a row. This is the first standard, so it stays on ${before}.`;
  if (moved.reached) return `Correct. One more on ${before}, then it rises one standard.`;
  return `Not correct. That stays on ${before}. Miss ${moved.incorrectStreak} of 2.`;
}
