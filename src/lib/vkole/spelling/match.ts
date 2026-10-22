import { acceptedFormsForLetter, judgeLetterHear, type HeardAlternative, type LetterJudgment } from "../../speech/letter-pronunciations.ts";
import { compactSpeech, speechTokens, spokenMatches } from "../sight-words/match.ts";

/**
 * Lenient spoken-letter matcher. It uses the sight-word tokenizer:
 * case, extra words, and a finished non-match follow that matcher.
 * A single-word alias matches as a token. A multi-word alias, such as
 * "double you", matches only as those words in a row, so a short piece
 * of it does not count as the whole letter.
 * Letter names come from the shared pronunciation list, including when an
 * item's own also-list is missing one of them.
 */

/** Spoken names for a letter, from the shared pronunciation list. */
export function spokenFormsForLetter(answer: string): readonly string[] {
  return acceptedFormsForLetter(answer);
}

function aliasList(answer: string, also: readonly string[]): string[] {
  return [...also, ...spokenFormsForLetter(answer)];
}

function hasRun(heard: readonly string[], target: readonly string[]): boolean {
  for (let i = 0; i + target.length <= heard.length; i += 1) {
    if (target.every((token, offset) => heard[i + offset] === token)) return true;
  }
  return false;
}

function withoutRun(tokens: readonly string[], run: readonly string[]): string[] {
  if (run.length === 0) return [...tokens];
  for (let i = 0; i + run.length <= tokens.length; i += 1) {
    if (run.every((token, offset) => tokens[i + offset] === token)) {
      return [...tokens.slice(0, i), ...tokens.slice(i + run.length)];
    }
  }
  return [...tokens];
}

/** Drop a leading tail of the prompt, then a trailing head, so an early mic does not score the question. */
function withoutPromptEdges(tokens: readonly string[], prompt: readonly string[]): string[] {
  let cut = 0;
  const max = Math.min(tokens.length, prompt.length);
  for (let length = max; length > 0; length -= 1) {
    const suffix = prompt.slice(prompt.length - length);
    if (suffix.every((token, index) => tokens[index] === token)) {
      cut = length;
      break;
    }
  }
  const rest = tokens.slice(cut);
  let end = rest.length;
  const maxEnd = Math.min(rest.length, prompt.length);
  for (let length = maxEnd; length > 0; length -= 1) {
    const prefix = prompt.slice(0, length);
    const start = rest.length - length;
    if (prefix.every((token, index) => rest[start + index] === token)) {
      end = start;
      break;
    }
  }
  return rest.slice(0, end);
}

/**
 * Words left after the engine's own prompt is removed once.
 * A transcript that is only the prompt comes back empty, so it waits instead of missing.
 * The letter named inside the prompt is not treated as the child's answer.
 */
export function heardAsideFromPrompt(say: string, heard: string): string {
  const prompt = speechTokens(say);
  const tokens = speechTokens(heard);
  if (prompt.length === 0 || tokens.length === 0) return tokens.join(" ");
  return withoutPromptEdges(withoutRun(tokens, prompt), prompt).join(" ");
}

export function spellingSpokenMatches(answer: string, heard: string, also: readonly string[] = []): boolean {
  const forms = aliasList(answer, also);
  const singles = forms.filter((alias) => speechTokens(alias).length <= 1);
  if (spokenMatches(answer, heard, singles)) return true;
  const heardTokens = speechTokens(heard);
  for (const alias of forms) {
    const tokens = speechTokens(alias);
    if (tokens.length < 2) continue;
    if (hasRun(heardTokens, tokens)) return true;
    const compact = compactSpeech(alias);
    if (compact && heardTokens.includes(compact)) return true;
  }
  return false;
}

/**
 * An empty or punctuation-only transcript waits. It is not a miss.
 * A transcript that is only the spoken prompt also waits: the microphone heard the question, not the child.
 * A live non-match waits. Only a finished transcript that still has real words and does not match is a miss.
 */
export function judgeSpellingSpoken(
  answer: string,
  heard: string,
  final: boolean,
  also: readonly string[] = [],
  say = "",
): "correct" | "miss" | "wait" {
  const aside = heardAsideFromPrompt(say, heard);
  if (speechTokens(aside).length === 0) return "wait";
  if (spellingSpokenMatches(answer, aside, also)) return "correct";
  return final ? "miss" : "wait";
}

/**
 * Any alternative that names the letter is correct, even when a higher-ranked guess is wrong.
 * A result counts as a miss only when it is finished, some alternative has real words, and none match.
 * Confidence and length are not inputs. A one-letter transcript is a real answer.
 */
export function judgeSpellingAlternatives(
  answer: string,
  alternatives: readonly { transcript?: string; final?: boolean; confidence?: number | null }[],
  also: readonly string[] = [],
  say = "",
): LetterJudgment {
  const prepared: HeardAlternative[] = alternatives.map((alternative) => ({
    transcript: heardAsideFromPrompt(say, alternative.transcript ?? ""),
    confidence: alternative.confidence,
    final: alternative.final,
  }));
  const judged = judgeLetterHear(answer, prepared);
  if (judged === "correct" || judged === "again") return judged;
  let finishedSpeech = false;
  let anyAside = false;
  for (const alternative of prepared) {
    const aside = alternative.transcript ?? "";
    if (speechTokens(aside).length === 0) continue;
    anyAside = true;
    if (spellingSpokenMatches(answer, aside, also)) return "correct";
    if (alternative.final) finishedSpeech = true;
  }
  if (judged === "miss") return "miss";
  if (!anyAside) return "wait";
  return finishedSpeech ? "miss" : "wait";
}

/** Phrases to bias the recognizer toward this letter. The letter itself is included. */
export function spellingBiasPhrases(answer: string, also: readonly string[] = []): string[] {
  const phrases: string[] = [];
  const seen = new Set<string>();
  const add = (value: string) => {
    const clean = value.replace(/\s+/g, " ").trim().toLowerCase();
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    phrases.push(clean);
  };
  add(answer);
  for (const alias of aliasList(answer, also)) add(alias);
  return phrases;
}

/** JSGF grammar for browsers that still accept SpeechGrammarList. Empty when there is nothing to hint. */
export function spellingGrammar(answer: string, also: readonly string[] = []): string {
  const parts = spellingBiasPhrases(answer, also).filter((phrase) => /^[a-z]+(?: [a-z]+)*$/.test(phrase));
  if (parts.length === 0) return "";
  return `#JSGF V1.0; grammar letter; public <answer> = ${parts.join(" | ")} ;`;
}

/**
 * The line shown after a try.
 * A matching alternative is preferred, then the first transcript that has words.
 * Punctuation-only and empty results are "I didn't hear anything".
 */
export function describeSpellingHear(
  answer: string,
  alternatives: readonly { transcript?: string; final?: boolean; confidence?: number | null }[],
  also: readonly string[] = [],
  say = "",
): { judgment: LetterJudgment; status: string } {
  const judgment = judgeSpellingAlternatives(answer, alternatives, also, say);
  if (judgment === "again") return { judgment, status: "Try again" };
  let matched = "";
  let top = "";
  for (const alternative of alternatives) {
    const text = (alternative.transcript ?? "").replace(/\s+/g, " ").trim();
    const aside = heardAsideFromPrompt(say, text);
    if (speechTokens(aside).length === 0) continue;
    if (!top) top = text;
    if (!matched && spellingSpokenMatches(answer, aside, also)) matched = text;
  }
  const spoken = judgment === "correct" ? matched || top : top;
  return { judgment, status: spoken ? `I heard: ${spoken}` : "I didn't hear anything" };
}

/** These recognition failures mean the mic did not hear a usable answer. They are not a miss. */
export function recognitionErrorRelistens(error: string | undefined): boolean {
  return (
    error === "no-speech" ||
    error === "audio-capture" ||
    error === "network" ||
    error === "aborted" ||
    error === "bad-grammar" ||
    error === "language-not-supported"
  );
}
