import lists from "./data.json" with { type: "json" };

export const PA_ENGINE = "pa" as const;

export const PA_ADVANCE_MS = lists.advanceMs;
export const PA_MAX_SHOW_MS = lists.maxShowMs;
export const PA_RISE_AFTER = lists.riseAfter;
export const PA_DROP_AFTER = lists.dropAfter;
export const PA_ROUND_SIZE = lists.roundSize;

export const PA_NOTE =
  "The computer speaks a prompt. The child answers out loud. Nothing on the screen has to be read. A correct answer is silent, then the next prompt after 2 seconds. A wrong answer, or 20 seconds of silence, speaks the correct answer, waits 2 seconds, and moves on. The microphone listens only while a prompt is waiting for an answer. It does not record or save the sound. Two correct answers in a row move up one band. Two misses in a row move down one band. The grade number stays.";

export const PA_BANDS = ["WA", "RH", "SY", "OR", "IS", "BL", "PS", "PD"] as const;

export type PaBand = (typeof PA_BANDS)[number];

export type PaItem = {
  id: string;
  kind: string;
  say: string;
  answer: string;
  model: string;
  also: string[];
  sounds: string[];
  boxes: number;
  rime: string;
  cue: string;
};

export type PaCard = PaItem & {
  band: PaBand;
  index: number;
  grade: number;
  name: string;
  label: string;
};

type RawItem = {
  id?: string;
  kind?: string;
  say?: string;
  answer?: string;
  model?: string;
  also?: string[];
  sounds?: string[];
  boxes?: number;
  rime?: string;
  cue?: string;
};

type RawBand = {
  id?: string;
  name?: string;
  grade?: string;
  items?: RawItem[];
};

const BANDS = lists.bands as RawBand[];

const NO_ALSO: string[] = [];
const NO_SOUNDS: string[] = [];

export function isPaBand(value: string | undefined | null): value is PaBand {
  return !!value && (PA_BANDS as readonly string[]).includes(value);
}

export function bandMeta(band: PaBand): { name: string; label: string; count: number } {
  const row = BANDS.find((entry) => entry.id === band);
  return {
    name: row?.name ?? band,
    label: row?.grade ?? "",
    count: row?.items?.length ?? 0,
  };
}

function asItem(raw: RawItem | undefined): PaItem {
  return {
    id: raw?.id ?? "",
    kind: raw?.kind ?? "",
    say: raw?.say ?? "",
    answer: raw?.answer ?? "",
    model: raw?.model ?? "",
    also: Array.isArray(raw?.also) ? raw.also : NO_ALSO,
    sounds: Array.isArray(raw?.sounds) ? raw.sounds : NO_SOUNDS,
    boxes: Number.isInteger(raw?.boxes) ? Number(raw?.boxes) : 0,
    rime: raw?.rime ?? "",
    cue: raw?.cue ?? "",
  };
}

function bandItems(band: PaBand): RawItem[] {
  return BANDS.find((entry) => entry.id === band)?.items ?? [];
}

export function itemAt(band: PaBand, index: number): PaItem & { index: number } {
  const items = bandItems(band);
  const count = items.length;
  const at = count === 0 ? 0 : ((Math.trunc(index) % count) + count) % count;
  return { ...asItem(items[at]), index: at };
}

export function paCard(band: PaBand, index: number, grade: number): PaCard {
  const entry = itemAt(band, index);
  const meta = bandMeta(band);
  return { ...entry, band, grade, name: meta.name, label: meta.label };
}

/**
 * Age 4 starts at word awareness. Age 5 starts at rhyme. Those ages win over the grade.
 * Grade 1 starts at first and final sound. Grade 2 and above start at deletion and substitution.
 * Anything younger than that, with no age of 4 or 5, starts at word awareness.
 */
export function startBand(input: { age?: number | null; grade?: number | null }): PaBand {
  const age = input.age == null ? Number.NaN : Math.round(Number(input.age));
  if (age === 4) return lists.placement.byAge["4"] as PaBand;
  if (age === 5) return lists.placement.byAge["5"] as PaBand;
  const grade = input.grade == null ? Number.NaN : Math.round(Number(input.grade));
  if (grade === 1) return lists.placement.byGrade["1"] as PaBand;
  if (Number.isFinite(grade) && grade >= 2) return lists.placement.older as PaBand;
  return "WA";
}

export function startCard(grade: number, age?: number | null): PaCard {
  const rounded = Math.round(grade);
  const stored = Number.isFinite(rounded) ? rounded : 0;
  return paCard(startBand({ age, grade: stored }), 0, stored);
}

function finiteIndex(value: number | null | undefined): number | undefined {
  if (value == null) return undefined;
  const index = Number(value);
  if (!Number.isInteger(index) || index < 0) return undefined;
  return index;
}

/** Item id or the spoken prompt. The prompt is what a climb stores in current_prompt. */
function itemIndex(band: PaBand, word: string): number {
  const items = bandItems(band);
  const trimmed = word.trim().toLowerCase();
  if (!trimmed) return -1;
  const byId = items.findIndex((item) => (item.id ?? "") === trimmed);
  if (byId >= 0) return byId;
  return items.findIndex((item) => (item.say ?? "").trim().toLowerCase() === trimmed);
}

/**
 * A saved band wins, including a levelCode that is a band id.
 * A positive index stays on that item. It is never folded back to the start.
 * Index 0 is the start only when the saved word does not name a later item.
 * The word may be the item id or the prompt sentence.
 * With no saved band, age and grade choose the band, at the first item.
 */
export function cardFromAccount(
  input: {
    grade?: number;
    age?: number | null;
    band?: string | null;
    index?: number | null;
    levelCode?: string | null;
    word?: string | null;
  } | null | undefined,
  fallbackGrade: number,
): PaCard {
  const raw = input?.grade ?? fallbackGrade;
  const rounded = Math.round(Number(raw));
  const grade = Number.isFinite(rounded) ? rounded : 0;
  const saved = isPaBand(input?.band) ? input.band : isPaBand(input?.levelCode) ? input.levelCode : undefined;
  const band = saved ?? startBand({ age: input?.age, grade: Number.isFinite(rounded) ? rounded : Number.NaN });
  const explicit = saved ? finiteIndex(input?.index) : undefined;
  let index = 0;
  if (saved && explicit != null && explicit > 0) {
    index = explicit;
  } else if (saved && input?.word) {
    const found = itemIndex(band, input.word);
    if (found >= 0) index = found;
    else if (explicit != null) index = explicit;
  } else if (explicit != null) {
    index = explicit;
  }
  return paCard(band, index, grade);
}

export type PaMove = "up" | "down" | "stay";

/**
 * Two correct answers in a row move up one band. Two misses in a row move down one band.
 * One miss stays. The first band does not move down. The last band does not move up.
 * The grade number stays. The next item is the next one in the band, or the first item of the new band.
 * A band is all 8 items. The index wraps only after each of them has been used.
 * roundSize is the website review window and is not a cap on this cycle.
 */
export function nextAfterAnswer(
  state: { band: PaBand; index: number; grade: number; correctStreak: number; missStreak: number },
  correct: boolean,
): { band: PaBand; index: number; grade: number; correctStreak: number; missStreak: number; move: PaMove } {
  const at = PA_BANDS.indexOf(state.band);
  let correctStreak = correct ? state.correctStreak + 1 : 0;
  let missStreak = correct ? 0 : state.missStreak + 1;
  let band = state.band;
  let move: PaMove = "stay";
  let index = state.index;
  const count = Math.max(1, bandMeta(state.band).count);
  if (correct && correctStreak >= PA_RISE_AFTER) {
    correctStreak = 0;
    missStreak = 0;
    if (at < PA_BANDS.length - 1) {
      band = PA_BANDS[at + 1]!;
      index = 0;
      move = "up";
    } else {
      index = (state.index + 1) % count;
    }
  } else if (!correct && missStreak >= PA_DROP_AFTER) {
    correctStreak = 0;
    missStreak = 0;
    if (at > 0) {
      band = PA_BANDS[at - 1]!;
      index = 0;
      move = "down";
    } else {
      index = (state.index + 1) % count;
    }
  } else {
    index = (state.index + 1) % count;
  }
  return { band, index, grade: state.grade, correctStreak, missStreak, move };
}

export function paPrompt(band: PaBand, index: number, grade = 1): {
  id: string;
  stem: string;
  answer: string;
  aliases: string[];
  standard: string;
  note: string;
} {
  const card = paCard(band, index, grade);
  return {
    id: `pa:${card.band}:${card.index}`,
    stem: card.say,
    answer: card.answer,
    aliases: card.also,
    standard: card.band,
    note: card.name,
  };
}

export function phonemeSpeak(): Record<string, string[]> {
  return lists.phonemeSpeak;
}

export function canonicalBands(): { id: string; name: string; grade: string; count: number; first: string; last: string }[] {
  return BANDS.map((band) => {
    const items = band.items ?? [];
    return {
      id: band.id ?? "",
      name: band.name ?? "",
      grade: band.grade ?? "",
      count: items.length,
      first: items[0]?.id ?? "",
      last: items[items.length - 1]?.id ?? "",
    };
  });
}
