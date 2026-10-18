import { compactSpeech, speechTokens, spokenMatches } from "../sight-words/match.ts";
import { phonemeSpeak, type PaItem } from "./items.ts";

/**
 * Accept the answer, any `also` phrase, a phoneme sequence from `sounds`,
 * or, for a rhyme-production item, a word that ends with `rime` and is not the cue.
 * The sight-word tokenizer is used, so case and extra words follow that matcher.
 */

/** Letter a recognizer prints for a phoneme stored under another key. /k/ is already k, kuh, and cuh. */
const LETTER_FOR_SOUND: Record<string, readonly string[]> = {
  k: ["c"],
};

function soundOptions(sound: string): Set<string> {
  const accepted = new Set<string>();
  const spoken = [...(phonemeSpeak()[sound] ?? [sound]), ...(LETTER_FOR_SOUND[sound] ?? [])];
  for (const option of spoken) {
    for (const token of speechTokens(option)) accepted.add(token);
    const compact = compactSpeech(option);
    if (compact) accepted.add(compact);
  }
  for (const token of speechTokens(sound)) accepted.add(token);
  return accepted;
}

export function soundSequenceMatches(sounds: readonly string[], heard: string): boolean {
  if (sounds.length === 0) return false;
  const tokens = speechTokens(heard);
  if (tokens.length < sounds.length) return false;
  const options = sounds.map((sound) => soundOptions(sound));
  for (let start = 0; start + sounds.length <= tokens.length; start += 1) {
    const aligned = sounds.every((_, offset) => options[offset]?.has(tokens[start + offset] ?? ""));
    if (aligned) return true;
  }
  return false;
}

export function rhymeProductionMatches(item: Pick<PaItem, "rime" | "cue">, heard: string): boolean {
  const rime = speechTokens(item.rime)[0];
  if (!rime) return false;
  const cue = new Set(speechTokens(item.cue));
  return speechTokens(heard).some((token) => token.length > rime.length && token.endsWith(rime) && token !== rime && !cue.has(token));
}

export function paSpokenMatches(item: Pick<PaItem, "answer" | "also" | "sounds" | "rime" | "cue">, heard: string): boolean {
  if (spokenMatches(item.answer, heard, item.also)) return true;
  if (soundSequenceMatches(item.sounds, heard)) return true;
  if (item.rime && rhymeProductionMatches(item, heard)) return true;
  return false;
}

/** A blank live result waits. A finished blank misses. A live non-match waits. Only a finished non-match is a miss. */
export function judgePaSpoken(
  item: Pick<PaItem, "answer" | "also" | "sounds" | "rime" | "cue">,
  heard: string,
  final: boolean,
): "correct" | "miss" | "wait" {
  if (speechTokens(heard).length === 0) return final ? "miss" : "wait";
  if (paSpokenMatches(item, heard)) return "correct";
  return final ? "miss" : "wait";
}
