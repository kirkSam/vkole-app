/**
 * Spoken-answer matcher from docs/sight-words-website-canonical.md.
 * Lowercase. Curly apostrophes become straight apostrophes.
 * Any other character except a letter, digit, apostrophe, space, or hyphen becomes a space.
 * Hyphens become spaces. Collapse spaces and trim.
 * Split on spaces, strip apostrophes from each token, and drop empty tokens.
 * An empty transcript misses.
 * It matches when the heard tokens equal the target tokens in order,
 * or a multi-word target appears as consecutive heard tokens,
 * or any heard token equals the target, the target with apostrophes and spaces removed,
 * or any token or compacted form in that word's `also` list.
 * A longer word does not match a shorter one.
 */

export function prepareSpeech(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function speechTokens(value: string): string[] {
  const prepared = prepareSpeech(value);
  if (!prepared) return [];
  return prepared
    .split(" ")
    .map((token) => token.replace(/'/g, ""))
    .filter(Boolean);
}

export function compactSpeech(value: string): string {
  return prepareSpeech(value).replace(/['\s]/g, "");
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

export function spokenMatches(expected: string, heard: string, also: readonly string[] = []): boolean {
  const heardTokens = speechTokens(heard);
  if (heardTokens.length === 0) return false;
  const targetTokens = speechTokens(expected);
  if (targetTokens.length === 0) return false;
  if (sameTokens(heardTokens, targetTokens)) return true;
  if (targetTokens.length > 1 && hasRun(heardTokens, targetTokens)) return true;
  const accepted = new Set<string>();
  if (targetTokens.length === 1 && targetTokens[0]) accepted.add(targetTokens[0]);
  const compactTarget = compactSpeech(expected);
  if (compactTarget) accepted.add(compactTarget);
  for (const alias of also) {
    for (const token of speechTokens(alias)) accepted.add(token);
    const compactAlias = compactSpeech(alias);
    if (compactAlias) accepted.add(compactAlias);
  }
  return heardTokens.some((token) => accepted.has(token));
}

/** An empty transcript misses. A live non-match waits. Only a finished non-match is a miss. */
export function judgeSpoken(
  expected: string,
  heard: string,
  final: boolean,
  also: readonly string[] = [],
): "correct" | "miss" | "wait" {
  if (speechTokens(heard).length === 0) return "miss";
  if (spokenMatches(expected, heard, also)) return "correct";
  return final ? "miss" : "wait";
}
