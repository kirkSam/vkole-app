import lists from "./data.json" with { type: "json" };
import {
  BAND_LABELS,
  GRADE_START_BAND,
  SIGHT_WORD_BANDS,
  clampSightGrade,
  gradeForBand,
  isSightBand,
  type SightBand,
} from "../constants.ts";

const WORDS = lists as Record<SightBand, string[]>;

export type SightCard = {
  word: string;
  band: SightBand;
  index: number;
  grade: number;
  label: string;
};

export function bandWords(band: SightBand): readonly string[] {
  return WORDS[band];
}

export function sightCard(band: SightBand, index: number): SightCard {
  const words = WORDS[band];
  const count = words.length;
  const at = count === 0 ? 0 : ((Math.trunc(index) % count) + count) % count;
  const word = words[at] ?? "";
  return { word, band, index: at, grade: gradeForBand(band), label: BAND_LABELS[band] };
}

export function startCard(grade: number): SightCard {
  const level = clampSightGrade(grade);
  return sightCard(GRADE_START_BAND[level] ?? "D-PP", 0);
}

/** The next word. A miss does not stay and does not move backward. The last Fry band repeats. */
export function nextCard(band: SightBand, index: number): SightCard {
  const words = WORDS[band];
  if (index + 1 < words.length) return sightCard(band, index + 1);
  const at = SIGHT_WORD_BANDS.indexOf(band);
  const next = SIGHT_WORD_BANDS[at + 1];
  if (!next) return sightCard(band, 0);
  return sightCard(next, 0);
}

export function cardFromAccount(input: { grade?: number; band?: string | null; index?: number | null } | null | undefined, fallbackGrade: number): SightCard {
  const grade = clampSightGrade(input?.grade ?? fallbackGrade);
  const band = isSightBand(input?.band) ? input.band : (GRADE_START_BAND[grade] ?? "D-PP");
  const index = Number.isInteger(input?.index) && (input?.index ?? 0) >= 0 ? Number(input?.index) : 0;
  return sightCard(band, index);
}

export function sightPrompt(band: SightBand, index: number): {
  id: string;
  stem: string;
  answer: string;
  aliases: string[];
  standard: string;
  note: string;
} {
  const card = sightCard(band, index);
  return {
    id: `sw:${card.band}:${card.index}`,
    stem: card.word,
    answer: card.word,
    aliases: [],
    standard: card.band,
    note: card.label,
  };
}
