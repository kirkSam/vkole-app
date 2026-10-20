import lists from "./data.json" with { type: "json" };
import { compactSpeech, speechTokens, spokenMatches } from "../sight-words/match.ts";

/**
 * Lenient spoken-letter matcher. It uses the sight-word tokenizer:
 * case, extra words, and a finished non-match follow that matcher.
 * A single-word alias matches as a token. A multi-word alias, such as
 * "double you", matches only as those words in a row, so a short piece
 * of it does not count as the whole letter.
 * Letter names from the data file are always accepted, including when an
 * item's own also-list is missing one of them.
 */

const letterNames = lists.letterNames as Record<string, readonly string[]>;

/** Spoken names for a letter, such as "em" for M. The letter itself is matched separately. */
export function spokenFormsForLetter(answer: string): readonly string[] {
  const letter = answer.trim().toUpperCase();
  return letterNames[letter] ?? [];
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
 * A live non-match waits. Only a finished transcript that has real words and does not match is a miss.
 */
export function judgeSpellingSpoken(
  answer: string,
  heard: string,
  final: boolean,
  also: readonly string[] = [],
): "correct" | "miss" | "wait" {
  if (speechTokens(heard).length === 0) return "wait";
  if (spellingSpokenMatches(answer, heard, also)) return "correct";
  return final ? "miss" : "wait";
}

/**
 * Any alternative that names the letter is correct, even when a higher-ranked guess is wrong.
 * A result counts as a miss only when it is finished, some alternative has real words, and none match.
 * Confidence and length are not inputs. A one-letter transcript is a real answer.
 */
export function judgeSpellingAlternatives(
  answer: string,
  alternatives: readonly { transcript?: string; final?: boolean; confidence?: number }[],
  also: readonly string[] = [],
): "correct" | "miss" | "wait" {
  let finishedSpeech = false;
  for (const alternative of alternatives) {
    const transcript = alternative.transcript ?? "";
    const final = Boolean(alternative.final);
    if (spellingSpokenMatches(answer, transcript, also)) return "correct";
    if (final && speechTokens(transcript).length > 0) finishedSpeech = true;
  }
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
  alternatives: readonly { transcript?: string; final?: boolean; confidence?: number }[],
  also: readonly string[] = [],
): { judgment: "correct" | "miss" | "wait"; status: string } {
  const judgment = judgeSpellingAlternatives(answer, alternatives, also);
  let matched = "";
  let top = "";
  for (const alternative of alternatives) {
    const text = (alternative.transcript ?? "").replace(/\s+/g, " ").trim();
    if (speechTokens(text).length === 0) continue;
    if (!top) top = text;
    if (!matched && spellingSpokenMatches(answer, text, also)) matched = text;
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
