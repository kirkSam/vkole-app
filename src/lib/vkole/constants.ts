/**
 * Shared VKOLE sight-word constants.
 * Engine key `sw`. Band order and grade labels match docs/sight-words-website-canonical.md.
 */

export const SIGHT_WORD_ENGINE = "sw" as const;

export const SIGHT_WORD_ADVANCE_MS = 2000;
export const SIGHT_WORD_MAX_SHOW_MS = 20000;

export const SIGHT_WORD_NOTE =
  "A word stays up for at most 20 seconds. A correct reading gets a sparkle, then the next word after 2 seconds. A miss is spoken aloud, and the next word comes 2 seconds after the speech ends. The word is not tried again. The microphone is on only while a word is shown. The sound is not recorded or saved.";

export const SIGHT_WORD_BANDS = [
  "D-PP",
  "D-P",
  "D-1",
  "D-2",
  "D-3",
  "D-N",
  "F-1",
  "F-2",
  "F-3",
  "F-4",
  "F-5",
  "F-6",
  "F-7",
  "F-8",
  "F-9",
  "F-10",
] as const;

export type SightBand = (typeof SIGHT_WORD_BANDS)[number];

/** Grade label printed with each band in the canonical list. */
export const BAND_LABELS: Record<SightBand, string> = {
  "D-PP": "Pre-K",
  "D-P": "K",
  "D-1": "1st",
  "D-2": "2nd",
  "D-3": "3rd",
  "D-N": "K-3",
  "F-1": "K-1",
  "F-2": "1st-2nd",
  "F-3": "1st-2nd",
  "F-4": "2nd-3rd",
  "F-5": "2nd-3rd",
  "F-6": "3rd-4th",
  "F-7": "3rd-4th",
  "F-8": "4th-5th",
  "F-9": "4th-5th",
  "F-10": "4th-5th",
};

export function isSightBand(value: string | undefined | null): value is SightBand {
  return !!value && (SIGHT_WORD_BANDS as readonly string[]).includes(value);
}

/**
 * Band a student starts on for a numeric grade.
 * Round to the nearest integer. Below 1, or not a number, starts at D-PP.
 * 1 → D-1, 2 → D-2, 3 → D-3, 4 → F-6, 5 and above → F-8.
 * A saved band, or a levelCode that is a band id, wins over this map.
 */
export function startBandForGrade(grade: number): SightBand {
  const rounded = Math.round(grade);
  if (!Number.isFinite(rounded) || rounded < 1) return "D-PP";
  if (rounded === 1) return "D-1";
  if (rounded === 2) return "D-2";
  if (rounded === 3) return "D-3";
  if (rounded === 4) return "F-6";
  return "F-8";
}

/** Earned grades on the account stay inside the app's 1–12 ladder. */
export function clampSightGrade(grade: number): number {
  const level = Math.round(grade);
  if (!Number.isFinite(level)) return 1;
  return Math.min(12, Math.max(1, level));
}
