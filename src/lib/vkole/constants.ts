/**
 * Shared VKOLE sight-word constants.
 * Engine key `sw`. Bands are Dolch, then Fry.
 * A parent grade starts the student on that grade's band.
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

export const BAND_LABELS: Record<SightBand, string> = {
  "D-PP": "Dolch pre-primer",
  "D-P": "Dolch primer",
  "D-1": "Dolch grade 1",
  "D-2": "Dolch grade 2",
  "D-3": "Dolch grade 3",
  "D-N": "Dolch nouns",
  "F-1": "Fry 1-100",
  "F-2": "Fry 101-200",
  "F-3": "Fry 201-300",
  "F-4": "Fry 301-400",
  "F-5": "Fry 401-500",
  "F-6": "Fry 501-600",
  "F-7": "Fry 601-700",
  "F-8": "Fry 701-800",
  "F-9": "Fry 801-900",
  "F-10": "Fry 901-1000",
};

/** US grade labels. Grade K is not a starting grade on this engine. */
export const GRADE_LABELS: Record<number, string> = {
  1: "Grade 1",
  2: "Grade 2",
  3: "Grade 3",
  4: "Grade 4",
  5: "Grade 5",
  6: "Grade 6",
  7: "Grade 7",
  8: "Grade 8",
  9: "Grade 9",
  10: "Grade 10",
  11: "Grade 11",
  12: "Grade 12",
};

/**
 * Band a new student starts on when the parent sets that US grade.
 * Earlier bands are still visited when a student starts below that grade and climbs.
 * F-8, F-9, and F-10 come after the grade 12 start.
 */
export const GRADE_START_BAND: Record<number, SightBand> = {
  1: "D-PP",
  2: "D-1",
  3: "D-2",
  4: "D-3",
  5: "D-N",
  6: "F-1",
  7: "F-2",
  8: "F-3",
  9: "F-4",
  10: "F-5",
  11: "F-6",
  12: "F-7",
};

export function isSightBand(value: string | undefined | null): value is SightBand {
  return !!value && (SIGHT_WORD_BANDS as readonly string[]).includes(value);
}

export function clampSightGrade(grade: number): number {
  const level = Math.round(grade);
  if (!Number.isFinite(level)) return 1;
  return Math.min(12, Math.max(1, level));
}

/** Highest parent grade whose start band is this band or an earlier one. */
export function gradeForBand(band: SightBand): number {
  const at = SIGHT_WORD_BANDS.indexOf(band);
  let grade = 1;
  for (let g = 1; g <= 12; g += 1) {
    const start = GRADE_START_BAND[g];
    if (start && SIGHT_WORD_BANDS.indexOf(start) <= at) grade = g;
  }
  return grade;
}

export function gradeLabel(grade: number): string {
  return GRADE_LABELS[clampSightGrade(grade)] ?? "Grade 1";
}
