/**
 * Accepted pronunciations for alphabet letters A through Z.
 *
 * Each letter has an explicit list. A transcript counts only when it is one
 * of those forms after simple cleanup: lowercase, and punctuation turned into
 * spaces. There is no fuzzy match and no edit distance.
 *
 * A form belongs here only when it is a real way to say that letter, or a
 * speech-to-text rendering of one. The miss log does not add forms by itself.
 * Copy this file as-is. It does not import the rest of the app.
 */

export const LETTER_ALTERNATIVE_LIMIT = 5;

/**
 * Chrome reports confidence from 0 to 1, and uses 0 when it has no score.
 * A reported score above 0 and below this floor is not graded: the student
 * says the letter again. A missing score, or 0, skips this check.
 */
export const LETTER_CONFIDENCE_FLOOR = 0.2;

export const LETTER_PRONUNCIATIONS: Record<string, readonly string[]> = {
  A: ["a", "ay", "eh", "hey"],
  B: ["b", "bee", "be"],
  C: ["c", "see", "sea", "cee"],
  D: ["d", "dee", "de", "di", "the"],
  E: ["e", "ee"],
  F: ["f", "ef", "eff"],
  G: ["g", "gee", "jee"],
  H: ["h", "aitch", "haitch"],
  I: ["i", "eye", "aye"],
  J: ["j", "jay"],
  K: ["k", "kay"],
  L: ["l", "el", "ell"],
  M: ["m", "em", "emm", "um", "im", "am", "them", "him"],
  N: ["n", "en", "enn", "in", "and", "an", "end"],
  O: ["o", "oh"],
  P: ["p", "pee", "pea"],
  Q: ["q", "cue", "queue", "kyu", "kew", "cute", "que"],
  R: ["r", "ar", "are", "our"],
  S: ["s", "ess"],
  T: ["t", "tee", "tea"],
  U: ["u", "you", "yoo"],
  V: ["v", "vee"],
  W: ["w", "doubleyou", "double you", "double u"],
  X: ["x", "ex"],
  Y: ["y", "why", "wye"],
  Z: ["z", "zee", "zed"],
};

export type HeardAlternative = {
  transcript?: string;
  confidence?: number | null;
  final?: boolean;
};

export type LetterJudgment = "correct" | "miss" | "again" | "wait";

/** Lowercase, drop punctuation, and keep words apart. This is not a spelling guess. */
export function normalizePronunciation(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, " ")
    .replace(/-/g, " ")
    .replace(/'/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function acceptedFormsForLetter(letter: string): readonly string[] {
  const key = letter.trim().toUpperCase();
  return LETTER_PRONUNCIATIONS[key] ?? [];
}

function tokensOf(value: string): string[] {
  const clean = normalizePronunciation(value);
  return clean ? clean.split(" ") : [];
}

function hasRun(heard: readonly string[], target: readonly string[]): boolean {
  if (target.length === 0 || heard.length < target.length) return false;
  for (let i = 0; i + target.length <= heard.length; i += 1) {
    if (target.every((token, offset) => heard[i + offset] === token)) return true;
  }
  return false;
}

/** True only when the transcript is an accepted form for this letter. */
export function pronunciationMatches(letter: string, heard: string): boolean {
  const heardTokens = tokensOf(heard);
  if (heardTokens.length === 0) return false;
  for (const form of acceptedFormsForLetter(letter)) {
    const target = tokensOf(form);
    if (target.length === 1) {
      if (heardTokens.includes(target[0] ?? "")) return true;
      continue;
    }
    if (hasRun(heardTokens, target)) return true;
  }
  return false;
}

/**
 * A reported confidence the engine can trust.
 * 0 and anything that is not a real number mean "not reported".
 */
export function reportedConfidence(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  if (value > 1) return null;
  return value;
}

function confidenceIsLow(value: number | null | undefined): boolean {
  const score = reportedConfidence(value);
  return score !== null && score < LETTER_CONFIDENCE_FLOOR;
}

/**
 * Look at the top alternatives only.
 * One accepted form, with a usable confidence, is correct.
 * A very low reported confidence is not scored.
 */
export function judgeLetterHear(letter: string, alternatives: readonly HeardAlternative[]): LetterJudgment {
  const top = alternatives.slice(0, LETTER_ALTERNATIVE_LIMIT);
  let sawWords = false;
  let lowWords = false;
  let lowMatch = false;
  let trustedMiss = false;
  for (const alternative of top) {
    const tokens = tokensOf(alternative.transcript ?? "");
    if (tokens.length === 0) continue;
    sawWords = true;
    const low = confidenceIsLow(alternative.confidence);
    if (pronunciationMatches(letter, alternative.transcript ?? "")) {
      if (low) {
        lowMatch = true;
        continue;
      }
      return "correct";
    }
    if (!alternative.final) continue;
    if (low) lowWords = true;
    else trustedMiss = true;
  }
  if (!sawWords) return "wait";
  // A real match that the engine itself marks as very unsure is not scored.
  if (lowMatch) return "again";
  if (trustedMiss) return "miss";
  if (lowWords) return "again";
  return "wait";
}
