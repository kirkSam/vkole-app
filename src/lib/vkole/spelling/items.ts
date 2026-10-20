import lists from "./data.json" with { type: "json" };

export const SPELLING_ENGINE = "sp" as const;

export const SPELLING_LETTER_MS = lists.letterMs;
export const SPELLING_SONG_MS = lists.songMs;
export const SPELLING_HAPPY_FACE_MS = lists.answerFlow.happyFaceMs;
export const SPELLING_RESPONSE_MS = lists.answerFlow.responseMs;
export const SPELLING_MAX_CHANGES_PER_SECOND = lists.maxChangesPerSecond;

/** The opening waits this long, then starts on its own if START was not pressed. */
export const SPELLING_START_MS = 30_000;

/**
 * Chrome ends a SpeechRecognition session often, and start() in that same turn throws.
 * A short pause lets the next listen begin on the same letter.
 */
export const SPELLING_RECOGNIZER_RESTART_MS = 250;

export const SPELLING_NOTE =
  "The alphabet plays once when this engine opens, one letter every 1.5 seconds. Then a question is spoken and shown. The microphone listens only while that question is waiting for an answer, and it does not record or save the sound. A correct answer shows a Happy Face for 2 seconds, then the next letter, and a fast answer moves on as soon as it is heard. Five seconds of silence shows the same letter again. A second silence goes back 3 letters. A miss shows and speaks the 3 earlier letters. A second miss steps back one letter. A miss never sends the alphabet back to A.";

/** Whole seconds left before the alphabet starts itself. 0 means start now. */
export function spellingStartSecondsLeft(elapsedMs: number): number {
  const elapsed = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
  const left = SPELLING_START_MS - elapsed;
  if (left <= 0) return 0;
  return Math.ceil(left / 1000);
}

export const SPELLING_BANDS = ["LK", "LS", "CVC", "DOLCH", "FRY"] as const;

export type SpBand = (typeof SPELLING_BANDS)[number];

export type SpItem = {
  id: string;
  kind: string;
  say: string;
  show: string;
  answer: string;
  also: string[];
  letter: string;
  model: string;
};

export type SpCard = SpItem & {
  band: SpBand;
  index: number;
  grade: number;
  name: string;
  label: string;
};

type RawItem = {
  id?: string;
  kind?: string;
  say?: string;
  show?: string;
  answer?: string;
  also?: string[];
  letter?: string;
  model?: string;
};

type RawBand = {
  id?: string;
  name?: string;
  grade?: string;
  kinds?: string[];
  note?: string;
  items?: RawItem[];
};

const BANDS = lists.bands as RawBand[];
const NO_ALSO: string[] = [];

export function isSpBand(value: string | undefined | null): value is SpBand {
  return !!value && (SPELLING_BANDS as readonly string[]).includes(value);
}

export function alphabet(): readonly string[] {
  return lists.letters;
}

export function letterColors(): readonly { letter: string; background: string }[] {
  return lists.colors;
}

export function reviewChangesPerSecond(): number {
  return 1000 / SPELLING_LETTER_MS;
}

/**
 * The alphabet review holds one letter for `letterMs`.
 * At exactly 26 × 1500 ms the song is finished.
 * A change every 1.5 seconds stays under 3 changes per second.
 */
export function letterAtSongTime(ms: number): { index: number; letter: string; done: boolean } {
  const letters = alphabet();
  const last = letters.length - 1;
  if (Number.isFinite(ms) && ms >= SPELLING_SONG_MS) {
    return { index: last, letter: letters[last] ?? "Z", done: true };
  }
  const elapsed = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const index = Math.min(last, Math.floor(elapsed / SPELLING_LETTER_MS));
  return { index, letter: letters[index] ?? "A", done: false };
}

/** The microphone is on only while a question is waiting for an answer. */
export function micListensDuring(phase: string): boolean {
  return phase === "listen";
}

export function bandMeta(band: SpBand): { name: string; label: string; count: number; kinds: string[]; note: string } {
  const row = BANDS.find((entry) => entry.id === band);
  return {
    name: row?.name ?? band,
    label: row?.grade ?? "",
    count: row?.items?.length ?? 0,
    kinds: row?.kinds ?? [],
    note: row?.note ?? "",
  };
}

function asItem(raw: RawItem | undefined): SpItem {
  return {
    id: raw?.id ?? "",
    kind: raw?.kind ?? "",
    say: raw?.say ?? "",
    show: raw?.show ?? "",
    answer: raw?.answer ?? "",
    also: Array.isArray(raw?.also) ? raw.also : NO_ALSO,
    letter: raw?.letter ?? "",
    model: raw?.model ?? raw?.answer ?? "",
  };
}

function bandItems(band: SpBand): RawItem[] {
  return BANDS.find((entry) => entry.id === band)?.items ?? [];
}

/** Bands with items, in file order. Empty later bands stay in the file and are skipped. */
export function filledBands(): SpBand[] {
  return SPELLING_BANDS.filter((band) => bandMeta(band).count > 0);
}

export function itemAt(band: SpBand, index: number): SpItem & { index: number } {
  const items = bandItems(band);
  const count = items.length;
  const at = count === 0 ? 0 : ((Math.trunc(index) % count) + count) % count;
  return { ...asItem(items[at]), index: at };
}

export function spCard(band: SpBand, index: number, grade: number): SpCard {
  const resolved = bandMeta(band).count > 0 ? band : (filledBands()[0] ?? "LK");
  const entry = itemAt(resolved, index);
  const meta = bandMeta(resolved);
  return { ...entry, band: resolved, index: entry.index, grade, name: meta.name, label: meta.label };
}

/** Letter knowledge is the start until the owner specifies later placement. */
export function startBand(): SpBand {
  return filledBands()[0] ?? "LK";
}

export function startCard(grade: number): SpCard {
  const rounded = Math.round(grade);
  const stored = Number.isFinite(rounded) ? rounded : 0;
  return spCard(startBand(), 0, stored);
}

/**
 * A saved band wins, including a levelCode that is a band id.
 * An empty band falls back to the first band that has items.
 * Otherwise the student starts at the first letter question.
 */
export function cardFromAccount(
  input: {
    grade?: number;
    band?: string | null;
    index?: number | null;
    levelCode?: string | null;
    word?: string | null;
  } | null | undefined,
  fallbackGrade: number,
): SpCard {
  const raw = input?.grade ?? fallbackGrade;
  const rounded = Math.round(Number(raw));
  const grade = Number.isFinite(rounded) ? rounded : 0;
  const named = isSpBand(input?.band) ? input.band : isSpBand(input?.levelCode) ? input.levelCode : undefined;
  const band = named && bandMeta(named).count > 0 ? named : startBand();
  let index = named && Number.isInteger(input?.index) && (input?.index ?? 0) >= 0 ? Number(input?.index) : 0;
  if (named && bandMeta(named).count > 0 && !Number.isInteger(input?.index) && input?.word) {
    const found = bandItems(band).findIndex((item) => item.id === input.word);
    if (found >= 0) index = found;
  }
  return spCard(band, index, grade);
}

export type LetterProgress = {
  index: number;
  silence: number;
  wrong: number;
};

export type LetterOutcome = "correct" | "miss" | "timeout";

export type LetterView = {
  id: string;
  index: number;
  letter: string;
  silence: number;
  wrong: number;
  kind: "ask" | "cue";
  cue: string[];
  say: string;
  show: string;
  answer: string;
  also: string[];
  shown: string;
  band: SpBand;
  name: string;
};

type FlowSilence = { times?: number; action?: string; letters?: number };
type FlowWrong = { times?: number; action?: string; letters?: number; letter?: string };

/** The letter the student should say. 0 is A. Counts that pass A stop at A. */
export function clampLetterIndex(index: number): number {
  const letters = alphabet();
  const floor = Math.max(0, letters.indexOf(lists.answerFlow.clamp));
  const at = Number.isInteger(index) ? index : floor;
  return Math.min(letters.length - 1, Math.max(floor, at));
}

export function normalizeLetterProgress(input: Partial<LetterProgress> | null | undefined): LetterProgress {
  return {
    index: clampLetterIndex(input?.index ?? 0),
    silence: Math.max(0, Math.trunc(Number(input?.silence) || 0)),
    wrong: Math.max(0, Math.trunc(Number(input?.wrong) || 0)),
  };
}

function cueLetters(index: number, count: number): string[] {
  const letters = alphabet();
  const start = Math.max(0, index - Math.max(0, Math.trunc(count) || 0));
  return letters.slice(start, index);
}

/**
 * Letter-phase answers. The rules come from `answerFlow` in the data file.
 * One miss stays on the letter. The second miss steps back by the small `back` count.
 * A miss never restarts at A. Silence is its own count and is never stored as a miss.
 */
export function applyLetterAnswer(input: LetterProgress, outcome: LetterOutcome): LetterProgress {
  const state = normalizeLetterProgress(input);
  const letters = alphabet();
  if (outcome === "correct") {
    const next = state.index + 1;
    const wrapped = next >= letters.length ? Math.max(0, letters.indexOf(lists.answerFlow.afterLast)) : next;
    return { index: clampLetterIndex(wrapped), silence: 0, wrong: 0 };
  }
  const silenceRules = lists.answerFlow.silence as FlowSilence[];
  const wrongRules = lists.answerFlow.wrong as FlowWrong[];
  if (outcome === "miss") {
    const step = state.wrong + 1;
    const rule = wrongRules.find((row) => row.times === step) ?? wrongRules[wrongRules.length - 1];
    if (rule?.action === "back") {
      return { index: clampLetterIndex(state.index - (rule.letters ?? 1)), silence: 0, wrong: 0 };
    }
    return { index: state.index, silence: 0, wrong: step };
  }
  const times = state.silence + 1;
  const rule = silenceRules.find((row) => row.times === times) ?? silenceRules[silenceRules.length - 1];
  if (!rule || rule.action === "repeat") return { index: state.index, silence: times, wrong: 0 };
  return { index: clampLetterIndex(state.index - (rule.letters ?? 3)), silence: 0, wrong: 0 };
}

/** What the student sees and says for the current letter, including the prior-letter cue after a miss. */
export function letterView(input: LetterProgress): LetterView {
  const progress = normalizeLetterProgress(input);
  const letters = alphabet();
  const letter = letters[progress.index] ?? "A";
  const meta = bandMeta("LK");
  const item = itemAt("LK", progress.index);
  if (progress.wrong > 0) {
    const cueRules = (lists.answerFlow.wrong as FlowWrong[]).filter((row) => row.action === "cue");
    const rule = [...cueRules].reverse().find((row) => (row.times ?? 1) <= progress.wrong) ?? cueRules[0];
    const cue = cueLetters(progress.index, rule?.letters ?? 0);
    if (cue.length > 0) {
      return {
        id: `lk-cue-${cue.length}-${letter.toLowerCase()}`,
        index: progress.index,
        letter,
        silence: progress.silence,
        wrong: progress.wrong,
        kind: "cue",
        cue,
        say: cue.join(lists.answerFlow.cueSayJoin),
        show: cue.join(lists.answerFlow.cueShowJoin),
        answer: item.answer || letter,
        also: item.also,
        shown: "",
        band: "LK",
        name: meta.name,
      };
    }
  }
  return {
    id: item.id || `lk-${letter.toLowerCase()}`,
    index: progress.index,
    letter,
    silence: progress.silence,
    wrong: progress.wrong,
    kind: "ask",
    cue: [],
    say: item.say,
    show: item.show,
    answer: item.answer || letter,
    also: item.also,
    shown: item.letter,
    band: "LK",
    name: meta.name,
  };
}

export function letterMoveNote(before: LetterProgress, outcome: LetterOutcome, after: LetterProgress): string {
  if (outcome === "correct") return "Heard.";
  if (outcome === "timeout" && after.index < before.index) return "No answer. The sequence goes back.";
  if (outcome === "timeout" && after.silence > before.silence) return "No answer. The same letter stays.";
  if (outcome === "miss" && after.index < before.index) return "Not yet. One letter back.";
  if (after.wrong > before.wrong) return "Not yet. The earlier letters are the prompt.";
  if (outcome === "timeout") return "No answer.";
  return "Not yet.";
}

export function spellingPrompt(band: SpBand, index: number, grade = 1): {
  id: string;
  stem: string;
  answer: string;
  aliases: string[];
  standard: string;
  note: string;
} {
  const card = spCard(band, index, grade);
  const stem = card.letter && card.show !== card.letter ? `${card.show} ${card.letter}`.trim() : card.show;
  return {
    id: `sp:${card.band}:${card.index}`,
    stem,
    answer: card.answer,
    aliases: card.also,
    standard: card.band,
    note: card.name,
  };
}

export function openingPrompt(): string {
  return lists.openingSay;
}
