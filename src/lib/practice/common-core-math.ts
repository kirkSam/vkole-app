/**
 * Free math practice sheets for grades K–12.
 * Each question comes from a code template for a published Common Core
 * State Standard for Mathematics. No model is called. This file has no
 * app-only imports, so the school website can copy it as one file.
 */

export const PRACTICE_GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as const;

export type PracticeGrade = (typeof PRACTICE_GRADES)[number];

export type MathQuestion = {
  code: string;
  domain: string;
  prompt: string;
  answer: string;
  op: string;
  nums: number[];
};

type Rng = () => number;
type Built = { prompt: string; answer: string; op: string; nums: number[] };
type Standard = { code: string; domain: string; make: (rng: Rng) => Built };

const COUNTING = "Counting and Cardinality";
const OA = "Operations and Algebraic Thinking";
const NBT = "Number and Operations in Base Ten";
const NF = "Number and Operations—Fractions";
const MD = "Measurement and Data";
const GEO = "Geometry";
const RP = "Ratios and Proportional Relationships";
const NS = "The Number System";
const EE = "Expressions and Equations";
const FN = "Functions";
const STAT = "Statistics and Probability";
const NQ = "Number & Quantity";
const ALG = "Algebra";
const HSP = "Statistics & Probability";

const SQUARES = [4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144];
const ROOTS = [2, 3, 5, 6, 7, 8, 10, 12, 15, 18, 20, 24];
const TRIPLES: readonly (readonly [number, number, number])[] = [
  [3, 4, 5],
  [5, 12, 13],
  [6, 8, 10],
  [7, 24, 25],
  [8, 15, 17],
  [9, 12, 15],
  [9, 40, 41],
  [20, 21, 29],
];

function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function int(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const left = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = left;
  }
  return copy;
}

function built(op: string, nums: number[], prompt: string, answer: string): Built {
  return { op, nums, prompt, answer };
}

function std(code: string, domain: string, make: (rng: Rng) => Built): Standard {
  return { code, domain, make };
}

function addWithin(rng: Rng, cap: number, lead: string): Built {
  const a = int(rng, 1, cap - 1);
  const b = int(rng, 1, cap - a);
  return built("add", [a, b], `${lead} What is ${a} + ${b}?`, String(a + b));
}

function addRange(rng: Rng, min: number, max: number, lead: string): Built {
  const a = int(rng, min, max);
  const b = int(rng, min, max);
  return built("add", [a, b], `${lead} What is ${a} + ${b}?`, String(a + b));
}

function add3(rng: Rng, cap: number, lead: string): Built {
  const a = int(rng, 1, Math.min(8, cap - 2));
  const b = int(rng, 1, Math.min(8, cap - a - 1));
  const c = int(rng, 1, cap - a - b);
  return built("add3", [a, b, c], `${lead} What is ${a} + ${b} + ${c}?`, String(a + b + c));
}

function subRange(rng: Rng, min: number, max: number, lead: string): Built {
  let a = int(rng, min, max);
  let b = int(rng, min, max);
  if (b > a) {
    const swap = a;
    a = b;
    b = swap;
  }
  return built("sub", [a, b], `${lead} What is ${a} - ${b}?`, String(a - b));
}

function mulRange(rng: Rng, minA: number, maxA: number, minB: number, maxB: number, lead: string): Built {
  const a = int(rng, minA, maxA);
  const b = int(rng, minB, maxB);
  return built("mul", [a, b], `${lead} What is ${a} × ${b}?`, String(a * b));
}

function divExact(rng: Rng, minFactor: number, maxFactor: number, minQuotient: number, maxQuotient: number, lead: string): Built {
  const factor = int(rng, minFactor, maxFactor);
  const quotient = int(rng, minQuotient, maxQuotient);
  const total = factor * quotient;
  return built("div", [total, factor], `${lead} What is ${total} ÷ ${factor}?`, String(quotient));
}

function nextQ(rng: Rng, min: number, max: number, lead: string): Built {
  const n = int(rng, min, max);
  return built("next", [n], `${lead} What number comes just after ${n}?`, String(n + 1));
}

function tenMore(rng: Rng, min: number, max: number, lead: string): Built {
  const n = int(rng, min, max);
  return built("ten-more", [n], `${lead} What is 10 more than ${n}?`, String(n + 10));
}

function hundredMore(rng: Rng, min: number, max: number, lead: string): Built {
  const n = int(rng, min, max);
  return built("hundred-more", [n], `${lead} What is 100 more than ${n}?`, String(n + 100));
}

function compareQ(rng: Rng, min: number, max: number, lead: string): Built {
  const a = int(rng, min, max);
  const b = int(rng, min, max);
  const answer = a > b ? ">" : a < b ? "<" : "=";
  return built("compare", [a, b], `${lead} Compare ${a} and ${b}. Write >, <, or =.`, answer);
}

function moreQ(rng: Rng, min: number, max: number, lead: string): Built {
  const a = int(rng, min + 1, max);
  const b = int(rng, min, a - 1);
  return built("more", [a, b], `${lead} How many more is ${a} than ${b}?`, String(a - b));
}

function make10(rng: Rng, lead: string): Built {
  const n = int(rng, 1, 9);
  return built("make10", [n], `${lead} What number added to ${n} makes 10?`, String(10 - n));
}

function tensDigit(rng: Rng, lead: string): Built {
  const n = int(rng, 10, 99);
  return built("tens-digit", [n], `${lead} How many tens are in ${n}?`, String(Math.floor(n / 10) % 10));
}

function hundredsDigit(rng: Rng, lead: string): Built {
  const n = int(rng, 100, 999);
  return built("hundreds-digit", [n], `${lead} How many hundreds are in ${n}?`, String(Math.floor(n / 100) % 10));
}

function skipQ(rng: Rng, steps: readonly number[], lead: string): Built {
  const step = pick(rng, steps);
  const start = step * int(rng, 1, step === 100 ? 8 : 12);
  return built("skip", [start, step], `${lead} Count by ${step}. What number comes after ${start}?`, String(start + step));
}

function areaQ(rng: Rng, lead: string): Built {
  const w = int(rng, 2, 12);
  const h = int(rng, 2, 12);
  return built("area", [w, h], `${lead} A rectangle is ${w} units wide and ${h} units tall. What is the area?`, String(w * h));
}

function perimQ(rng: Rng, lead: string): Built {
  const w = int(rng, 2, 15);
  const h = int(rng, 2, 15);
  return built("perim", [w, h], `${lead} A rectangle is ${w} units wide and ${h} units tall. What is the perimeter?`, String(2 * (w + h)));
}

function volumeQ(rng: Rng, lead: string): Built {
  const l = int(rng, 2, 8);
  const w = int(rng, 2, 8);
  const h = int(rng, 2, 8);
  return built("volume", [l, w, h], `${lead} A box is ${l} by ${w} by ${h}. What is the volume?`, String(l * w * h));
}

function fracQ(rng: Rng, lead: string): Built {
  const d = int(rng, 2, 8);
  const n = int(rng, 1, d);
  return built("frac", [n, d], `${lead} Write ${n}/${d} in simplest form.`, formatFrac(n, d));
}

function fracAdd(rng: Rng, lead: string): Built {
  const d = int(rng, 2, 8);
  const a = int(rng, 1, d);
  const b = int(rng, 1, d);
  return built("frac-add", [a, b, d], `${lead} Add ${a}/${d} + ${b}/${d}. Write the fraction in simplest form.`, formatFrac(a + b, d));
}

function fracAddUnlike(rng: Rng, lead: string): Built {
  const d1 = int(rng, 2, 6);
  const d2 = int(rng, 2, 6);
  const a = int(rng, 1, d1);
  const b = int(rng, 1, d2);
  return built(
    "frac-add-unlike",
    [a, d1, b, d2],
    `${lead} Add ${a}/${d1} + ${b}/${d2}. Write the fraction in simplest form.`,
    formatFrac(a * d2 + b * d1, d1 * d2),
  );
}

function fracMul(rng: Rng, lead: string): Built {
  const d1 = int(rng, 2, 6);
  const d2 = int(rng, 2, 6);
  const a = int(rng, 1, d1);
  const b = int(rng, 1, d2);
  return built(
    "frac-mul",
    [a, d1, b, d2],
    `${lead} Multiply ${a}/${d1} × ${b}/${d2}. Write the fraction in simplest form.`,
    formatFrac(a * b, d1 * d2),
  );
}

function wholeFrac(rng: Rng, lead: string): Built {
  const whole = int(rng, 2, 6);
  const d = int(rng, 2, 8);
  const n = int(rng, 1, d);
  return built("whole-frac", [whole, n, d], `${lead} What is ${whole} × ${n}/${d}? Write the fraction in simplest form.`, formatFrac(whole * n, d));
}

function percentQ(rng: Rng, lead: string): Built {
  const part = pick(rng, [10, 20, 25, 50]);
  const base = pick(rng, [20, 40, 60, 80, 100, 120]);
  return built("percent", [part, base], `${lead} What is ${part} percent of ${base}?`, String((part * base) / 100));
}

function pythagQ(rng: Rng, lead: string): Built {
  const [a, b, c] = pick(rng, TRIPLES);
  return built("pythag", [a, b], `${lead} A right triangle has legs ${a} and ${b}. What is the hypotenuse?`, String(c));
}

function meanQ(rng: Rng, lead: string): Built {
  const center = int(rng, 4, 18);
  const nums = [center, center, center, center];
  const shift = int(rng, 1, 4);
  const slide = int(rng, 1, 3);
  nums[0] = center + shift;
  nums[1] = center - shift;
  nums[2] = center + slide;
  nums[3] = center - slide;
  const order = shuffle(nums, rng);
  return built("mean", order, `${lead} What is the mean of ${order.join(", ")}?`, String(center));
}

function gcfQ(rng: Rng, lead: string, maxFactor: number): Built {
  const shared = int(rng, 2, 8);
  const a = shared * int(rng, 2, maxFactor);
  const b = shared * int(rng, 2, maxFactor);
  return built("gcf", [a, b], `${lead} What is the greatest common factor of ${a} and ${b}?`, String(gcd(a, b)));
}

function equationQ(rng: Rng, lead: string): Built {
  const addend = int(rng, 1, 20);
  const value = int(rng, 0, 20);
  const total = value + addend;
  return built("equation", [addend, total], `${lead} Solve n + ${addend} = ${total}. What is n?`, String(value));
}

function pxq(rng: Rng, lead: string): Built {
  const coef = int(rng, 2, 9);
  const value = int(rng, 1, 12);
  const add = int(rng, 1, 15);
  const right = coef * value + add;
  return built("px-q", [coef, add, right], `${lead} Solve ${coef}x + ${add} = ${right}. What is x?`, String(value));
}

function linearQ(rng: Rng, lead: string): Built {
  const slope = int(rng, 1, 8);
  const intercept = int(rng, 0, 10);
  const x = int(rng, 0, 8);
  return built(
    "linear",
    [slope, intercept, x],
    `${lead} The rule is ${slope}x + ${intercept}. What is the value when x is ${x}?`,
    String(slope * x + intercept),
  );
}

function expQ(rng: Rng, lead: string): Built {
  const base = int(rng, 2, 9);
  const power = int(rng, 2, 3);
  return built("exp", [base, power], `${lead} What is ${base} to the power ${power}?`, String(base ** power));
}

function sqrtQ(rng: Rng, lead: string): Built {
  const root = int(rng, 2, 12);
  const n = root * root;
  return built("sqrt", [n], `${lead} What is the positive square root of ${n}?`, String(root));
}

function pow10(rng: Rng, lead: string): Built {
  const coef = int(rng, 1, 9);
  const power = int(rng, 1, 4);
  return built("pow10", [coef, power], `${lead} What is ${coef} × 10 to the power ${power}?`, String(coef * 10 ** power));
}

function parityQ(rng: Rng, lead: string): Built {
  const n = int(rng, 1, 50);
  return built("parity", [n], `${lead} Is ${n} odd or even?`, n % 2 === 0 ? "even" : "odd");
}

function round10(rng: Rng, lead: string): Built {
  let n = int(rng, 21, 240);
  if (n % 10 === 5) n += 1;
  return built("round10", [n], `${lead} Round ${n} to the nearest ten.`, String(rounded10(n)));
}

function round100(rng: Rng, lead: string): Built {
  let n = int(rng, 120, 980);
  if (n % 100 === 50) n += 1;
  return built("round100", [n], `${lead} Round ${n} to the nearest hundred.`, String(rounded100(n)));
}

function roundTenthQ(rng: Rng, lead: string): Built {
  const whole = int(rng, 0, 20);
  const tenth = int(rng, 0, 9);
  let hundredth = int(rng, 0, 8);
  if (hundredth >= 5) hundredth += 1;
  return built(
    "round-tenth",
    [whole, tenth, hundredth],
    `${lead} Round ${whole}.${tenth}${hundredth} to the nearest tenth.`,
    roundedTenth(whole, tenth, hundredth),
  );
}

function tenthsAdd(rng: Rng, lead: string): Built {
  const a = int(rng, 0, 9);
  const b = int(rng, 0, 9);
  const c = int(rng, 0, 9);
  const d = int(rng, 0, 9);
  return built("tenths-add", [a, b, c, d], `${lead} What is ${a}.${b} + ${c}.${d}?`, formatTenths(a * 10 + b + (c * 10 + d)));
}

function maxQ(rng: Rng, min: number, max: number, lead: string): Built {
  let a = int(rng, min, max);
  let b = int(rng, min, max);
  if (a === b) b = a === max ? a - 1 : a + 1;
  return built("max", [a, b], `${lead} Which number is larger, ${a} or ${b}?`, String(Math.max(a, b)));
}

function signedMax(rng: Rng, lead: string): Built {
  const neg = -int(rng, 1, 12);
  const pos = int(rng, 0, 12);
  return built("max", [neg, pos], `${lead} Which number is greater, ${neg} or ${pos}?`, String(Math.max(neg, pos)));
}

function negAdd(rng: Rng, lead: string): Built {
  const a = int(rng, -12, 9);
  const b = -int(rng, 1, 12);
  return built("neg-add", [a, b], `${lead} What is ${a} + ${b}?`, String(a + b));
}

function negMul(rng: Rng, lead: string): Built {
  const a = -int(rng, 1, 9);
  let b = int(rng, -9, 9);
  if (b === 0) b = int(rng, 1, 9);
  return built("neg-mul", [a, b], `${lead} What is ${a} × ${b}?`, String(a * b));
}

function mulAdd(rng: Rng, lead: string): Built {
  const groups = int(rng, 2, 6);
  const each = int(rng, 2, 8);
  const extra = int(rng, 1, 9);
  return built(
    "mul-add",
    [groups, each, extra],
    `${lead} There are ${groups} bags of ${each} apples, plus ${extra} more apples. How many apples?`,
    String(groups * each + extra),
  );
}

function parenMul(rng: Rng, lead: string): Built {
  const a = int(rng, 1, 8);
  const b = int(rng, 1, 8);
  const c = int(rng, 2, 6);
  return built("paren-mul", [a, b, c], `${lead} What is (${a} + ${b}) × ${c}?`, String((a + b) * c));
}

function propQ(rng: Rng, lead: string): Built {
  const count = int(rng, 2, 6);
  const unit = int(rng, 2, 9);
  const want = int(rng, 2, 8);
  const total = count * unit;
  return built("prop", [count, total, want], `${lead} ${count} packs cost ${total} dollars. How much do ${want} packs cost?`, String(unit * want));
}

function systemX(rng: Rng, lead: string): Built {
  const x = int(rng, 1, 12);
  const y = int(rng, 0, 12);
  const sum = x + y;
  const diff = x - y;
  return built("system-x", [sum, diff], `${lead} Solve the system. x + y = ${sum} and x - y = ${diff}. What is x?`, String(x));
}

function conePi(rng: Rng, lead: string): Built {
  const radius = 3 * int(rng, 1, 4);
  const height = int(rng, 1, 9);
  return built(
    "cone-pi",
    [radius, height],
    `${lead} A cone has radius ${radius} and height ${height}. The volume is one third times pi times the radius squared times the height. What number times pi is the volume?`,
    String((radius * radius * height) / 3),
  );
}

function deltaY(rng: Rng, lead: string): Built {
  const x1 = int(rng, 0, 6);
  const y1 = int(rng, 0, 8);
  const x2 = x1 + int(rng, 1, 5);
  const y2 = y1 + int(rng, 1, 6);
  return built(
    "delta-y",
    [x1, y1, x2, y2],
    `${lead} From the point (${x1}, ${y1}) to the point (${x2}, ${y2}), how much does y change?`,
    String(y2 - y1),
  );
}

function realSum(rng: Rng, lead: string): Built {
  const a = int(rng, 1, 9);
  const b = int(rng, 1, 9);
  const c = int(rng, 1, 9);
  const d = int(rng, 1, 9);
  return built("real-sum", [a, b, c, d], `${lead} Add (${a} + ${b}i) + (${c} + ${d}i). What is the real part of the sum?`, String(a + c));
}

function orCount(rng: Rng, lead: string): Built {
  const both = int(rng, 1, 6);
  const band = both + int(rng, 0, 8);
  const choir = both + int(rng, 0, 8);
  return built(
    "or",
    [band, choir, both],
    `${lead} ${band} students are in band and ${choir} are in choir. ${both} are in both. How many are in band or choir?`,
    String(band + choir - both),
  );
}

function slopeQ(rng: Rng, lead: string): Built {
  const run = pick(rng, [1, 2, 3, 4]);
  const slope = int(rng, 1, 6);
  const rise = slope * run;
  return built("slope", [rise, run], `${lead} A line rises ${rise} units for a run of ${run} units. What is the slope?`, String(slope));
}

function modelQ(rng: Rng, lead: string): Built {
  if (rng() < 0.5) {
    const n = int(rng, 2, 12);
    return built("linear-add", [n], `${lead} A plant grows ${n} centimeters each week. Is this linear or exponential?`, "linear");
  }
  const years = int(rng, 2, 6);
  return built("exp-double", [years], `${lead} A quantity doubles every ${years} years. Is this linear or exponential?`, "exponential");
}

function eqCheck(rng: Rng, lead: string): Built {
  const a = int(rng, 1, 9);
  const b = int(rng, 1, 9);
  const trueSum = rng() < 0.5;
  const c = trueSum ? a + b : a + b + int(rng, 1, 4);
  const answer = a + b === c ? "=" : "no";
  return built("eq-check", [a, b, c], `${lead} Is ${a} + ${b} = ${c}? Write = if it is true. Write no if it is not.`, answer);
}

function sameQ(rng: Rng, lead: string): Built {
  const a = int(rng, 1, 9);
  const b = int(rng, 1, 9);
  return built("same", [a, b], `${lead} What number n makes ${a} + ${b} = ${b} + n?`, String(a));
}

function factorYes(rng: Rng, lead: string): Built {
  const factor = int(rng, 2, 9);
  const total = int(rng, 10, 60);
  return built("factor-yes", [factor, total], `${lead} Is ${factor} a factor of ${total}? Write yes or no.`, total % factor === 0 ? "yes" : "no");
}

function rootKind(rng: Rng, lead: string): Built {
  const n = pick(rng, [...SQUARES, ...ROOTS]);
  const answer = isPerfectSquare(n) ? "rational" : "irrational";
  return built("irrational-root", [n], `${lead} Is the square root of ${n} rational or irrational?`, answer);
}

function rationalTimesRoot(rng: Rng, lead: string): Built {
  const coef = int(rng, 2, 9);
  const n = pick(rng, [2, 3, 4, 5, 8, 9, 10, 16]);
  const answer = isPerfectSquare(n) ? "rational" : "irrational";
  return built("rat-times-root", [coef, n], `${lead} Is ${coef} times the square root of ${n} rational or irrational?`, answer);
}

function rationalInt(rng: Rng, lead: string): Built {
  const n = int(rng, 1, 30);
  return built("rational-int", [n], `${lead} Is ${n} rational or irrational?`, "rational");
}

function dec10(rng: Rng, lead: string): Built {
  const n = int(rng, 1, 9);
  return built("dec-10", [n], `${lead} Write ${n}/10 as a decimal.`, `0.${n}`);
}

function divUnit(rng: Rng, lead: string): Built {
  const whole = int(rng, 1, 6);
  const den = int(rng, 2, 8);
  return built("div-unit", [whole, 1, den], `${lead} How many 1/${den} are in ${whole}?`, String(whole * den));
}

function countQ(n: number, prompt: string): Built {
  return built("count", [n], prompt, String(n));
}

function recall(n: number, prompt: string): Built {
  return built("recall", [n], prompt, String(n));
}

function shapeSides(rng: Rng, lead: string): Built {
  const shape = pick(rng, [
    ["triangle", 3],
    ["square", 4],
    ["pentagon", 5],
    ["hexagon", 6],
  ] as const);
  return recall(shape[1], `${lead} How many sides does a ${shape[0]} have?`);
}

function placeTimes(rng: Rng, lead: string): Built {
  const digit = int(rng, 1, 9);
  const bigger = digit * 10;
  return built("div", [bigger, digit], `${lead} How many times as much is ${bigger} as ${digit}?`, "10");
}

function tenLessMul(rng: Rng, lead: string): Built {
  const digit = int(rng, 2, 9);
  const tens = int(rng, 1, 9) * 10;
  return built("mul", [digit, tens], `${lead} What is ${digit} × ${tens}?`, String(digit * tens));
}

function angleSum(rng: Rng, lead: string): Built {
  const a = int(rng, 10, 80);
  const b = int(rng, 10, 80);
  return built("add", [a, b], `${lead} Two angles measure ${a} degrees and ${b} degrees. What is the sum of the measures?`, String(a + b));
}

function yChangeIsSecond(rng: Rng, lead: string): Built {
  const slope = int(rng, 1, 6);
  const intercept = int(rng, 1, 9);
  return built("second", [slope, intercept], `${lead} The rule is ${slope}x + ${intercept}. What is the y-intercept?`, String(intercept));
}

function coefficient(rng: Rng, lead: string): Built {
  const a = int(rng, 2, 12);
  const b = int(rng, 1, 15);
  return built("first", [a, b], `${lead} In the expression ${a}x + ${b}, what is the coefficient of x?`, String(a));
}

function rateQ(rng: Rng, lead: string): Built {
  const hours = int(rng, 2, 6);
  const speed = int(rng, 8, 45);
  const miles = hours * speed;
  return built("div", [miles, hours], `${lead} A car travels ${miles} miles in ${hours} hours. How many miles does it travel in 1 hour?`, String(speed));
}

function sampleSpace(rng: Rng, lead: string): Built {
  const red = int(rng, 1, 8);
  const blue = int(rng, 1, 8);
  return built("add", [red, blue], `${lead} A bag has ${red} red marbles and ${blue} blue marbles. You draw one marble. How many marbles could you draw?`, String(red + blue));
}

function exponentAdd(rng: Rng, lead: string): Built {
  const a = int(rng, 2, 8);
  const b = int(rng, 2, 8);
  return built("add", [a, b], `${lead} Add the exponents ${a} and ${b} for powers of the same base. What is the exponent of the product?`, String(a + b));
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const next = y;
    y = x % y;
    x = next;
  }
  return x || 1;
}

function formatFrac(numerator: number, denominator: number): string {
  const g = gcd(numerator, denominator);
  const n = numerator / g;
  const d = denominator / g;
  if (d === 1) return String(n);
  return `${n}/${d}`;
}

function formatTenths(total: number): string {
  const whole = Math.floor(total / 10);
  const tenth = total % 10;
  if (tenth === 0) return String(whole);
  return `${whole}.${tenth}`;
}

function rounded10(n: number): number {
  const ones = ((n % 10) + 10) % 10;
  if (ones < 5) return n - ones;
  return n + (10 - ones);
}

function rounded100(n: number): number {
  const rem = ((n % 100) + 100) % 100;
  if (rem < 50) return n - rem;
  return n + (100 - rem);
}

function roundedTenth(whole: number, tenth: number, hundredth: number): string {
  let w = whole;
  let t = tenth;
  if (hundredth >= 5) t += 1;
  if (t >= 10) {
    t = 0;
    w += 1;
  }
  if (t === 0) return String(w);
  return `${w}.${t}`;
}

function isPerfectSquare(n: number): boolean {
  if (n < 0) return false;
  const root = Math.round(Math.sqrt(n));
  return root * root === n;
}

const BANK: Record<PracticeGrade, Standard[]> = {
  K: [
    std("K.CC.A.1", COUNTING, (rng) => skipQ(rng, [10], "Count by tens.")),
    std("K.CC.A.2", COUNTING, (rng) => nextQ(rng, 0, 20, "Count forward.")),
    std("K.CC.A.3", COUNTING, (rng) => {
      const n = int(rng, 0, 20);
      return countQ(n, `Write the number ${n}.`);
    }),
    std("K.CC.B.4", COUNTING, (rng) => {
      const n = int(rng, 1, 10);
      return countQ(n, `You count a group of ${n}. The last number you say tells how many. How many are in the group?`);
    }),
    std("K.CC.B.5", COUNTING, (rng) => {
      const n = int(rng, 1, 20);
      return countQ(n, `Count the group of ${n} birds. How many birds?`);
    }),
    std("K.CC.C.6", COUNTING, (rng) => compareQ(rng, 1, 10, "Group sizes.")),
    std("K.CC.C.7", COUNTING, (rng) => compareQ(rng, 1, 10, "Written numbers.")),
    std("K.OA.A.2", OA, (rng) => addWithin(rng, 10, "Join two groups within 10.")),
    std("K.OA.A.3", OA, (rng) => subRange(rng, 1, 10, "Break a number into two parts.")),
    std("K.OA.A.4", OA, (rng) => make10(rng, "Make 10.")),
    std("K.OA.A.5", OA, (rng) => addWithin(rng, 5, "Add within 5.")),
    std("K.NBT.A.1", NBT, (rng) => {
      const ones = int(rng, 1, 9);
      return built("add", [10, ones], `Ten and some more. What is 10 + ${ones}?`, String(10 + ones));
    }),
    std("K.MD.A.2", MD, (rng) => maxQ(rng, 1, 10, "Compare two lengths.")),
    std("K.G.A.2", GEO, (rng) => shapeSides(rng, "Name the sides.")),
    std("K.G.B.4", GEO, (rng) => maxQ(rng, 3, 6, "Compare the number of sides.")),
  ],
  "1": [
    std("1.OA.A.1", OA, (rng) => addWithin(rng, 20, "A word problem within 20.")),
    std("1.OA.A.2", OA, (rng) => add3(rng, 20, "Three groups within 20.")),
    std("1.OA.B.3", OA, (rng) => sameQ(rng, "The order of addends can change.")),
    std("1.OA.B.4", OA, (rng) => equationQ(rng, "Find the missing addend.")),
    std("1.OA.C.6", OA, (rng) => addWithin(rng, 20, "Add within 20.")),
    std("1.OA.D.7", OA, (rng) => eqCheck(rng, "Check the equation.")),
    std("1.OA.D.8", OA, (rng) => equationQ(rng, "Find the unknown number.")),
    std("1.NBT.A.1", NBT, (rng) => nextQ(rng, 1, 120, "Count on within 120.")),
    std("1.NBT.B.2", NBT, (rng) => tensDigit(rng, "Tens and ones.")),
    std("1.NBT.B.3", NBT, (rng) => compareQ(rng, 10, 99, "Compare two two-digit numbers.")),
    std("1.NBT.C.4", NBT, (rng) => addRange(rng, 10, 50, "Add within 100.")),
    std("1.NBT.C.5", NBT, (rng) => tenMore(rng, 1, 90, "Ten more.")),
    std("1.NBT.C.6", NBT, (rng) => {
      const a = int(rng, 4, 9) * 10;
      const b = int(rng, 1, a / 10 - 1) * 10;
      return built("sub", [a, b], `Subtract tens. What is ${a} - ${b}?`, String(a - b));
    }),
    std("1.MD.C.4", MD, (rng) => moreQ(rng, 1, 20, "Read the counts.")),
    std("1.G.A.3", GEO, (rng) => {
      const den = pick(rng, [2, 4]);
      return built("frac", [1, den], `One of ${den} equal parts. Write the fraction 1/${den} in simplest form.`, formatFrac(1, den));
    }),
  ],
  "2": [
    std("2.OA.A.1", OA, (rng) => addRange(rng, 10, 80, "Add within 100.")),
    std("2.OA.B.2", OA, (rng) => addWithin(rng, 20, "Add within 20.")),
    std("2.OA.C.3", OA, (rng) => parityQ(rng, "Odd or even.")),
    std("2.OA.C.4", OA, (rng) => mulRange(rng, 2, 5, 2, 5, "An array.")),
    std("2.NBT.A.1", NBT, (rng) => hundredsDigit(rng, "Hundreds, tens, and ones.")),
    std("2.NBT.A.2", NBT, (rng) => skipQ(rng, [5, 10, 100], "Skip-count.")),
    std("2.NBT.A.4", NBT, (rng) => compareQ(rng, 100, 999, "Compare three-digit numbers.")),
    std("2.NBT.B.5", NBT, (rng) => addRange(rng, 10, 80, "Add fluently within 100.")),
    std("2.NBT.B.7", NBT, (rng) => addRange(rng, 100, 400, "Add within 1000.")),
    std("2.NBT.B.8", NBT, (rng) => hundredMore(rng, 10, 800, "Add 100 mentally.")),
    std("2.MD.C.8", MD, (rng) => {
      const dimes = int(rng, 1, 9);
      return built("mul", [dimes, 10], `You have ${dimes} dimes. Each dime is 10 cents. How many cents do you have?`, String(dimes * 10));
    }),
    std("2.MD.D.10", MD, (rng) => moreQ(rng, 1, 20, "A bar graph.")),
    std("2.G.A.1", GEO, (rng) => shapeSides(rng, "A shape with a given number of sides.")),
    std("2.G.A.3", GEO, (rng) => {
      const parts = pick(rng, [2, 3, 4]);
      return countQ(parts, `A shape is split into ${parts} equal parts. How many equal parts?`);
    }),
  ],
  "3": [
    std("3.OA.A.1", OA, (rng) => mulRange(rng, 2, 9, 2, 9, "Equal groups.")),
    std("3.OA.A.3", OA, (rng) => mulRange(rng, 2, 10, 2, 10, "A multiplication word problem.")),
    std("3.OA.A.4", OA, (rng) => divExact(rng, 2, 10, 2, 10, "Find the unknown factor.")),
    std("3.OA.C.7", OA, (rng) => mulRange(rng, 1, 10, 1, 10, "A fact within 100.")),
    std("3.OA.D.8", OA, (rng) => mulAdd(rng, "Two steps.")),
    std("3.NBT.A.1", NBT, (rng) => round10(rng, "Round to the nearest ten.")),
    std("3.NBT.A.2", NBT, (rng) => addRange(rng, 100, 500, "Add within 1000.")),
    std("3.NBT.A.3", NBT, (rng) => tenLessMul(rng, "Multiply by a multiple of 10.")),
    std("3.NF.A.1", NF, (rng) => fracQ(rng, "A fraction is this many equal parts.")),
    std("3.NF.A.3", NF, (rng) => fracQ(rng, "An equivalent fraction.")),
    std("3.MD.C.7", MD, (rng) => areaQ(rng, "Area of a rectangle.")),
    std("3.MD.D.8", MD, (rng) => perimQ(rng, "Perimeter of a rectangle.")),
    std("3.G.A.2", GEO, (rng) => fracQ(rng, "Equal parts of a shape.")),
  ],
  "4": [
    std("4.OA.A.2", OA, (rng) => mulRange(rng, 2, 9, 2, 12, "Times as many.")),
    std("4.OA.B.4", OA, (rng) => gcfQ(rng, "Factors.", 8)),
    std("4.NBT.A.3", NBT, (rng) => round100(rng, "Round a multi-digit number.")),
    std("4.NBT.B.4", NBT, (rng) => addRange(rng, 100, 900, "Add multi-digit numbers.")),
    std("4.NBT.B.5", NBT, (rng) => mulRange(rng, 12, 80, 2, 9, "Multiply a two-digit number by a one-digit number.")),
    std("4.NBT.B.6", NBT, (rng) => divExact(rng, 2, 9, 12, 80, "Divide a multi-digit number.")),
    std("4.NF.A.1", NF, (rng) => fracQ(rng, "Equivalent fractions.")),
    std("4.NF.B.3", NF, (rng) => fracAdd(rng, "Add fractions with the same denominator.")),
    std("4.NF.B.4", NF, (rng) => wholeFrac(rng, "Multiply a fraction by a whole number.")),
    std("4.NF.C.6", NF, (rng) => dec10(rng, "Decimal notation.")),
    std("4.NF.C.7", NF, (rng) => {
      const a = int(rng, 1, 9);
      const b = int(rng, 1, 9);
      const answer = a > b ? ">" : a < b ? "<" : "=";
      return built("compare", [a, b], `Compare decimals. Compare 0.${a} and 0.${b}. Write >, <, or =.`, answer);
    }),
    std("4.MD.A.3", MD, (rng) => areaQ(rng, "Area.")),
    std("4.MD.C.7", MD, (rng) => angleSum(rng, "Angle measures add.")),
    std("4.G.A.2", GEO, () => recall(2, "How many pairs of parallel sides does a rectangle have?")),
  ],
  "5": [
    std("5.OA.A.1", OA, (rng) => parenMul(rng, "Use parentheses.")),
    std("5.NBT.A.1", NBT, (rng) => placeTimes(rng, "A digit one place to the left.")),
    std("5.NBT.A.2", NBT, (rng) => pow10(rng, "Powers of 10.")),
    std("5.NBT.A.4", NBT, (rng) => roundTenthQ(rng, "Round a decimal.")),
    std("5.NBT.B.5", NBT, (rng) => mulRange(rng, 11, 30, 11, 24, "Multiply multi-digit numbers.")),
    std("5.NBT.B.7", NBT, (rng) => tenthsAdd(rng, "Add decimals.")),
    std("5.NF.A.1", NF, (rng) => fracAddUnlike(rng, "Add fractions with unlike denominators.")),
    std("5.NF.B.4", NF, (rng) => fracMul(rng, "Multiply fractions.")),
    std("5.NF.B.7", NF, (rng) => divUnit(rng, "Divide by a unit fraction.")),
    std("5.MD.C.5", MD, (rng) => volumeQ(rng, "Volume.")),
    std("5.G.A.1", GEO, (rng) => {
      const x = int(rng, 0, 9);
      const y = int(rng, 0, 9);
      return built("first", [x, y], `The point (${x}, ${y}) is on the grid. What is the x-coordinate?`, String(x));
    }),
    std("5.G.B.4", GEO, () => recall(4, "How many sides does a square have?")),
  ],
  "6": [
    std("6.RP.A.1", RP, (rng) => {
      const a = int(rng, 1, 9);
      const b = int(rng, 1, 9);
      return built("add", [a, b], `The ratio of red to blue is ${a} to ${b}. How many are there in all?`, String(a + b));
    }),
    std("6.RP.A.2", RP, (rng) => rateQ(rng, "Unit rate.")),
    std("6.RP.A.3", RP, (rng) => percentQ(rng, "Percent of a number.")),
    std("6.NS.A.1", NS, (rng) => divUnit(rng, "Divide a whole number by a unit fraction.")),
    std("6.NS.B.2", NS, (rng) => divExact(rng, 2, 12, 8, 40, "Divide multi-digit numbers.")),
    std("6.NS.B.4", NS, (rng) => gcfQ(rng, "The greatest common factor.", 9)),
    std("6.NS.C.5", NS, (rng) => signedMax(rng, "Positive and negative numbers.")),
    std("6.EE.A.1", EE, (rng) => expQ(rng, "A whole-number exponent.")),
    std("6.EE.B.7", EE, (rng) => equationQ(rng, "Solve x + p = q.")),
    std("6.G.A.1", GEO, (rng) => areaQ(rng, "Area of a rectangle.")),
    std("6.G.A.2", GEO, (rng) => volumeQ(rng, "Volume of a box.")),
    std("6.SP.B.5", STAT, (rng) => meanQ(rng, "Summarize the data.")),
  ],
  "7": [
    std("7.RP.A.1", RP, (rng) => rateQ(rng, "A unit rate.")),
    std("7.RP.A.2", RP, (rng) => propQ(rng, "A proportional relationship.")),
    std("7.RP.A.3", RP, (rng) => percentQ(rng, "Percent.")),
    std("7.NS.A.1", NS, (rng) => negAdd(rng, "Add rational numbers.")),
    std("7.NS.A.2", NS, (rng) => negMul(rng, "Multiply rational numbers.")),
    std("7.EE.A.1", EE, (rng) => {
      const a = int(rng, 2, 12);
      const b = int(rng, 2, 12);
      return built("add", [a, b], `Add ${a}x + ${b}x. What is the coefficient of x?`, String(a + b));
    }),
    std("7.EE.B.4", EE, (rng) => pxq(rng, "Solve px + q = r.")),
    std("7.G.A.1", GEO, (rng) => mulRange(rng, 2, 6, 2, 12, "A scale drawing.")),
    std("7.G.B.4", GEO, (rng) => {
      const radius = int(rng, 2, 15);
      return built("mul", [2, radius], `A circle has radius ${radius}. The diameter is 2 times the radius. What is the diameter?`, String(2 * radius));
    }),
    std("7.G.B.6", GEO, (rng) => volumeQ(rng, "Volume of a rectangular prism.")),
    std("7.SP.C.5", STAT, () => recall(1, "A sure event has what probability? Write the number.")),
    std("7.SP.C.7", STAT, (rng) => fracQ(rng, "A probability model.")),
    std("7.SP.C.8", STAT, (rng) => mulRange(rng, 2, 6, 2, 6, "Compound outcomes.")),
  ],
  "8": [
    std("8.NS.A.1", NS, (rng) => rootKind(rng, "Rational or irrational.")),
    std("8.EE.A.1", EE, (rng) => expQ(rng, "Integer exponents.")),
    std("8.EE.A.2", EE, (rng) => sqrtQ(rng, "A square root solves x squared.")),
    std("8.EE.A.3", EE, (rng) => pow10(rng, "Scientific notation uses powers of 10.")),
    std("8.EE.C.7", EE, (rng) => pxq(rng, "Solve a linear equation.")),
    std("8.EE.C.8", EE, (rng) => systemX(rng, "A system of two equations.")),
    std("8.F.A.1", FN, () => recall(1, "A function gives each input how many outputs?")),
    std("8.F.B.4", FN, (rng) => linearQ(rng, "A linear function.")),
    std("8.G.B.7", GEO, (rng) => pythagQ(rng, "The Pythagorean Theorem.")),
    std("8.G.C.9", GEO, (rng) => conePi(rng, "Volume of a cone.")),
    std("8.SP.A.1", STAT, (rng) => deltaY(rng, "Two points on a scatter plot.")),
    std("8.SP.A.4", STAT, (rng) => {
      const yes = int(rng, 2, 20);
      const no = int(rng, 2, 20);
      return built("add", [yes, no], `${yes} students said yes and ${no} students said no. How many students were asked?`, String(yes + no));
    }),
  ],
  "9": [
    std("HSN-RN.A.2", NQ, (rng) => sqrtQ(rng, "Rewrite a radical.")),
    std("HSN-Q.A.1", NQ, (rng) => rateQ(rng, "Use units.")),
    std("HSN-RN.B.3", NQ, (rng) => rationalInt(rng, "Sums and products of rational numbers stay rational.")),
    std("HSA-SSE.A.1", ALG, (rng) => coefficient(rng, "Interpret an expression.")),
    std("HSA-CED.A.1", ALG, (rng) => equationQ(rng, "An equation in one variable.")),
    std("HSA-REI.B.3", ALG, (rng) => pxq(rng, "Solve a linear equation.")),
    std("HSA-APR.A.1", ALG, (rng) => addRange(rng, 2, 12, "Add the coefficients of x.")),
    std("HSF-IF.A.1", FN, () => recall(1, "A function gives each input how many outputs?")),
    std("HSF-IF.A.2", FN, (rng) => linearQ(rng, "Function notation.")),
    std("HSF-LE.A.1", FN, (rng) => modelQ(rng, "Linear or exponential.")),
    std("HSG-CO.A.1", GEO, () => recall(2, "How many endpoints does a line segment have?")),
    std("HSG-SRT.C.8", GEO, (rng) => pythagQ(rng, "A right triangle.")),
    std("HSG-GPE.B.7", GEO, (rng) => areaQ(rng, "Area from the side lengths.")),
    std("HSS-ID.A.2", HSP, (rng) => meanQ(rng, "Center of a data set.")),
    std("HSS-ID.C.7", HSP, (rng) => slopeQ(rng, "Slope of a linear model.")),
    std("HSS-CP.A.1", HSP, (rng) => sampleSpace(rng, "A sample space.")),
  ],
  "10": [
    std("HSN-RN.A.2", NQ, (rng) => sqrtQ(rng, "A radical in simpler form.")),
    std("HSN-CN.A.1", NQ, () => recall(-1, "What is i squared?")),
    std("HSN-Q.A.1", NQ, (rng) => rateQ(rng, "Quantities and units.")),
    std("HSA-REI.B.4", ALG, (rng) => sqrtQ(rng, "The positive solution of a quadratic.")),
    std("HSA-REI.C.6", ALG, (rng) => systemX(rng, "A system of linear equations.")),
    std("HSA-SSE.A.1", ALG, (rng) => coefficient(rng, "The parts of an expression.")),
    std("HSF-IF.A.2", FN, (rng) => linearQ(rng, "Evaluate a function.")),
    std("HSF-LE.A.1", FN, (rng) => modelQ(rng, "Linear or exponential change.")),
    std("HSF-BF.A.1", FN, (rng) => addRange(rng, 1, 15, "A rule that adds the same amount. Add the two numbers to get the next value.")),
    std("HSG-SRT.C.8", GEO, (rng) => pythagQ(rng, "Solve a right triangle.")),
    std("HSG-GPE.B.7", GEO, (rng) => perimQ(rng, "Perimeter from the side lengths.")),
    std("HSG-GMD.A.3", GEO, (rng) => conePi(rng, "Volume formula for a cone.")),
    std("HSG-CO.A.1", GEO, () => recall(90, "How many degrees are in a right angle?")),
    std("HSS-ID.A.2", HSP, (rng) => meanQ(rng, "Compare center with the mean.")),
    std("HSS-CP.A.2", HSP, (rng) => fracMul(rng, "Independent events. Multiply the probabilities.")),
    std("HSS-ID.C.7", HSP, (rng) => slopeQ(rng, "Interpret the slope.")),
  ],
  "11": [
    std("HSN-RN.A.2", NQ, (rng) => sqrtQ(rng, "A rational exponent of one half is a square root.")),
    std("HSN-CN.A.2", NQ, (rng) => realSum(rng, "Add complex numbers.")),
    std("HSN-RN.B.3", NQ, (rng) => rationalTimesRoot(rng, "A nonzero rational times a root.")),
    std("HSA-REI.B.4", ALG, (rng) => sqrtQ(rng, "Solve x squared equals a number. Give the positive solution.")),
    std("HSA-REI.C.6", ALG, (rng) => systemX(rng, "Solve the system exactly.")),
    std("HSA-APR.A.1", ALG, (rng) => addRange(rng, 2, 15, "Add polynomials by adding the coefficients of x.")),
    std("HSF-IF.A.2", FN, (rng) => linearQ(rng, "Use function notation.")),
    std("HSF-LE.A.2", FN, (rng) => linearQ(rng, "Build a linear function.")),
    std("HSF-IF.B.4", FN, (rng) => yChangeIsSecond(rng, "A key feature of the graph.")),
    std("HSG-SRT.C.8", GEO, (rng) => pythagQ(rng, "Pythagorean Theorem.")),
    std("HSG-GMD.A.3", GEO, (rng) => conePi(rng, "Use a volume formula.")),
    std("HSG-GPE.B.7", GEO, (rng) => perimQ(rng, "Perimeter of a rectangle.")),
    std("HSS-ID.A.2", HSP, (rng) => meanQ(rng, "The mean describes the center.")),
    std("HSS-CP.B.7", HSP, (rng) => orCount(rng, "The addition rule.")),
    std("HSS-ID.C.7", HSP, (rng) => slopeQ(rng, "Slope of a line fitted to data.")),
    std("HSN-Q.A.1", NQ, (rng) => rateQ(rng, "Choose a useful unit rate.")),
  ],
  "12": [
    std("HSN-RN.A.1", NQ, (rng) => exponentAdd(rng, "Integer exponents extend to rational exponents.")),
    std("HSN-CN.A.2", NQ, (rng) => realSum(rng, "Multiply is not needed. Add the complex numbers.")),
    std("HSN-Q.A.1", NQ, (rng) => rateQ(rng, "Units make the answer meaningful.")),
    std("HSA-REI.B.4", ALG, (rng) => sqrtQ(rng, "A quadratic equation.")),
    std("HSA-REI.C.6", ALG, (rng) => systemX(rng, "Two linear equations.")),
    std("HSA-CED.A.2", ALG, (rng) => linearQ(rng, "An equation in two variables.")),
    std("HSF-IF.A.2", FN, (rng) => linearQ(rng, "Evaluate f at the given input.")),
    std("HSF-LE.B.5", FN, (rng) => {
      const slope = int(rng, 2, 9);
      return countQ(slope, `A line adds ${slope} each step. What is the slope?`);
    }),
    std("HSF-LE.A.1", FN, (rng) => modelQ(rng, "Decide the kind of change.")),
    std("HSG-SRT.C.8", GEO, (rng) => pythagQ(rng, "A right triangle and the Pythagorean Theorem.")),
    std("HSG-GMD.A.3", GEO, (rng) => conePi(rng, "Cone volume.")),
    std("HSG-GPE.B.7", GEO, (rng) => areaQ(rng, "Area of a rectangle on the coordinate plane.")),
    std("HSS-ID.A.2", HSP, (rng) => meanQ(rng, "Mean of a distribution.")),
    std("HSS-CP.A.1", HSP, (rng) => sampleSpace(rng, "Outcomes in a sample space.")),
    std("HSS-ID.C.7", HSP, (rng) => slopeQ(rng, "The slope of a linear model.")),
  ],
};

const GRADE_SET = new Set<string>(PRACTICE_GRADES);

export function parsePracticeGrade(input: string): PracticeGrade | null {
  const text = input.trim().toLowerCase().replace(/^grade\s+/, "");
  if (text === "k" || text === "kindergarten" || text === "0") return "K";
  if (GRADE_SET.has(text)) return text as PracticeGrade;
  return null;
}

export function standardsForGrade(grade: PracticeGrade): { code: string; domain: string }[] {
  return BANK[grade].map((item) => ({ code: item.code, domain: item.domain }));
}

export function makeMathSheet(grade: PracticeGrade, seed?: number): MathQuestion[] {
  const bank = BANK[grade];
  const rng = mulberry32(seed === undefined ? (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0 : seed);
  const picked = shuffle(bank, rng).slice(0, 10);
  const questions = picked.map((item) => {
    const made = item.make(rng);
    return {
      code: item.code,
      domain: item.domain,
      prompt: made.prompt,
      answer: made.answer,
      op: made.op,
      nums: made.nums,
    };
  });
  return shuffle(questions, rng);
}
