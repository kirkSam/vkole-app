import type { ReportEvent } from "./academic-email.ts";
import type { LevelKey } from "./school-account.ts";

/**
 * Body the app posts when it asks the school website to mail the session-end
 * parent report. `engine` is the display name already used in that report
 * (`VKOLE/M`, `VKOLE/Spelling`, and the rest). `subject` is the engine id
 * (`m`, `ela`, `ss`, `gen`, `sg`, `sw`, `pa`, `mg`, `sp`). The website uses
 * `subject` to choose the practice PDF. It does not replace `engine`.
 */
export type SessionEndReport = {
  name: string;
  email: string;
  engine: string;
  subject: LevelKey;
  startedAt: number;
  startingGrade: number;
  grade: number;
  code: string;
  label: string;
  reached: number;
  missed: number;
  trialEndsAt: number;
  lines: Record<string, unknown>[];
  sheet: string[];
  untimed?: boolean;
  usedMs?: number;
  remainingMs?: number;
  masteryText?: string;
};

export function sessionEndReport(input: SessionEndReport): SessionEndReport {
  return {
    ...input,
    engine: input.engine,
    subject: input.subject,
    lines: input.lines,
    sheet: input.sheet,
  };
}

/** One sitting line, from the event detail already stored for the letter. */
export function reportLine(event: ReportEvent): Record<string, unknown> {
  try {
    const row = JSON.parse(event.detail) as unknown;
    if (row && typeof row === "object" && !Array.isArray(row)) return row as Record<string, unknown>;
  } catch {
    /* Older rows stored a sentence. */
  }
  return { correct: event.correct === true };
}
