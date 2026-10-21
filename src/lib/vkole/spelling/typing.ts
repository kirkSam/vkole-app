import { alphabet } from "./items.ts";

/** Shown and spoken when the typed key is a different letter, or when 5 seconds pass with no correct key. */
export const TYPING_TRY_AGAIN = "Try again";

/** Shown and spoken when the letter is right and a capital was needed. */
export const TYPING_CAPITAL_LINE = "Use a capital letter. Hold Shift or press Caps Lock.";

/** Shown and spoken when the letter is right and a small letter was needed. */
export const TYPING_SMALL_LINE = "Use a small letter. Let go of Shift or turn off Caps Lock.";

/** How long exercise 6 waits for the correct key before it asks again. */
export const TYPING_WAIT_MS = 5000;

export type TypingCase = "upper" | "lower";

export type TypingPlace = {
  index: number;
  letterCase: TypingCase;
};

/** Exercise 6 starts on capital A. Small letters come after Z. */
export function typingStart(): TypingPlace {
  return { index: 0, letterCase: "upper" };
}

/** The letter on the card. Part A is A–Z. Part B is a–z. */
export function typingShown(place: TypingPlace): string {
  const letters = alphabet();
  const index = Math.min(letters.length - 1, Math.max(0, Math.trunc(place.index) || 0));
  const upper = letters[index] ?? "A";
  return place.letterCase === "lower" ? upper.toLowerCase() : upper;
}

/** The reminder for a right letter in the wrong case. A capital card and a small-letter card use different lines. */
export function typingCaseLine(shown: string): string {
  return /^[A-Z]$/.test(shown.trim()) ? TYPING_CAPITAL_LINE : TYPING_SMALL_LINE;
}

export type TypingJudgment = "correct" | "wrong" | "case" | "ignore";

/**
 * One typed key. The case has to match the letter on the card.
 * A capital card accepts only the capital key. A small-letter card accepts only the small key.
 * The same letter in the other case is `case` and stays on this letter.
 * An empty field is ignored. A different letter is wrong.
 */
export function judgeTypingKey(shown: string, raw: string): TypingJudgment {
  const chars = [...raw].filter((char) => char.trim() !== "");
  const key = chars[chars.length - 1] ?? "";
  if (!key) return "ignore";
  const want = shown.trim();
  if (key === want) return "correct";
  if (key.toLowerCase() === want.toLowerCase() && key.toLowerCase() !== key.toUpperCase()) return "case";
  return "wrong";
}

/** The next card after a correct key. Lowercase z finishes exercise 6. */
export function advanceTyping(place: TypingPlace): { place: TypingPlace; done: boolean } {
  const last = alphabet().length - 1;
  if (place.index < last) return { place: { index: place.index + 1, letterCase: place.letterCase }, done: false };
  if (place.letterCase === "upper") return { place: { index: 0, letterCase: "lower" }, done: false };
  return { place: { index: last, letterCase: "lower" }, done: true };
}
