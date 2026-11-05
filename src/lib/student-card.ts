import type { FamilyStudent } from "@/lib/school-account";

/** Second slot when the family has not registered a second student. A tap does nothing. */
export const OPEN_ACCT_LABEL = "Open acct.";

/** Shown when a parent adds a child. The words stay exact, same as the website. */
export const SAME_PLACE_LINE =
  "Pick the same place for the same child on the app and the website.";

export const PICK_PLACE_LINE = "Pick Student 1 or Student 2.";

/** A used place: "Student 1, Ada". An empty place: "Student 1, open". The name is from this side only. */
export function placeChoiceLabel(slot: 1 | 2, childName: string): string {
  const who = childName.trim().replace(/\s+/g, " ");
  return who ? `Student ${slot}, ${who}` : `Student ${slot}, open`;
}

export function placeTakenMessage(place: 1 | 2): string {
  return place === 1 ? "Student 1 is taken." : "Student 2 is taken.";
}

/** An empty Student 1 or Student 2 place, when a parent is adding a child. */
export const OPEN_PLACE_LABEL = "open";

export type StudentPlaceChoice = { index: 1 | 2; name: string; open: boolean };

/** Two places. A used place shows the child's name. An empty place says "open". */
export function studentPlaceChoices(students: { index: number; name: string }[]): [StudentPlaceChoice, StudentPlaceChoice] {
  return ([1, 2] as const).map((index) => {
    const named = students.find((student) => student.index === index && student.name.trim());
    const name = named?.name.trim() ?? "";
    return name
      ? { index, name, open: false }
      : { index, name: OPEN_PLACE_LABEL, open: true };
  }) as [StudentPlaceChoice, StudentPlaceChoice];
}

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

/** Keep every place. A name stays with the side that saved it. An index with no name is still in use. */
export function mergeFamilyStudents(...lists: (FamilyStudent[] | undefined | null)[]): FamilyStudent[] {
  const byIndex = new Map<number, FamilyStudent>();
  for (const list of lists) {
    for (const student of list ?? []) {
      if (!student || !Number.isInteger(student.index) || student.index < 1) continue;
      const name = student.name?.trim() ?? "";
      const prev = byIndex.get(student.index);
      if (!name) {
        if (!prev) byIndex.set(student.index, { index: student.index, name: "", age: null, startingGrade: null });
        continue;
      }
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
