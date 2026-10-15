/**
 * VKOLE Singapore curriculum spine.
 * Twelve one-grade bands, the same labels as the school website:
 * US 1–6 = P1–P6, US 7–10 = S1–S4, US 11 = AM (Additional Mathematics),
 * US 12 = H2 (H1 and H2 Mathematics). Public MOE structure only.
 * No publisher items.
 *
 * The same file shape is src/lib/school/vkole-singapore* on the school website.
 */

export const STAGES = ["concrete", "pictorial", "abstract"] as const;
export type Stage = (typeof STAGES)[number];

export const STRANDS = [
  { id: "number", name: "Number and algebra" },
  { id: "measure", name: "Measurement and geometry" },
  { id: "data", name: "Statistics" },
] as const;
export type StrandId = (typeof STRANDS)[number]["id"];

export const HEURISTICS = [
  { id: "bar-model", name: "Bar model" },
  { id: "work-backwards", name: "Work backwards" },
  { id: "guess-and-check", name: "Guess and check" },
  { id: "patterns", name: "Patterns" },
] as const;
export type HeuristicId = (typeof HEURISTICS)[number]["id"];

/** One band per US grade. Labels match the school website. */
export const BANDS = [
  { id: "p1", label: "P1", grades: [1] },
  { id: "p2", label: "P2", grades: [2] },
  { id: "p3", label: "P3", grades: [3] },
  { id: "p4", label: "P4", grades: [4] },
  { id: "p5", label: "P5", grades: [5] },
  { id: "p6", label: "P6", grades: [6] },
  { id: "s1", label: "S1", grades: [7] },
  { id: "s2", label: "S2", grades: [8] },
  { id: "s3", label: "S3", grades: [9] },
  { id: "s4", label: "S4", grades: [10] },
  { id: "am", label: "AM (Additional Mathematics)", grades: [11] },
  { id: "h2", label: "H2 (H1 and H2 Mathematics)", grades: [12] },
] as const;
export type BandId = (typeof BANDS)[number]["id"];

export type SpineTopic = { strand: StrandId; name: string };

export type SingaporePlace = {
  usGrade: number;
  moe: string;
  course: string;
  band: BandId;
  short: string;
  label: string;
  topics: readonly SpineTopic[];
};

const SPINE: Record<number, { moe: string; course: string; topics: readonly SpineTopic[] }> = {
  1: {
    moe: "Primary 1",
    course: "Primary Mathematics",
    topics: [
      { strand: "number", name: "Numbers to 100, addition and subtraction" },
      { strand: "measure", name: "Length and 2D shapes" },
      { strand: "data", name: "Picture graphs" },
    ],
  },
  2: {
    moe: "Primary 2",
    course: "Primary Mathematics",
    topics: [
      { strand: "number", name: "Numbers to 1 000 and multiplication tables" },
      { strand: "measure", name: "Length, mass, and time" },
      { strand: "data", name: "Picture graphs with scales" },
    ],
  },
  3: {
    moe: "Primary 3",
    course: "Primary Mathematics",
    topics: [
      { strand: "number", name: "Multiplication tables and equivalent fractions" },
      { strand: "measure", name: "Area, perimeter, and angles" },
      { strand: "data", name: "Bar graphs" },
    ],
  },
  4: {
    moe: "Primary 4",
    course: "Primary Mathematics",
    topics: [
      { strand: "number", name: "Factors, multiples, and decimals" },
      { strand: "measure", name: "Area of a rectangle and angles" },
      { strand: "data", name: "Tables and line graphs" },
    ],
  },
  5: {
    moe: "Primary 5",
    course: "Primary Mathematics",
    topics: [
      { strand: "number", name: "Percentage, rate, and fractions" },
      { strand: "measure", name: "Area of a triangle and volume" },
      { strand: "data", name: "Average" },
    ],
  },
  6: {
    moe: "Primary 6",
    course: "Primary Mathematics",
    topics: [
      { strand: "number", name: "Ratio and simple algebra" },
      { strand: "measure", name: "Circle and volume of a cuboid" },
      { strand: "data", name: "Average of a set" },
    ],
  },
  7: {
    moe: "Secondary 1",
    course: "O-Level Mathematics",
    topics: [
      { strand: "number", name: "Integers, primes, HCF, and LCM" },
      { strand: "measure", name: "Rate and polygons" },
      { strand: "data", name: "Mean" },
    ],
  },
  8: {
    moe: "Secondary 2",
    course: "O-Level Mathematics",
    topics: [
      { strand: "number", name: "Linear equations and proportion" },
      { strand: "measure", name: "Pythagoras" },
      { strand: "data", name: "Simple probability" },
    ],
  },
  9: {
    moe: "Secondary 3",
    course: "O-Level Mathematics",
    topics: [
      { strand: "number", name: "Indices and quadratic expressions" },
      { strand: "measure", name: "Pythagoras and similarity" },
      { strand: "data", name: "Probability" },
    ],
  },
  10: {
    moe: "Secondary 4",
    course: "O-Level Mathematics",
    topics: [
      { strand: "number", name: "Differentiation of a power" },
      { strand: "measure", name: "Area and right triangles" },
      { strand: "data", name: "Probability of a single event" },
    ],
  },
  11: {
    moe: "AM (Additional Mathematics)",
    course: "Additional Mathematics",
    topics: [
      { strand: "number", name: "Indices, surds, and quadratic functions" },
      { strand: "measure", name: "Coordinate geometry and trigonometry" },
      { strand: "data", name: "Binomial expansion" },
    ],
  },
  12: {
    moe: "H2 (H1 and H2 Mathematics)",
    course: "H1 and H2 Mathematics",
    topics: [
      { strand: "number", name: "Functions, series, and complex numbers" },
      { strand: "measure", name: "Vectors and calculus" },
      { strand: "data", name: "Probability and the sample mean" },
    ],
  },
};

export function singaporePlace(grade: number): SingaporePlace {
  const usGrade = Math.min(12, Math.max(1, Math.round(grade) || 1));
  const row = SPINE[usGrade]!;
  const band = BANDS.find((item) => (item.grades as readonly number[]).includes(usGrade))!;
  const short = `US ${usGrade} · ${band.label}`;
  return {
    usGrade,
    moe: row.moe,
    course: row.course,
    band: band.id,
    short,
    label: `${short} · ${row.course}`,
    topics: row.topics,
  };
}

export const SG_STAGE_NOTE =
  "Each topic goes concrete, then pictorial, then abstract. Two correct answers move up one step. The grade changes only after the abstract step. Two incorrect answers in a row move down one step.";

const SG_CODE = /^SG\.(\d+)\.(number|measure|data)(?:\.(bar-model|work-backwards|guess-and-check|patterns))?$/;

export function strandIdOf(key: string): StrandId | null {
  const text = key.trim().toLowerCase();
  for (const strand of STRANDS) {
    if (text === strand.id || text === strand.name.toLowerCase()) return strand.id;
  }
  if (text === "statistics and probability") return "data";
  if (text === "geometry" || text === "measurement") return "measure";
  return null;
}

export function heuristicIdOf(key: string): HeuristicId | null {
  const text = key.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  for (const heuristic of HEURISTICS) {
    if (text === heuristic.id || text === heuristic.name.toLowerCase() || text === heuristic.id.replace(/-/g, " ")) return heuristic.id;
  }
  return null;
}

export function sgStandard(grade: number, strand: StrandId, heuristic: HeuristicId | null): string {
  const level = Math.min(12, Math.max(1, Math.round(grade) || 1));
  return heuristic ? `SG.${level}.${strand}.${heuristic}` : `SG.${level}.${strand}`;
}

export function parseSgCode(code: string): { grade: number; strand: StrandId; heuristic: HeuristicId | null } | null {
  const matched = SG_CODE.exec(code.trim());
  if (!matched) return null;
  return {
    grade: Number(matched[1]),
    strand: matched[2] as StrandId,
    heuristic: (matched[3] as HeuristicId | undefined) ?? null,
  };
}

export function sgCodeLabel(code: string): string {
  const parsed = parseSgCode(code);
  if (!parsed) return code;
  const strand = STRANDS.find((item) => item.id === parsed.strand)?.name ?? parsed.strand;
  const heuristic = parsed.heuristic ? HEURISTICS.find((item) => item.id === parsed.heuristic)?.name : null;
  const place = singaporePlace(parsed.grade).short;
  return heuristic ? `${place} · ${strand} · ${heuristic}` : `${place} · ${strand}`;
}

export function stageName(step: number): Stage {
  const index = Math.min(2, Math.max(0, Math.round(step) || 0));
  return STAGES[index]!;
}

/** The US grade changes only when the abstract stage is the one that was correct. */
export function gradeRisesOnlyAfterAbstract(beforeGrade: number, beforeStep: number, afterGrade: number, afterStep: number): boolean {
  if (afterGrade <= beforeGrade) return true;
  return beforeStep === 2 && afterStep === 0 && afterGrade === beforeGrade + 1;
}
