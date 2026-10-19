import { compactSpeech, speechTokens, spokenMatches } from "../sight-words/match.ts";
import { phonemeSpeak, type PaItem } from "./items.ts";

/**
 * Accept the answer, any `also` phrase, a phoneme sequence from `sounds`,
 * or, for a rhyme-production item, a word that ends with `rime` and is not the cue.
 * Repeated letters collapse on both sides, so n, nn, nnn, and nnnn are the same sound.
 * Letter names (en, ess) and a schwa release (nuh) count. The prompt's word may
 * sit in front of the sound. A different sound does not match.
 */

/** Letter a recognizer prints for a phoneme stored under another key. /k/ is already k, kuh, and cuh. */
const LETTER_FOR_SOUND: Record<string, readonly string[]> = {
  k: ["c"],
};

/** Recognizer letter names that are not already a different phoneme in phonemeSpeak. */
const LETTER_NAME: Record<string, readonly string[]> = {
  p: ["pee"],
  b: ["bee"],
  t: ["tee"],
  d: ["dee"],
  k: ["kay"],
  g: ["gee"],
  f: ["ef"],
  s: ["ess"],
  m: ["em"],
  n: ["en"],
  l: ["el"],
  r: ["ar"],
  h: ["aitch"],
  sh: ["esh"],
};

/** Continuants a recognizer writes with a schwa. Stops already have this in phonemeSpeak. */
const SCHWA_RELEASE: Record<string, readonly string[]> = {
  m: ["muh"],
  n: ["nuh"],
  f: ["fuh"],
  s: ["suh"],
  l: ["luh"],
  r: ["ruh"],
  sh: ["shuh"],
};

function collapseRepeats(token: string): string {
  return token.replace(/(.)\1+/g, "$1");
}

function collapsedTokens(value: string): string[] {
  return speechTokens(value).map(collapseRepeats);
}

/** Neighboring copies of one stretched sound become a single token. */
function collapseTokenRuns(tokens: readonly string[]): string[] {
  const out: string[] = [];
  for (const token of tokens) {
    const collapsed = collapseRepeats(token);
    if (!collapsed) continue;
    if (out[out.length - 1] === collapsed) continue;
    out.push(collapsed);
  }
  return out;
}

function addForm(accepted: Set<string>, form: string) {
  for (const token of speechTokens(form)) {
    accepted.add(token);
    accepted.add(collapseRepeats(token));
  }
  const compact = compactSpeech(form);
  if (compact) {
    accepted.add(compact);
    accepted.add(collapseRepeats(compact));
  }
}

function soundOptions(sound: string): Set<string> {
  const accepted = new Set<string>();
  const spoken = [
    ...(phonemeSpeak()[sound] ?? [sound]),
    ...(LETTER_FOR_SOUND[sound] ?? []),
    ...(LETTER_NAME[sound] ?? []),
    ...(SCHWA_RELEASE[sound] ?? []),
  ];
  for (const option of spoken) addForm(accepted, option);
  addForm(accepted, sound);
  return accepted;
}

function sameTokens(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((token, index) => token === right[index]);
}

function hasRun(heard: readonly string[], target: readonly string[]): boolean {
  for (let i = 0; i + target.length <= heard.length; i += 1) {
    if (target.every((token, offset) => heard[i + offset] === token)) return true;
  }
  return false;
}

/** The answer and `also` list, after repeated letters are collapsed on both sides. */
function stretchedAnswerMatches(expected: string, heard: string, also: readonly string[]): boolean {
  const heardTokens = collapsedTokens(heard);
  if (heardTokens.length === 0) return false;
  for (const candidate of [expected, ...also]) {
    const target = collapsedTokens(candidate);
    if (target.length === 0) continue;
    if (sameTokens(heardTokens, target)) return true;
    if (target.length > 1 && hasRun(heardTokens, target)) return true;
    if (target.length === 1 && target[0] && heardTokens.includes(target[0])) return true;
  }
  return false;
}

export function soundSequenceMatches(sounds: readonly string[], heard: string): boolean {
  if (sounds.length === 0) return false;
  const tokens = collapseTokenRuns(speechTokens(heard));
  if (tokens.length < sounds.length) return false;
  const options = sounds.map((sound) => soundOptions(sound));
  for (let start = 0; start + sounds.length <= tokens.length; start += 1) {
    const aligned = sounds.every((_, offset) => options[offset]?.has(tokens[start + offset] ?? ""));
    if (aligned) return true;
  }
  return false;
}

/** The target word of an isolate, segment, onset, or rime prompt, when the sentence names one. */
function promptWord(say: string | undefined): string {
  if (!say) return "";
  const named = say.toLowerCase().match(/(?:sound in|word is)\s+([a-z]+)/);
  return named?.[1] ?? "";
}

/** A recognizer sometimes glues the word and the sound into one token, as in sunn. */
function wordThenSound(say: string | undefined, sounds: readonly string[], heard: string): boolean {
  const word = promptWord(say);
  if (!word || sounds.length === 0) return false;
  for (const token of speechTokens(heard)) {
    if (token.length <= word.length || !token.startsWith(word)) continue;
    if (soundSequenceMatches(sounds, token.slice(word.length))) return true;
  }
  return false;
}

export function rhymeProductionMatches(item: Pick<PaItem, "rime" | "cue">, heard: string): boolean {
  const rime = speechTokens(item.rime)[0];
  if (!rime) return false;
  const cue = new Set(speechTokens(item.cue));
  return speechTokens(heard).some((token) => token.length > rime.length && token.endsWith(rime) && token !== rime && !cue.has(token));
}

export function paSpokenMatches(
  item: Pick<PaItem, "answer" | "also" | "sounds" | "rime" | "cue" | "say">,
  heard: string,
): boolean {
  if (spokenMatches(item.answer, heard, item.also)) return true;
  if (stretchedAnswerMatches(item.answer, heard, item.also)) return true;
  if (soundSequenceMatches(item.sounds, heard)) return true;
  if (wordThenSound(item.say, item.sounds, heard)) return true;
  if (item.rime && rhymeProductionMatches(item, heard)) return true;
  return false;
}

/** A blank live result waits. A finished blank misses. A live non-match waits. Only a finished non-match is a miss. */
export function judgePaSpoken(
  item: Pick<PaItem, "answer" | "also" | "sounds" | "rime" | "cue" | "say">,
  heard: string,
  final: boolean,
): "correct" | "miss" | "wait" {
  if (speechTokens(heard).length === 0) return final ? "miss" : "wait";
  if (paSpokenMatches(item, heard)) return "correct";
  return final ? "miss" : "wait";
}
