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
    lede: "Primary 1 through pre-university H2, shown with US grades 1–12. Each topic goes concrete, then pictorial, then abstract. The level moves up only after the abstract step is correct.",
  },
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
