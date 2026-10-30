import { heardAsideFromPrompt, alphabetSpokenMatches, spokenFormsForLetter } from "./match.ts";
import { speechTokens } from "../sight-words/match.ts";

export const RECITE_PROMPT = "Your turn to say the alphabet.";
export const GOOD_JOB_LINE = "Good job!";

/** The celebration stays up this long after "Good job!" is shown. */
export const ALPHABET_CELEBRATION_MS = 5_000;

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export type ReciteState = { next: number };

/**
 * How far a recitation has moved.
 * `next` is the letter still needed, 0 for A through 26 when Z has been heard.
 */
export function reciteHear(
  state: ReciteState,
  transcript: string,
  say = RECITE_PROMPT,
): { next: number; accepted: string[]; status: string } {
  const aside = heardAsideFromPrompt(say, transcript);
  const tokens = speechTokens(aside);
  let next = Math.min(LETTERS.length, Math.max(0, Math.trunc(state.next) || 0));
  const accepted: string[] = [];
  let cursor = 0;
  while (cursor < tokens.length && next < LETTERS.length) {
    const letter = LETTERS[next] ?? "A";
    const consumed = consumeLetter(letter, tokens, cursor);
    if (consumed == null) {
      cursor += 1;
      continue;
    }
    accepted.push(letter);
    next += 1;
    cursor = consumed;
  }
  if (accepted.length > 0) return { next, accepted, status: `I heard: ${accepted.join(" ")}` };
  if (tokens.length === 0) return { next, accepted, status: "I didn't hear anything" };
  const spoken = tokens.join(" ");
  return { next, accepted, status: spoken ? `I heard: ${spoken}` : "I didn't hear anything" };
}

/** A letter name, including a multi-word alias, consumes that many tokens. Anything else is noise. */
function consumeLetter(letter: string, tokens: readonly string[], start: number): number | null {
  const forms = [letter, ...spokenFormsForLetter(letter)];
  const runs = forms
    .map((form) => speechTokens(form))
    .filter((run) => run.length > 0)
    .sort((left, right) => right.length - left.length);
  for (const run of runs) {
    if (start + run.length > tokens.length) continue;
    if (run.every((token, offset) => tokens[start + offset] === token)) return start + run.length;
  }
  const token = tokens[start] ?? "";
  if (token && alphabetSpokenMatches(letter, token, [])) return start + 1;
  return null;
}

/**
 * After Z, "Good job!" is spoken and shown, then the celebration runs.
 * `elapsedMs` is the time since the celebration itself started.
 */
export function celebrationFrame(elapsedMs: number): "celebrate" | "done" {
  const elapsed = Number.isFinite(elapsedMs) ? elapsedMs : 0;
  return elapsed >= ALPHABET_CELEBRATION_MS ? "done" : "celebrate";
}
