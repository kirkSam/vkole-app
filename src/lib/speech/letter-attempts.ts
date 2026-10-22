/**
 * First-try counts and the teacher's miss list for alphabet speech.
 * Copy this file with letter-pronunciations.ts. It does not import the app.
 * The miss list is counts of heard words. It never adds a pronunciation.
 */

import { normalizePronunciation } from "./letter-pronunciations.ts";

export type LetterAttemptOutcome = "correct" | "miss" | "timeout" | "again";

export type LetterAttempt = {
  letter: string;
  exercise: number;
  outcome: LetterAttemptOutcome;
  heard: string[];
};

export type LetterMissTotal = {
  letter: string;
  heard: string;
  count: number;
};

const OUTCOMES = new Set<LetterAttemptOutcome>(["correct", "miss", "timeout", "again"]);

function joinLetters(letters: readonly string[]): string {
  if (letters.length === 0) return "";
  if (letters.length === 1) return letters[0] ?? "";
  if (letters.length === 2) return `${letters[0]} and ${letters[1]}`;
  return `${letters.slice(0, -1).join(", ")}, and ${letters[letters.length - 1]}`;
}

/** Read one saved attempt. A row without the attempt mark is ignored. Student ids are not returned. */
export function readLetterAttempt(detail: string): LetterAttempt | null {
  let row: { attempt?: unknown; letter?: unknown; exercise?: unknown; outcome?: unknown; heard?: unknown } | null = null;
  try {
    const parsed = JSON.parse(detail) as { attempt?: unknown; letter?: unknown; exercise?: unknown; outcome?: unknown; heard?: unknown };
    if (parsed && typeof parsed === "object") row = parsed;
  } catch {
    return null;
  }
  if (!row || row.attempt !== true) return null;
  const letter = typeof row.letter === "string" ? row.letter.trim().toUpperCase() : "";
  const exercise = Number(row.exercise);
  const outcome = typeof row.outcome === "string" ? row.outcome : "";
  if (!/^[A-Z]$/.test(letter) || !Number.isInteger(exercise) || exercise < 2 || exercise > 5) return null;
  if (!OUTCOMES.has(outcome as LetterAttemptOutcome)) return null;
  const heard: string[] = [];
  if (Array.isArray(row.heard)) {
    for (const item of row.heard) {
      const text = typeof item === "string" ? item : typeof item === "object" && item && "transcript" in item ? String((item as { transcript?: unknown }).transcript ?? "") : "";
      const clean = normalizePronunciation(text);
      if (clean) heard.push(clean);
    }
  }
  return { letter, exercise, outcome: outcome as LetterAttemptOutcome, heard };
}

export function letterAttemptsFromDetails(details: readonly string[]): LetterAttempt[] {
  const attempts: LetterAttempt[] = [];
  for (const detail of details) {
    const attempt = readLetterAttempt(detail);
    if (attempt) attempts.push(attempt);
  }
  return attempts;
}

/**
 * How many letters were right the first time they were asked.
 * A miss, a silence, or a low-confidence re-ask means that letter needed another try.
 */
export function alphabetFirstTryReport(attempts: readonly Pick<LetterAttempt, "letter" | "outcome">[]): {
  asked: number;
  firstTry: number;
  retries: string[];
  text: string;
} {
  const order: string[] = [];
  const first = new Map<string, LetterAttemptOutcome>();
  for (const attempt of attempts) {
    const letter = attempt.letter.trim().toUpperCase();
    if (!/^[A-Z]$/.test(letter) || !OUTCOMES.has(attempt.outcome)) continue;
    if (first.has(letter)) continue;
    order.push(letter);
    first.set(letter, attempt.outcome);
  }
  const asked = order.length;
  if (asked === 0) return { asked: 0, firstTry: 0, retries: [], text: "" };
  const retries = order.filter((letter) => first.get(letter) !== "correct");
  const firstTry = asked - retries.length;
  const noun = firstTry === 1 ? "letter was" : "letters were";
  const count = `${firstTry} of ${asked} ${noun} right on the first try.`;
  const rest = retries.length === 0 ? "Every letter was right on the first try." : `These letters needed another try: ${joinLetters(retries)}.`;
  return { asked, firstTry, retries, text: `${count} ${rest}` };
}

/** Counts of heard words for letters that were not scored. No names and no student ids. */
export function aggregateLetterMisses(samples: readonly { letter: string; transcript: string }[], perLetter = 8): LetterMissTotal[] {
  const counts = new Map<string, Map<string, number>>();
  for (const sample of samples) {
    const letter = sample.letter.trim().toUpperCase();
    const heard = normalizePronunciation(sample.transcript) || "silence";
    if (!/^[A-Z]$/.test(letter)) continue;
    const bucket = counts.get(letter) ?? new Map<string, number>();
    bucket.set(heard, (bucket.get(heard) ?? 0) + 1);
    counts.set(letter, bucket);
  }
  const rows: LetterMissTotal[] = [];
  for (const letter of [...counts.keys()].sort()) {
    const bucket = counts.get(letter) ?? new Map<string, number>();
    const ranked = [...bucket.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
    for (const [heard, count] of ranked.slice(0, Math.max(1, perLetter))) {
      rows.push({ letter, heard, count });
    }
  }
  return rows;
}

export function missSamplesFromDetails(details: readonly string[]): { letter: string; transcript: string }[] {
  const samples: { letter: string; transcript: string }[] = [];
  for (const detail of details) {
    const attempt = readLetterAttempt(detail);
    if (!attempt || attempt.outcome === "correct") continue;
    const heard = attempt.heard.length > 0 ? attempt.heard : ["silence"];
    for (const transcript of heard) samples.push({ letter: attempt.letter, transcript });
  }
  return samples;
}
