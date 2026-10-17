import { compactSpeech, speechTokens, spokenMatches } from "../sight-words/match.ts";

/**
 * Lenient spoken-letter matcher. It uses the sight-word tokenizer:
 * case, extra words, and a finished non-match follow that matcher.
 * A single-word alias matches as a token. A multi-word alias, such as
 * "double you", matches only as those words in a row, so a short piece
 * of it does not count as the whole letter.
 */

function hasRun(heard: readonly string[], target: readonly string[]): boolean {
  for (let i = 0; i + target.length <= heard.length; i += 1) {
    if (target.every((token, offset) => heard[i + offset] === token)) return true;
  }
  return false;
}

export function spellingSpokenMatches(answer: string, heard: string, also: readonly string[] = []): boolean {
  const singles = also.filter((alias) => speechTokens(alias).length <= 1);
  if (spokenMatches(answer, heard, singles)) return true;
  const heardTokens = speechTokens(heard);
  for (const alias of also) {
    const tokens = speechTokens(alias);
    if (tokens.length < 2) continue;
    if (hasRun(heardTokens, tokens)) return true;
    const compact = compactSpeech(alias);
    if (compact && heardTokens.includes(compact)) return true;
  }
  return false;
}

/** An empty transcript misses. A live non-match waits. Only a finished non-match is a miss. */
export function judgeSpellingSpoken(
  answer: string,
  heard: string,
  final: boolean,
  also: readonly string[] = [],
): "correct" | "miss" | "wait" {
  if (speechTokens(heard).length === 0) return "miss";
  if (spellingSpokenMatches(answer, heard, also)) return "correct";
  return final ? "miss" : "wait";
}
