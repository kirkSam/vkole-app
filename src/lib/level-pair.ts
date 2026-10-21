/**
 * The website family level object.
 * The same object is at family.levels.<engine>, family.level.<engine>, and family.progress.<engine>.
 *
 * grade and step are the working level. Questions use them. step is 0, 1, or 2.
 * earnedGrade is the earned grade. earned.grade is the fallback when earnedGrade is missing.
 * A missing earned grade does not replace the earned grade already stored.
 */

export type WorkingLevel = {
  grade: number;
  step: number;
  label?: string;
};

export type EarnedLevel = {
  grade: number;
};

export type LevelPair = {
  working: WorkingLevel;
  /** Null when the payload did not name an earned grade. */
  earned: EarnedLevel | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function wholeIn(value: unknown, min: number, max: number): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  const rounded = Math.round(n);
  if (!Number.isInteger(rounded) || rounded < min || rounded > max) return null;
  return rounded;
}

/** Read one engine object. Top-level grade and step win. Then working.grade and working.step. */
export function readLevelPair(level: unknown): LevelPair {
  const row = asRecord(level) ?? {};
  const workingRow = asRecord(row.working);
  const earnedRow = asRecord(row.earned);
  const grade = wholeIn(row.grade, 1, 12) ?? wholeIn(workingRow?.grade, 1, 12) ?? 1;
  const step = wholeIn(row.step, 0, 2) ?? wholeIn(workingRow?.step, 0, 2) ?? 0;
  const label = typeof workingRow?.label === "string" && workingRow.label.trim() ? workingRow.label.trim() : undefined;
  const earnedGrade = wholeIn(row.earnedGrade, 1, 12) ?? wholeIn(earnedRow?.grade, 1, 12);
  return {
    working: { grade, step, ...(label ? { label } : {}) },
    earned: earnedGrade == null ? null : { grade: earnedGrade },
  };
}

/**
 * Fields sent on a family write.
 * grade and step stay the working level. earnedGrade is sent when this app knows it.
 */
export function levelFieldsForWebsite(level: unknown): {
  grade: number;
  step: number;
  earnedGrade?: number;
  working: WorkingLevel;
  earned?: EarnedLevel;
} {
  const pair = readLevelPair(level);
  const row = asRecord(level);
  const storedLabel = typeof row?.levelLabel === "string" ? row.levelLabel.trim() : "";
  const label = pair.working.label || storedLabel || `Grade ${pair.working.grade}`;
  const working: WorkingLevel = { grade: pair.working.grade, step: pair.working.step, label };
  if (!pair.earned) {
    return { grade: pair.working.grade, step: pair.working.step, working };
  }
  return {
    grade: pair.working.grade,
    step: pair.working.step,
    earnedGrade: pair.earned.grade,
    working,
    earned: { grade: pair.earned.grade },
  };
}
