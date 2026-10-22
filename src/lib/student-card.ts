import type { FamilyStudent } from "@/lib/school-account";

/** Second slot when the family has not registered a second student. A tap does nothing. */
export const OPEN_ACCT_LABEL = "Open acct.";

export type StudentCardButton =
  | { kind: "student"; index: number; label: string; name: string }
  | { kind: "open"; label: typeof OPEN_ACCT_LABEL };

/** The first word of the saved name. Parents register a first name. */
export function firstNameOf(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  const space = trimmed.indexOf(" ");
  return space < 0 ? trimmed : trimmed.slice(0, space);
}

/**
 * Always two slots. One student: that first name, then "Open acct."
 * A second student replaces "Open acct." as soon as they are on the roster.
 */
export function studentCardButtons(students: { index: number; name: string }[]): [StudentCardButton, StudentCardButton] {
  const named = students
    .filter((student) => Number.isInteger(student.index) && student.index >= 1 && student.name.trim())
    .sort((a, b) => a.index - b.index);
  const first = named.find((student) => student.index === 1) ?? named[0];
  const second = named.find((student) => student.index === 2);
  const left: StudentCardButton = first
    ? { kind: "student", index: first.index, label: firstNameOf(first.name), name: first.name.trim() }
    : { kind: "open", label: OPEN_ACCT_LABEL };
  const right: StudentCardButton = second
    ? { kind: "student", index: second.index, label: firstNameOf(second.name), name: second.name.trim() }
    : { kind: "open", label: OPEN_ACCT_LABEL };
  return [left, right];
}

/** Keep every child. A later read for one child must not drop the other. */
export function mergeFamilyStudents(...lists: (FamilyStudent[] | undefined | null)[]): FamilyStudent[] {
  const byIndex = new Map<number, FamilyStudent>();
  for (const list of lists) {
    for (const student of list ?? []) {
      if (!student || !Number.isInteger(student.index) || student.index < 1) continue;
      const name = student.name?.trim() ?? "";
      if (!name) continue;
      const prev = byIndex.get(student.index);
      byIndex.set(student.index, {
        index: student.index,
        name,
        age: student.age ?? prev?.age ?? null,
        startingGrade: student.startingGrade ?? prev?.startingGrade ?? null,
      });
    }
  }
  return [...byIndex.values()].sort((a, b) => a.index - b.index);
}

export function acceptStudentSwitch(
  students: { index: number }[],
  index: number,
  master: boolean,
): "ok" | "missing" | "cap" {
  if (!Number.isInteger(index) || index < 1) return "missing";
  if (index > 2 && !master) return "cap";
  if (students.length > 0 && !students.some((student) => student.index === index)) return "missing";
  return "ok";
}

export type SiteOpening = {
  grade?: number;
  step?: number;
  name?: string;
  reached?: number;
  missed?: number;
  streak?: number;
  missStreak?: number;
  index?: number;
  completedExercises?: number[];
  startingGrade?: number;
};

/** The engine has moved this child. A copied starting grade is not enough. */
export function engineWorkedLevel(
  level: {
    grade?: number;
    step?: number;
    reached?: number;
    missed?: number;
    streak?: number;
    missStreak?: number;
    index?: number;
    completedExercises?: number[];
    startingGrade?: number | null;
  } | null | undefined,
): boolean {
  if (!level) return false;
  if ((level.completedExercises?.length ?? 0) > 0) return true;
  if ((level.reached ?? 0) > 0 || (level.missed ?? 0) > 0) return true;
  if ((level.streak ?? 0) > 0 || (level.missStreak ?? 0) > 0) return true;
  if ((level.step ?? 0) > 0 || (level.index ?? 0) > 0) return true;
  if (level.startingGrade != null && level.grade != null && level.grade !== level.startingGrade) return true;
  return false;
}

/**
 * A new child starts at the grade the registrant entered.
 * After an engine has developed that child's working level, later sessions resume it.
 * A level named for someone else, or tagged with another child's starting grade, is not used.
 */
export function openingForNewClimb(input: {
  studentName: string;
  formGrade?: number;
  formAge?: number;
  storedGrade: number | null;
  storedAge: number | null;
  site?: SiteOpening | null;
}): { grade: number; step: number; age: number; resumeSite: boolean } | null {
  const named = input.site?.name?.trim();
  const foreignName = !!named && named.toLowerCase() !== input.studentName.trim().toLowerCase();
  const foreignStart =
    input.site?.startingGrade != null && input.storedGrade != null && input.site.startingGrade !== input.storedGrade;
  const site = input.site && !foreignName && !foreignStart ? input.site : null;
  const start = input.storedGrade ?? site?.startingGrade ?? input.formGrade ?? null;
  const worked = site ? engineWorkedLevel({ ...site, startingGrade: site.startingGrade ?? start }) : false;
  const age = input.formAge ?? input.storedAge ?? null;
  if (age == null || !Number.isInteger(age) || age < 4 || age > 18) return null;
  if (worked && site?.grade != null && site.grade >= 1 && site.grade <= 12) {
    return {
      grade: Math.min(12, Math.max(1, Math.round(site.grade))),
      step: Math.max(0, Math.round(site.step ?? 0)),
      age,
      resumeSite: true,
    };
  }
  if (start == null || !Number.isInteger(start) || start < 1 || start > 12) return null;
  return { grade: start, step: 0, age, resumeSite: false };
}

/** Two children on one scope still show only the child who was just signed in. */
export function climbsForActiveStudent<T extends { childName: string }>(
  climbs: T[],
  students: { index: number; name: string }[],
  activeStudent: number,
): T[] {
  if (students.length < 2) return climbs;
  const active = students.find((student) => student.index === activeStudent);
  const key = active?.name.trim().toLowerCase();
  if (!key) return climbs;
  return climbs.filter((climb) => climb.childName.trim().toLowerCase() === key);
}
