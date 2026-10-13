import { SUBJECTS, type SubjectId } from "../../../src/lib/climb-rules.ts";
import { capVkoleGrade, moveVkoleRung } from "../../../src/lib/vkole-cap.ts";

export type WorksheetItem = {
  id: string;
  stem: string;
  options: string[];
  answer: string;
};

export type Rung = {
  grade: number;
  step: number;
  correctAtLevel: number;
  incorrectStreak: number;
};

export const SHEET_LENGTH = 6;

export function freshRung(grade: number): Rung {
  return {
    grade: capVkoleGrade(grade),
    step: 0,
    correctAtLevel: 0,
    incorrectStreak: 0,
  };
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(rng: () => number, items: string[]): string[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy;
}

function choice(rng: () => number, stem: string, answer: string, wrongs: string[]): WorksheetItem {
  const unique = [answer];
  for (const wrong of wrongs) {
    if (!unique.includes(wrong)) unique.push(wrong);
  }
  let extra = 1;
  while (unique.length < 4) {
    const numeric = Number(answer);
    const candidate =
      Number.isFinite(numeric) && String(numeric) === answer ? String(numeric + extra) : `${answer} (${extra})`;
    extra += 1;
    if (!unique.includes(candidate)) unique.push(candidate);
  }
  const options = shuffle(rng, unique.slice(0, 4));
  return { id: stem, stem, options, answer };
}

function mathItem(grade: number, rng: () => number, index: number): WorksheetItem {
  const a = 2 + Math.floor(rng() * 8);
  const b = 1 + Math.floor(rng() * 8);
  if (grade <= 2) {
    const sum = a + b;
    return choice(rng, `${a} + ${b} =`, String(sum), [String(sum + 1), String(sum - 1), String(a + b + 2)]);
  }
  if (grade === 3) {
    const product = a * b;
    return choice(rng, `${a} × ${b} =`, String(product), [
      String(product + a),
      String(product - b),
      String(a + b),
    ]);
  }
  if (grade === 4) {
    return choice(rng, "1/2 + 1/4 =", "3/4", ["1/4", "2/4", "2/6"]);
  }
  if (grade === 5) {
    return choice(rng, "0.5 + 0.25 =", "0.75", ["0.7", "0.55", "1.25"]);
  }
  if (grade === 6) {
    return choice(rng, "The ratio 2:4 equals which ratio?", "1:2", ["2:1", "4:2", "1:4"]);
  }
  if (grade <= 8) {
    const x = 2 + (index % 5);
    return choice(rng, `${a}x = ${a * x}. x =`, String(x), [String(x + 1), String(a), String(x + a)]);
  }
  const x = 3 + (index % 4);
  return choice(rng, `If y = ${a}x and x = ${x}, y =`, String(a * x), [
    String(a + x),
    String(a * x + 1),
    String(x),
  ]);
}

const ELA: Array<(rng: () => number) => WorksheetItem> = [
  (rng) =>
    choice(
      rng,
      "Read: Mira put the red cup on the high shelf. She stood on a stool to reach it.\n\nQuestion: Where is the cup?",
      "on the high shelf",
      ["under the stool", "in the sink", "outside"],
    ),
  (rng) => choice(rng, "Which word is a noun?", "shelf", ["climb", "quickly", "and"]),
  (rng) => choice(rng, "A sentence begins with", "a capital letter", ["a comma", "a question mark", "a period"]),
  (rng) =>
    choice(
      rng,
      "Read: The trail was steep, so Jo took small steps.\n\nQuestion: Why did Jo take small steps?",
      "The trail was steep",
      ["Jo was at home", "The trail was flat", "Jo had finished"],
    ),
];

const SS: Array<(rng: () => number) => WorksheetItem> = [
  (rng) => choice(rng, "How many branches does the United States government have?", "3", ["2", "4", "13"]),
  (rng) => choice(rng, "The Declaration of Independence was adopted in", "1776", ["1492", "1865", "1969"]),
  (rng) => choice(rng, "A compass rose on a map shows", "direction", ["population", "rainfall", "time zones"]),
  (rng) =>
    choice(rng, "Which is a job of a citizen when called?", "serving on a jury", ["making a private law", "closing a school", "printing money"]),
];

const GEN: Array<(rng: () => number) => WorksheetItem> = [
  (rng) => choice(rng, "Ice is water in which state?", "solid", ["gas only", "a metal", "a shadow"]),
  (rng) => choice(rng, "A food chain begins with", "a plant", ["a fox", "a rock", "a cloud"]),
  (rng) => choice(rng, "Earth travels around", "the sun", ["the moon", "Mars", "a star named North"]),
  (rng) => choice(rng, "The heart's job is to", "pump blood", ["digest food", "see color", "grow hair"]),
];

function fromBank(bank: Array<(rng: () => number) => WorksheetItem>, rng: () => number, index: number): WorksheetItem {
  const item = bank[index % bank.length]!(rng);
  return { ...item, id: `${item.stem}#${index}` };
}

export function buildWorksheet(subject: SubjectId, grade: number, seed: number): WorksheetItem[] {
  const level = capVkoleGrade(grade);
  const rng = mulberry32(seed || 1);
  const items: WorksheetItem[] = [];
  for (let index = 0; index < SHEET_LENGTH; index += 1) {
    if (subject === "m") items.push({ ...mathItem(level, rng, index), id: `m-${level}-${seed}-${index}` });
    else if (subject === "ela") items.push(fromBank(ELA, rng, index));
    else if (subject === "ss") items.push(fromBank(SS, rng, index));
    else items.push(fromBank(GEN, rng, index));
  }
  return items;
}

export function applyAnswers(rung: Rung, correctFlags: readonly boolean[]): { rung: Rung; note: string } {
  let current = { ...rung };
  for (const correct of correctFlags) {
    const moved = moveVkoleRung({
      grade: current.grade,
      step: current.step,
      correct,
      correctStreak: current.correctAtLevel,
      missStreak: current.incorrectStreak,
    });
    current = {
      grade: moved.grade,
      step: moved.step,
      correctAtLevel: moved.correctAtLevel,
      incorrectStreak: moved.incorrectStreak,
    };
  }
  const note = current.grade === rung.grade && current.step === rung.step
    ? `Still grade ${current.grade}, standard ${current.step + 1}.`
    : `Now grade ${current.grade}, standard ${current.step + 1}.`;
  return { rung: current, note };
}

export function practiceShareText(input: {
  subjectName: string;
  grade: number;
  correct: number;
  total: number;
}): string {
  return `Offline practice on this device: ${input.subjectName}, grade ${input.grade}. ${input.correct} of ${input.total} correct. This does not update the school office.`;
}

export function subjectName(id: SubjectId): string {
  return SUBJECTS.find((subject) => subject.id === id)?.name ?? id;
}

export { SUBJECTS, type SubjectId };
