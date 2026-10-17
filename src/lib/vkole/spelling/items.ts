import lists from "./data.json" with { type: "json" };

export const SPELLING_ENGINE = "sp" as const;

export const SPELLING_LETTER_MS = lists.letterMs;
export const SPELLING_SONG_MS = lists.songMs;
export const SPELLING_HAPPY_FACE_MS = lists.happyFaceMs;
export const SPELLING_RESPONSE_MS = lists.responseMs;
export const SPELLING_ADVANCE_MS = lists.advanceMs;
export const SPELLING_MAX_CHANGES_PER_SECOND = lists.maxChangesPerSecond;

export const SPELLING_NOTE =
  "The alphabet plays once when this engine opens, one letter every 1.5 seconds. Then a question is spoken and shown. The microphone listens only while that question is waiting for an answer, and it does not record or save the sound. A correct answer shows a Happy Face for 2 seconds, then the next question. A miss, or 5 seconds with no answer, speaks the correct letter, waits 2 seconds, and then the next question.";

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

/**
 * Correct, miss, and no answer all move to the next item.
 * The grade stays. Empty bands are skipped. The last filled band wraps to its start.
 * `movement` in the data file is `next` until the owner specifies another rule.
 */
export function nextAfterAnswer(
  state: { band: SpBand; index: number; grade: number },
  _correct: boolean,
): { band: SpBand; index: number; grade: number } {
  const order = filledBands();
  const current = order.includes(state.band) ? state.band : (order[0] ?? "LK");
  const count = Math.max(1, bandMeta(current).count);
  const at = order.indexOf(current);
  if (lists.movement !== "next") return { band: current, index: Math.min(state.index, count - 1), grade: state.grade };
  if (state.index + 1 < count) return { band: current, index: state.index + 1, grade: state.grade };
  const next = order[at + 1];
  if (next) return { band: next, index: 0, grade: state.grade };
  return { band: order[0] ?? "LK", index: 0, grade: state.grade };
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
