import type { SubjectId } from "./climb-rules.ts";
import { questionKey } from "./next-sheet.ts";
import { elaCell } from "./pool-ela.ts";
import { genCell } from "./pool-gen.ts";
import { mathCell } from "./pool-math.ts";
import { type Cell } from "./pool-shared.ts";
import { sgCell } from "./vkole-singapore-pool.ts";
import { ssCell } from "./pool-ss.ts";
import { BAND_LABELS, startBandForGrade, type SightBand } from "./vkole/constants.ts";
import { bandWords } from "./vkole/sight-words/words.ts";

export type PoolQuestion = {
  id: string;
  stem: string;
  answer: string;
  aliases: string[];
  standard: string;
  note: string;
};

export type BagState = {
  order: number[];
};

export const RECENT_WINDOW = 50;

const cache = new Map<string, Cell>();

function clampGrade(grade: number): number {
  if (!Number.isFinite(grade)) return 1;
  return Math.min(12, Math.max(1, Math.round(grade)));
}

function clampStep(step: number): number {
  if (!Number.isFinite(step)) return 0;
  return Math.min(2, Math.max(0, Math.round(step)));
}

function withRoom(cell: Cell): Cell {
  if (cell.count >= 50) return cell;
  const leads = ["", "Choose the best answer.", "Read each choice before you write."];
  return {
    count: cell.count * leads.length,
    build(index) {
      const lead = leads[index % leads.length]!;
      const inner = cell.build(Math.floor(index / leads.length));
      return { ...inner, stem: lead ? `${lead}\n${inner.stem}` : inner.stem };
    },
  };
}

function swCell(grade: number): Cell {
  const band: SightBand = startBandForGrade(grade);
  const words = bandWords(band);
  return {
    count: Math.max(1, words.length),
    build(index) {
      const word = words[index % words.length] ?? "";
      return { stem: word, answer: word, standard: band, note: BAND_LABELS[band] };
    },
  };
}

function cellFor(subject: SubjectId, grade: number, step: number): Cell {
  const key = `${subject}:${grade}:${step}`;
  const saved = cache.get(key);
  if (saved) return saved;
  if (subject === "sw") {
    const cell = swCell(grade);
    cache.set(key, cell);
    return cell;
  }
  const raw =
    subject === "m"
      ? mathCell(grade, step)
      : subject === "ela"
        ? elaCell(grade, step)
        : subject === "ss"
          ? ssCell(grade, step)
          : subject === "sg"
            ? sgCell(grade, step)
            : genCell(grade, step);
  const cell = withRoom(raw);
  cache.set(key, cell);
  return cell;
}

export function poolCount(subject: SubjectId, grade: number, step: number): number {
  return cellFor(subject, clampGrade(grade), clampStep(step)).count;
}

export function poolQuestion(subject: SubjectId, grade: number, step: number, index: number): PoolQuestion {
  const level = clampGrade(grade);
  const rung = clampStep(step);
  const cell = cellFor(subject, level, rung);
  const count = cell.count;
  const wrapped = ((Math.trunc(index) % count) + count) % count;
  const built = cell.build(wrapped);
  return {
    id: `${subject}:${level}:${rung}:${wrapped}`,
    stem: built.stem.replace(/\s+\n/g, "\n").trim(),
    answer: built.answer.trim(),
    aliases: (built.aliases ?? []).map((alias) => alias.trim()).filter(Boolean),
    standard: built.standard,
    note: built.note,
  };
}

export type PoolCensus = {
  subjects: Record<SubjectId, { total: number; grades: Record<number, [number, number, number]> }>;
  total: number;
};

export function poolCensus(): PoolCensus {
  const subjects = ["m", "ela", "ss", "gen", "sg"] as const;
  const report = {
    subjects: {
      m: { total: 0, grades: {} },
      ela: { total: 0, grades: {} },
      ss: { total: 0, grades: {} },
      gen: { total: 0, grades: {} },
      sg: { total: 0, grades: {} },
      sw: { total: 0, grades: {} },
    },
    total: 0,
  } as PoolCensus;
  for (const subject of subjects) {
    for (let grade = 1; grade <= 12; grade += 1) {
      const steps: [number, number, number] = [poolCount(subject, grade, 0), poolCount(subject, grade, 1), poolCount(subject, grade, 2)];
      report.subjects[subject].grades[grade] = steps;
      const sum = steps[0] + steps[1] + steps[2];
      report.subjects[subject].total += sum;
      report.total += sum;
    }
  }
  return report;
}

export function parseVariantId(id: string): { subject: SubjectId; grade: number; step: number; index: number } | null {
  const matched = /^(m|ela|ss|gen|sg):(\d+):(\d+):(\d+)$/.exec(id.trim());
  if (!matched) return null;
  return {
    subject: matched[1] as SubjectId,
    grade: Number(matched[2]),
    step: Number(matched[3]),
    index: Number(matched[4]),
  };
}

function shuffle(items: number[], random: () => number): number[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy;
}

function refill(count: number, recent: ReadonlySet<number>): number[] {
  const fresh: number[] = [];
  for (let index = 0; index < count; index += 1) {
    if (!recent.has(index)) fresh.push(index);
  }
  if (fresh.length > 0) return fresh;
  return Array.from({ length: count }, (_, index) => index);
}

/** Deal the next variant from a shuffle bag, skipping anything still in the recent window until the pool is used up. */
export function nextVariant(
  count: number,
  state: BagState | null,
  recent: ReadonlySet<number>,
  random: () => number = Math.random,
): { index: number; state: BagState } {
  if (count <= 0) throw new Error("This standard has no questions.");
  const queued = (state?.order ?? []).filter((index) => Number.isInteger(index) && index >= 0 && index < count);
  const freshQueued = queued.filter((index) => !recent.has(index));
  const order = freshQueued.length > 0 ? queued : shuffle(refill(count, recent), random);
  const index = order.find((item) => !recent.has(item)) ?? order[0]!;
  return { index, state: { order: order.filter((item) => item !== index) } };
}

function tokens(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function jaccard(left: string[], right: string[]): number {
  const a = new Set(left);
  const b = new Set(right);
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  const union = a.size + b.size - shared;
  return union === 0 ? 1 : shared / union;
}

export function nearDuplicate(candidate: string, recent: readonly string[]): boolean {
  const key = questionKey(candidate);
  if (!key) return false;
  for (const previous of recent) {
    if (!previous.trim()) continue;
    if (questionKey(previous) === key) return true;
    if (jaccard(tokens(candidate), tokens(previous)) >= 0.92) return true;
  }
  return false;
}

const UNSEEN_TEXT = /\b(the passage|this passage|the excerpt|the article|the story|the poem|the essay|the speech|paragraph \d+|the text above|the reading above)\b/i;

/** A model-written question is usable only when it carries its own text and is not a near-duplicate. */
export function generatedQuestionOk(prompt: string, recent: readonly string[]): boolean {
  const text = prompt.trim();
  if (text.length < 12) return false;
  if (UNSEEN_TEXT.test(text)) {
    const showsTheText = /read\s*:/i.test(text) || /[“"][^"”]{40,}[”"]/.test(text);
    if (!showsTheText) return false;
  }
  return !nearDuplicate(text, recent);
}

export function chooseNext(input: { modelPrompt?: string | null; recent: readonly string[]; pool: PoolQuestion; preferPool: boolean }): {
  prompt: string;
  fromPool: boolean;
} {
  if (input.preferPool) return { prompt: input.pool.stem, fromPool: true };
  const model = input.modelPrompt?.trim() ?? "";
  if (generatedQuestionOk(model, input.recent)) return { prompt: model, fromPool: false };
  return { prompt: input.pool.stem, fromPool: true };
}

function norm(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[−–—]/g, "-")
    .replace(/[^a-z0-9/\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function numericValue(text: string): number | null {
  const cleaned = text.trim().replace(/[−–—]/g, "-").replace(/,/g, "");
  if (/^[+-]?\d+$/.test(cleaned)) return Number(cleaned);
  if (/^[+-]?\d*\.\d+$/.test(cleaned)) return Number(cleaned);
  const fraction = /^([+-]?\d+)\s*\/\s*(\d+)$/.exec(cleaned);
  if (!fraction) return null;
  const denominator = Number(fraction[2]);
  if (denominator === 0) return null;
  return Number(fraction[1]) / denominator;
}

export function answersMatch(expected: string, given: string, aliases: readonly string[] = []): boolean {
  const got = norm(given);
  if (!got) return false;
  for (const option of [expected, ...aliases]) {
    const want = norm(option);
    if (want && want === got) return true;
    const left = numericValue(option);
    const right = numericValue(given);
    if (left != null && right != null && Math.abs(left - right) < 1e-6) return true;
  }
  return false;
}

export function keyedFeedback(answer: string, note: string): string {
  const explanation = note.trim() || "Use the same kind of step on the next question.";
  return `Answer:\n${answer}\n\nExplanation:\n${explanation}`;
}
