import lists from "./data.json" with { type: "json" };
import { BAND_LABELS, SIGHT_WORD_BANDS, isSightBand, startBandForGrade, type SightBand } from "../constants.ts";

type RawWord = { word?: string; heart?: number[]; also?: string[] };

const LISTS = lists as Record<SightBand, RawWord[]>;
const NO_HEART: number[] = [];
const NO_ALSO: string[] = [];

export type SightWord = {
  word: string;
  heart: number[];
  also: string[];
};

export type SightCard = SightWord & {
  band: SightBand;
  index: number;
  grade: number;
  label: string;
};

function asWord(raw: RawWord | undefined): SightWord {
  return {
    word: raw?.word ?? "",
    heart: Array.isArray(raw?.heart) ? raw.heart : NO_HEART,
    also: Array.isArray(raw?.also) ? raw.also : NO_ALSO,
  };
}

export function bandWords(band: SightBand): readonly string[] {
  return LISTS[band].map((entry) => entry.word ?? "");
}

export function wordEntry(band: SightBand, index: number): SightWord & { index: number } {
  const words = LISTS[band];
  const count = words.length;
  const at = count === 0 ? 0 : ((Math.trunc(index) % count) + count) % count;
  return { ...asWord(words[at]), index: at };
}

/** Heart letters in index order, spaces between letters, as the canonical list prints them. */
export function heartLetters(word: string, heart: readonly number[]): string {
  return heart.map((index) => word[index] ?? "").join(" ");
}

export function entryFor(band: string | null | undefined, index: number, word: string): SightWord {
  const listsToScan: SightWord[][] = [];
  if (isSightBand(band)) listsToScan.push(LISTS[band].map((entry) => asWord(entry)));
  for (const id of SIGHT_WORD_BANDS) {
    if (id !== band) listsToScan.push(LISTS[id].map((entry) => asWord(entry)));
  }
  if (isSightBand(band)) {
    const at = wordEntry(band, index);
    if (at.word === word) return at;
  }
  for (const list of listsToScan) {
    const found = list.find((entry) => entry.word === word);
    if (found) return found;
  }
  return { word, heart: NO_HEART, also: NO_ALSO };
}

export function sightCard(band: SightBand, index: number, grade: number): SightCard {
  const entry = wordEntry(band, index);
  return { ...entry, band, grade, label: BAND_LABELS[band] };
}

export function startCard(grade: number): SightCard {
  const rounded = Math.round(grade);
  const stored = Number.isFinite(rounded) ? rounded : 0;
  return sightCard(startBandForGrade(grade), 0, stored);
}

/** The next word. A miss does not stay and does not move backward. The last band repeats. */
export function nextCard(band: SightBand, index: number, grade: number): SightCard {
  const words = LISTS[band];
  if (index + 1 < words.length) return sightCard(band, index + 1, grade);
  const at = SIGHT_WORD_BANDS.indexOf(band);
  const next = SIGHT_WORD_BANDS[at + 1];
  if (!next) return sightCard(band, 0, grade);
  return sightCard(next, 0, grade);
}

/**
 * A saved band wins. Otherwise a levelCode that is a band id wins.
 * Otherwise the grade-to-start-band map chooses the list, at the first word.
 */
export function cardFromAccount(
  input: { grade?: number; band?: string | null; index?: number | null; levelCode?: string | null } | null | undefined,
  fallbackGrade: number,
): SightCard {
  const raw = input?.grade ?? fallbackGrade;
  const rounded = Math.round(Number(raw));
  const grade = Number.isFinite(rounded) ? rounded : 0;
  const saved = isSightBand(input?.band) ? input.band : isSightBand(input?.levelCode) ? input.levelCode : undefined;
  const band = saved ?? startBandForGrade(Number.isFinite(rounded) ? rounded : Number.NaN);
  const index = saved && Number.isInteger(input?.index) && (input?.index ?? 0) >= 0 ? Number(input?.index) : 0;
  return sightCard(band, index, grade);
}

export function sightPrompt(band: SightBand, index: number, grade = 1): {
  id: string;
  stem: string;
  answer: string;
  aliases: string[];
  standard: string;
  note: string;
} {
  const card = sightCard(band, index, grade);
  return {
    id: `sw:${card.band}:${card.index}`,
    stem: card.word,
    answer: card.word,
    aliases: card.also,
    standard: card.band,
    note: card.label,
  };
}
