import { moveVkoleRung } from "./vkole-cap.ts";

const STAGE_WORD = ["concrete", "pictorial", "abstract"] as const;

export const SUBJECTS = [
  {
    id: "m",
    code: "M",
    name: "Mathematics",
    lede: "Math questions are drawn from Common Core mathematics standards. A parent or teacher enters the grade. That grade starts at standard 1. Two correct answers move one standard. The grade number changes only after the third standard.",
  },
  {
    id: "ela",
    code: "ELA",
    name: "English language arts",
    lede: "Reading and language questions are drawn from Common Core ELA standards. Each grade has three standards. Two correct answers move one standard. One incorrect answer stays. Two incorrect answers in a row move down one standard.",
  },
  {
    id: "ss",
    code: "SS",
    name: "History and social studies",
    lede: "History and social studies use three standards in each grade. Two correct answers move one standard. The grade number changes only after the third standard, or when standard 1 is missed two times. Grade 12 is the top. Grade 12 questions continue on a rotation.",
  },
  {
    id: "gen",
    code: "gen",
    name: "General",
    lede: "General uses three standards in each grade: science, numbers, and civics. Two correct answers move one standard, not a whole grade. Mathematics, English language arts, and history stay in their own engines.",
  },
  {
    id: "sg",
    code: "Singapore",
    name: "Singapore mathematics",
    lede: "US grades 1–12 are P1–P6, S1–S4, AM (Additional Mathematics), and H2 (H1 and H2 Mathematics). Each topic goes concrete, then pictorial, then abstract. Two correct answers move up one step. The grade changes only after the abstract step.",
  },
  {
    id: "sw",
    code: "SW",
    name: "Sight words",
    lede: "A large word is shown. The microphone listens only while that word is on the screen, and it does not record or save the sound. A correct word gets a sparkle, then the next word. A miss is spoken aloud, then the next word.",
  },
] as const;

export type SubjectId = (typeof SUBJECTS)[number]["id"];

export const GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as const;

export type ClimbState = {
  level: number;
  step: number;
  correctAtLevel: number;
  incorrectStreak: number;
  asked: number;
  rightCount: number;
};

export function isSubject(value: string): value is SubjectId {
  return SUBJECTS.some((s) => s.id === value);
}

export function subjectMeta(id: SubjectId) {
  const found = SUBJECTS.find((s) => s.id === id);
  if (!found) throw new Error("Unknown subject");
  return found;
}

export function levelLabel(level: number): string {
  if (level <= 0) return "Grade K";
  return `Grade ${Math.min(12, level)}`;
}

/** Same three-step move as the website. Two correct answers rise one step, not a whole grade. */
export function applyAnswer(state: ClimbState, correct: boolean): { state: ClimbState; move: string } {
  const beforeGrade = Math.min(12, Math.max(1, Math.round(state.level) || 1));
  const beforeStep = Math.min(2, Math.max(0, Math.round(state.step) || 0));
  const moved = moveVkoleRung({
    grade: beforeGrade,
    step: beforeStep,
    correct,
    correctStreak: state.correctAtLevel,
    missStreak: state.incorrectStreak,
  });
  const next: ClimbState = {
    level: moved.grade,
    step: moved.step,
    correctAtLevel: moved.correctAtLevel,
    incorrectStreak: moved.incorrectStreak,
    asked: state.asked + 1,
    rightCount: state.rightCount + (correct ? 1 : 0),
  };
  const after = STAGE_WORD[moved.step] ?? "concrete";
  const before = STAGE_WORD[beforeStep] ?? "concrete";
  const triedDown = !correct && state.incorrectStreak + 1 >= 2;
  const stayed = moved.grade === beforeGrade && moved.step === beforeStep;
  let move: string;
  if (moved.capped) {
    move = "Two correct answers in a row. Grade 12 is the top. The next questions stay on grade 12 and rotate.";
  } else if (moved.grade > beforeGrade) {
    move = `Two correct answers on the abstract step. The level moves up to grade ${moved.grade}, concrete.`;
  } else if (moved.step > beforeStep) {
    move = `Two correct answers in a row. The next question is one step up: ${after}.`;
  } else if (triedDown && stayed) {
    move = "Two incorrect answers in a row. This is the first step, so it stays on concrete.";
  } else if (moved.grade < beforeGrade || moved.step < beforeStep) {
    move = `Two incorrect answers in a row. The next question is one step down: ${after}.`;
  } else if (correct) {
    move = `Correct. One more on ${before}, then it rises one step.`;
  } else {
    move = `Not correct. That stays on ${before}. Miss ${moved.incorrectStreak} of 2.`;
  }
  return { state: next, move };
}
