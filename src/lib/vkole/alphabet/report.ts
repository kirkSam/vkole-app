/**
 * One short parent report at the end of an alphabet sitting.
 * The xAI call stays on the server. The key is read from XAI_API_KEY and is never logged.
 * A missing key or a failed call uses the local template instead.
 */

export const ALPHABET_REPORT_LABEL = "Report written by Space XSI (Grok)";
export const ALPHABET_REPORT_MODEL = "grok-4-1-fast-non-reasoning";
export const ALPHABET_REPORT_MAX_TOKENS = 160;

export type AlphabetSessionStats = {
  practiced: string[];
  mastered: string[];
  practice: string[];
  correct: number;
  missed: number;
  silent: number;
};

export type AlphabetReport = {
  text: string;
  source: "grok" | "template";
};

type FetchLike = (input: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<Response>;

function letterList(letters: string[]): string {
  const names = letters.filter((letter) => /^[A-Z]$/.test(letter));
  if (names.length === 0) return "";
  if (names.length === 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function reportSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => /[.!?]$/.test(sentence));
}

/** A saved report is reused so a mail retry does not call the API again. */
export function savedAlphabetReport(saved: string | null | undefined): string {
  return saved?.replace(/\s+/g, " ").trim() ?? "";
}

/** Plain-text lines for this account's progress email. Empty when there is no report. */
export function alphabetReportLines(text: string): string[] {
  const body = text.replace(/\s+/g, " ").trim();
  if (!body) return [];
  return [ALPHABET_REPORT_LABEL, body];
}

export function alphabetStatsFromEvents(events: { detail: string; correct?: boolean }[]): AlphabetSessionStats {
  const last = new Map<string, "correct" | "miss" | "timeout">();
  const order: string[] = [];
  let correct = 0;
  let missed = 0;
  let silent = 0;
  for (const event of events) {
    let row: { letter?: unknown; outcome?: unknown } | null = null;
    try {
      const parsed = JSON.parse(event.detail) as { letter?: unknown; outcome?: unknown; attempt?: unknown };
      if (parsed && typeof parsed === "object" && parsed.attempt !== true) row = parsed;
    } catch {
      row = null;
    }
    const letter = typeof row?.letter === "string" ? row.letter.trim().toUpperCase() : "";
    const outcome = row?.outcome === "correct" || row?.outcome === "miss" || row?.outcome === "timeout" ? row.outcome : "";
    if (!/^[A-Z]$/.test(letter) || !outcome) continue;
    if (!last.has(letter)) order.push(letter);
    last.set(letter, outcome);
    if (outcome === "correct") correct += 1;
    else if (outcome === "timeout") silent += 1;
    else missed += 1;
  }
  const practiced = order;
  const mastered = practiced.filter((letter) => last.get(letter) === "correct");
  const practice = practiced.filter((letter) => last.get(letter) !== "correct");
  return { practiced, mastered, practice, correct, missed, silent };
}

export function templateAlphabetReport(stats: AlphabetSessionStats): string {
  const practiced = letterList(stats.practiced);
  const mastered = letterList(stats.mastered);
  const practice = letterList(stats.practice);
  if (!practiced) {
    return [
      "This sitting opened the alphabet.",
      "No letters were answered yet.",
      "The next sitting can start again at A.",
      "A little practice each time is enough.",
    ].join(" ");
  }
  return [
    `This sitting practiced ${practiced}.`,
    mastered ? `The letters answered correctly were ${mastered}.` : "No letter was answered correctly yet.",
    practice ? `The letters to practice again are ${practice}.` : "Every letter in this sitting was answered correctly.",
    "A correct answer moves to the next letter, and a miss hears the earlier letters as a prompt.",
    "Keep going, because short practice builds the alphabet.",
  ].join(" ");
}

function acceptReport(text: string, key: string): string | null {
  const plain = text.replace(/```/g, " ").replace(/\s+/g, " ").trim();
  if (!plain || plain.includes(key) || plain.includes("@")) return null;
  const sentences = reportSentences(plain);
  if (sentences.length < 3) return null;
  return sentences.slice(0, 5).join(" ");
}

function statsPayload(stats: AlphabetSessionStats): AlphabetSessionStats {
  return {
    practiced: stats.practiced.filter((letter) => /^[A-Z]$/.test(letter)),
    mastered: stats.mastered.filter((letter) => /^[A-Z]$/.test(letter)),
    practice: stats.practice.filter((letter) => /^[A-Z]$/.test(letter)),
    correct: Math.max(0, Math.round(stats.correct) || 0),
    missed: Math.max(0, Math.round(stats.missed) || 0),
    silent: Math.max(0, Math.round(stats.silent) || 0),
  };
}

/**
 * One chat completion for this sitting. The request body is the letter stats only.
 * It does not send names, mail addresses, or audio.
 */
export async function writeAlphabetReport(stats: AlphabetSessionStats, fetchImpl?: FetchLike): Promise<AlphabetReport> {
  const fallback = templateAlphabetReport(statsPayload(stats));
  const key = process.env.XAI_API_KEY?.trim() ?? "";
  if (!key) return { text: fallback, source: "template" };
  const call = fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await call("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ALPHABET_REPORT_MODEL,
        temperature: 0.3,
        max_tokens: ALPHABET_REPORT_MAX_TOKENS,
        messages: [
          {
            role: "system",
            content:
              "Write 3 to 5 plain sentences for one parent about this child's alphabet practice. Cover what was practiced, which letters were mastered, which letters still need practice, and a short encouragement. Do not use any person's name. Return only the sentences.",
          },
          { role: "user", content: JSON.stringify(statsPayload(stats)) },
        ],
      }),
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    return { text: fallback, source: "template" };
  }
  if (!response.ok) return { text: fallback, source: "template" };
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { text: fallback, source: "template" };
  }
  const content = (body as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content;
  if (typeof content !== "string") return { text: fallback, source: "template" };
  const accepted = acceptReport(content, key);
  if (!accepted) return { text: fallback, source: "template" };
  return { text: accepted, source: "grok" };
}
