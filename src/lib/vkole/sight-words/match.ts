/**
 * Lenient spoken match.
 * Lower case, straight apostrophes removed, other marks ignored.
 * Extra words are allowed. A filler sound is ignored.
 * A different sight word is not accepted, including to / too / two.
 */

const FILLERS = new Set(["um", "uh", "er", "ah", "hmm", "hm", "mm"]);

export function foldSpeech(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/'/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokensOf(value: string): string[] {
  return foldSpeech(value)
    .split(" ")
    .filter((word) => word && !FILLERS.has(word));
}

export function spokenMatches(expected: string, heard: string): boolean {
  const want = foldSpeech(expected);
  if (!want || !heard.trim()) return false;
  const tokens = tokensOf(heard);
  if (tokens.length === 0) return false;
  const phrase = tokens.join(" ");
  if (phrase === want) return true;
  const wantTokens = want.split(" ");
  if (wantTokens.length === 1) return tokens.includes(want);
  for (let i = 0; i + wantTokens.length <= tokens.length; i += 1) {
    if (tokens.slice(i, i + wantTokens.length).join(" ") === want) return true;
  }
  return false;
}

/** A live transcript can count as correct. Only a finished phrase can count as a miss. */
export function judgeSpoken(expected: string, heard: string, final: boolean): "correct" | "miss" | "wait" {
  if (spokenMatches(expected, heard)) return "correct";
  if (final && foldSpeech(heard)) return "miss";
  return "wait";
}
