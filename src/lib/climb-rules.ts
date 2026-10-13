export const SUBJECTS = [
  { id: "m", code: "M", name: "Mathematics" },
  { id: "ela", code: "ELA", name: "English language arts" },
  { id: "ss", code: "SS", name: "History and social studies" },
  { id: "gen", code: "gen", name: "General" },
] as const;

export type SubjectId = (typeof SUBJECTS)[number]["id"];

export const GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as const;

export type ClimbState = {
  level: number;
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

export function applyAnswer(state: ClimbState, correct: boolean): { state: ClimbState; move: string } {
  const next: ClimbState = {
    level: state.level,
    correctAtLevel: state.correctAtLevel,
    incorrectStreak: state.incorrectStreak,
    asked: state.asked + 1,
    rightCount: state.rightCount,
  };
  if (correct) {
    next.rightCount += 1;
    next.incorrectStreak = 0;
    next.correctAtLevel += 1;
    if (next.correctAtLevel >= 2) {
      next.level += 1;
      next.correctAtLevel = 0;
      return { state: next, move: `Two correct. Climbed to ${levelLabel(next.level)}.` };
    }
    return { state: next, move: "Stay on this level until one more correct answer." };
  }
  next.incorrectStreak += 1;
  if (next.incorrectStreak >= 2) {
    if (next.level > 0) next.level -= 1;
    next.incorrectStreak = 0;
    next.correctAtLevel = 0;
    const move =
      state.level > 0
        ? `Two misses in a row. Dropped to ${levelLabel(next.level)}.`
        : "Two misses in a row. Already at Kindergarten, so the floor holds.";
    return { state: next, move };
  }
  return {
    state: next,
    move: `One miss stays on this level. Miss streak ${next.incorrectStreak} of 2.`,
  };
}
