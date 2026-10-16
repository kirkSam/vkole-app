import { KIDS, numberAliases, type Built, type Cell } from "./pool-shared.ts";
import { questionKey } from "./next-sheet.ts";
import {
  BANDS,
  singaporePlace,
  sgStandard,
  type HeuristicId,
  type Stage,
  type StrandId,
  STAGES,
} from "./vkole-singapore.ts";

export const SG_FAMILIES = 4;
export const SG_VARIANTS = 36;
export const SG_CELL_COUNT = SG_FAMILIES * SG_VARIANTS;

type Core = {
  strand: StrandId;
  heuristic: HeuristicId | null;
  topic: string;
  concrete: string;
  pictorial: string;
  abstract: string;
  bar?: number[];
  bond?: [number, number];
  answer: string;
  aliases: string[];
  note: string;
};

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

function fraction(numerator: number, denominator: number): string {
  const sign = numerator * denominator < 0 ? -1 : 1;
  const g = gcd(numerator, denominator);
  const top = (sign * Math.abs(numerator)) / g;
  const bottom = Math.abs(denominator) / g;
  return bottom === 1 ? String(top) : `${top}/${bottom}`;
}

function whole(value: number, extra: string[] = []): { answer: string; aliases: string[] } {
  const answer = Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);
  const aliases = new Set(extra.filter((item) => item && item !== answer));
  if (Number.isInteger(value)) for (const word of numberAliases(value)) aliases.add(word);
  if (!Number.isInteger(value)) {
    const tenths = Math.round(value * 10);
    if (Math.abs(tenths / 10 - value) < 1e-9) aliases.add(fraction(tenths, 10));
  }
  aliases.delete(answer);
  return { answer, aliases: [...aliases] };
}

function kid(variant: number): string {
  return KIDS[variant % KIDS.length]!;
}

function dress(stage: Stage, core: Core): string {
  if (stage === "abstract") return core.abstract;
  if (stage === "concrete") return core.concrete;
  const figure = core.bond ? `[bond ${core.bond[0]} ${core.bond[1]}]` : `[bar ${(core.bar ?? [1, 1]).join(" ")}]`;
  return `${figure}\n${core.pictorial}`;
}

function pack(grade: number, stage: Stage, core: Core): Built {
  const place = singaporePlace(grade);
  const shownHeuristic =
    core.heuristic ??
    (stage === "pictorial" && core.bond ? "number bond" : stage === "pictorial" && core.bar ? "bar model" : null);
  return {
    stem: dress(stage, core),
    answer: core.answer,
    aliases: core.aliases,
    standard: sgStandard(grade, core.strand, shownHeuristic),
    note: `${place.label}. ${core.topic}. ${stage}. ${core.note}`,
  };
}

function numberCore(grade: number, variant: number): Core {
  const name = kid(variant);
  const topic = singaporePlace(grade).topics[0]!.name;
  if (grade <= 2) {
    const plus = variant < 18;
    const slot = plus ? variant : variant - 18;
    const left = (grade === 1 ? 1 : 12) + (slot % 9);
    const right = (grade === 1 ? 1 : 6) + Math.floor(slot / 9);
    if (plus) {
      const sum = left + right;
      const solved = whole(sum);
      return {
        strand: "number",
        heuristic: null,
        topic,
        concrete: `${name} has ${left} counters + ${right} counters. How many counters are there?`,
        pictorial: `The bar shows ${left} + ${right}. How many in all?`,
        abstract: `${left} + ${right} = ?`,
        bar: [left, right],
        answer: solved.answer,
        aliases: solved.aliases,
        note: "Join the two parts.",
      };
    }
    const wholeNumber = left + right + (grade === 1 ? 8 : 20);
    const leftPart = wholeNumber - right;
    const solved = whole(leftPart);
    return {
      strand: "number",
      heuristic: null,
      topic,
      concrete: `${name} has ${wholeNumber} counters and gives away ${right}. ${wholeNumber} - ${right} = ?`,
      pictorial: `The bond shows the whole ${wholeNumber} and one part ${right}. What is the other part?`,
      abstract: `${wholeNumber} - ${right} = ?`,
      bond: [wholeNumber, right],
      answer: solved.answer,
      aliases: solved.aliases,
      note: "The other part is the whole minus the part you can see.",
    };
  }
  if (grade === 3 || grade === 4) {
    const a = 2 + (variant % 8);
    const b = 2 + Math.floor(variant / 8);
    if (grade === 3) {
      const solved = whole(a * b);
      return {
        strand: "number",
        heuristic: null,
        topic,
        concrete: `${name} makes ${a} groups × ${b} counters. How many counters are there?`,
        pictorial: `Each box in the bar is ${b}. There are ${a} boxes. ${a} × ${b} = ?`,
        abstract: `${a} × ${b} = ?`,
        bar: Array.from({ length: a }, () => b),
        answer: solved.answer,
        aliases: solved.aliases,
        note: "Multiplication joins equal groups.",
      };
    }
    const product = a * (10 + b);
    const solved = whole(product);
    return {
      strand: "number",
      heuristic: null,
      topic,
      concrete: `${name} calculates ${a} × ${10 + b}. What is the product?`,
      pictorial: `The bar is ${a} copies of ${10 + b}. ${a} × ${10 + b} = ?`,
      abstract: `${a} × ${10 + b} = ?`,
      bar: [a, 10 + b],
      answer: solved.answer,
      aliases: solved.aliases,
      note: "Multiply the two factors.",
    };
  }
  if (grade === 5) {
    const percent = 10 + variant * 2;
    const part = percent / 2;
    const wholeNumber = 50;
    const solved = whole(percent, [`${part}/${wholeNumber}`]);
    return {
      strand: "number",
      heuristic: null,
      topic,
      concrete: `${part} of ${wholeNumber} is what percent? ${part} ÷ ${wholeNumber} × 100 = ?`,
      pictorial: `The bar is ${wholeNumber} long and the shaded part is ${part}. What percent is shaded?`,
      abstract: `${part} ÷ ${wholeNumber} × 100 = ?`,
      bar: [part, wholeNumber - part],
      answer: solved.answer,
      aliases: solved.aliases,
      note: "A percent compares a part with 100.",
    };
  }
  if (grade === 6 || grade === 7 || grade === 8) {
    const coefficient = 2 + (variant % 6) + (grade - 6);
    const x = 2 + grade + (Math.floor(variant / 6) % 6);
    const added = (variant % 5) + (grade - 6);
    const right = coefficient * x + added;
    const solved = whole(x);
    const equation = added === 0 ? `${coefficient}x = ${right}` : `${coefficient}x + ${added} = ${right}`;
    return {
      strand: "algebra",
      heuristic: null,
      topic,
      concrete: `${name} starts with ${x} equal bags and adds ${added}. The total is ${right}. Each bag is the same. x = ?`,
      pictorial: `The bar is ${coefficient} equal parts + ${added}, and the whole is ${right}. x = ?`,
      abstract: `Solve ${equation}. x = ?`,
      bar: [...Array.from({ length: coefficient }, () => x), added].filter((part) => part > 0),
      answer: solved.answer,
      aliases: solved.aliases,
      note: "Undo the added amount, then divide by the coefficient.",
    };
  }
  if (grade === 9) {
    const a = 1 + (variant % 6);
    const b = 1 + (Math.floor(variant / 6) % 6);
    const constant = a * b;
    const solved = whole(constant);
    return {
      strand: "algebra",
      heuristic: null,
      topic,
      concrete: `${name} expands (x + ${a})(x + ${b}). The constant term is ${a} × ${b} = ?`,
      pictorial: `A rectangle has sides x + ${a} and x + ${b}. The corner rectangle is ${a} × ${b} = ?`,
      abstract: `(x + ${a})(x + ${b}). The constant term is ?`,
      bar: [a, b],
      answer: solved.answer,
      aliases: solved.aliases,
      note: "The constant term of (x + a)(x + b) is a × b.",
    };
  }
  if (grade === 10) {
    const a = 1 + variant;
    const solved = whole(2 * a);
    return {
      strand: "calculus",
      heuristic: null,
      topic,
      concrete: `${name} differentiates ${a}x^2. The coefficient of x is 2 × ${a} = ?`,
      pictorial: `The power drops by 1 and the coefficient is multiplied by 2. 2 × ${a} = ?`,
      abstract: `Differentiate ${a}x^2. The coefficient of x is ?`,
      bar: [2, a],
      answer: solved.answer,
      aliases: solved.aliases,
      note: "The derivative of ax^2 is 2ax.",
    };
  }
  if (grade === 11) {
    const slope = 2 + (variant % 5);
    const intercept = variant % 4;
    const input = 1 + Math.floor(variant / 5);
    const value = slope * input + intercept;
    const solved = whole(value);
    const signed = intercept === 0 ? "" : intercept > 0 ? ` + ${intercept}` : ` - ${-intercept}`;
    return {
      strand: "algebra",
      heuristic: null,
      topic,
      concrete: `${name} uses f(x) = ${slope}x${signed}. f(${input}) = ${slope} × ${input} + ${intercept} = ?`,
      pictorial: `Start at ${intercept} and add ${slope} for each step, ${input} times. f(${input}) = ?`,
      abstract: `f(x) = ${slope}x${signed}. f(${input}) = ?`,
      bar: [slope * input, intercept].filter((part) => part > 0),
      answer: solved.answer,
      aliases: solved.aliases,
      note: "Substitute the input, then multiply and add.",
    };
  }
  const first = 2 + (variant % 8);
  const difference = 2 + Math.floor(variant / 8);
  const terms = 5;
  const sum = (terms * (2 * first + (terms - 1) * difference)) / 2;
  const solved = whole(sum);
  return {
    strand: "algebra",
    heuristic: "look for a pattern",
    topic,
    concrete: `${name} adds the series that starts at ${first} and rises by + ${difference}, for ${terms} terms. The sum is ?`,
    pictorial: `Five bars start at ${first} and each next bar is + ${difference}. The total is ?`,
    abstract: `Arithmetic series: first ${first}, difference + ${difference}, ${terms} terms. Sum = ?`,
    bar: [first, first + difference, first + 2 * difference],
    answer: solved.answer,
    aliases: solved.aliases,
    note: "The sum of an arithmetic series is the number of terms times the average of the first and last terms.",
  };
}

function measureCore(grade: number, variant: number): Core {
  const name = kid(variant);
  const topic = singaporePlace(grade).topics[1]!.name;
  const geometry = variant % 2 === 1;
  const a = 2 + (variant % 9);
  const b = 2 + (Math.floor(variant / 9) % 4);
  if (!geometry && grade <= 2) {
    const left = grade === 1 ? a : 20 + a;
    const right = grade === 1 ? b : 10 + b;
    const solved = whole(left + right);
    return {
      strand: geometry ? "geometry" : "measurement",
      heuristic: null,
      topic,
      concrete: `${name} places a ${left} cm strip + a ${right} cm strip in one line. How many cm long is the line?`,
      pictorial: `The bar is ${left} cm + ${right} cm. How long is it?`,
      abstract: `${left} cm + ${right} cm = ?`,
      bar: [left, right],
      answer: solved.answer,
      aliases: [...solved.aliases, `${left + right} cm`],
      note: "Put the lengths end to end.",
    };
  }
  if (!geometry && (grade === 3 || grade === 4)) {
    const value = grade === 3 ? 2 * (a + b) : a * b;
    const solved = whole(value);
    return {
      strand: geometry ? "geometry" : "measurement",
      heuristic: null,
      topic,
      concrete:
        grade === 3
          ? `${name} walks the edge of a rectangle ${a} cm by ${b} cm. Perimeter = 2 × (${a} + ${b}) = ?`
          : `${name} covers a rectangle ${a} cm by ${b} cm. Area = ${a} × ${b} = ?`,
      pictorial: grade === 3 ? `Opposite sides match. 2 × (${a} + ${b}) = ?` : `The bar grid is ${a} by ${b}. ${a} × ${b} = ?`,
      abstract: grade === 3 ? `Perimeter = 2 × (${a} + ${b})` : `Area = ${a} × ${b}`,
      bar: [a, b],
      answer: solved.answer,
      aliases: solved.aliases,
      note: grade === 3 ? "The perimeter adds all four sides." : "The area of a rectangle is length times width.",
    };
  }
  if (!geometry && grade === 5) {
    const base = a * 2;
    const height = b;
    const solved = whole((base * height) / 2);
    return {
      strand: geometry ? "geometry" : "measurement",
      heuristic: null,
      topic,
      concrete: `${name} finds the area of a triangle with base ${base} cm and height ${height} cm. (${base} × ${height}) ÷ 2 = ?`,
      pictorial: `The triangle is half of a ${base} by ${height} rectangle. (${base} × ${height}) ÷ 2 = ?`,
      abstract: `(${base} × ${height}) ÷ 2 = ?`,
      bar: [base, height],
      answer: solved.answer,
      aliases: solved.aliases,
      note: "The area of a triangle is half of base times height.",
    };
  }
  if (!geometry && grade === 6) {
    const depth = 2 + (variant % 3);
    const solved = whole(a * b * depth);
    return {
      strand: geometry ? "geometry" : "measurement",
      heuristic: null,
      topic,
      concrete: `${name} fills a cuboid ${a} cm × ${b} cm × ${depth} cm. Volume = ?`,
      pictorial: `The bar stands for one layer of ${a} × ${b}. There are ${depth} layers. Volume = ?`,
      abstract: `${a} × ${b} × ${depth} = ?`,
      bar: [a, b, depth],
      answer: solved.answer,
      aliases: solved.aliases,
      note: "The volume of a cuboid is length times width times height.",
    };
  }
  if (!geometry && grade === 7) {
    const solved = whole(a * b);
    return {
      strand: geometry ? "geometry" : "measurement",
      heuristic: null,
      topic,
      concrete: `${name} travels at ${a} km/h for ${b} h. Distance = ${a} × ${b} = ?`,
      pictorial: `Each hour on the bar is ${a} km. There are ${b} hours. Distance = ?`,
      abstract: `${a} km/h × ${b} h = ?`,
      bar: Array.from({ length: b }, () => a),
      answer: solved.answer,
      aliases: [...solved.aliases, `${a * b} km`],
      note: "Distance is rate times time.",
    };
  }
  if (!geometry && grade >= 8 && grade <= 10) {
    const k = grade + Math.floor(variant / 2);
    const solved = whole(5 * k);
    return {
      strand: geometry ? "geometry" : "measurement",
      heuristic: null,
      topic,
      concrete: `${name} has a right triangle with legs ${3 * k} and ${4 * k}. (${3 * k})^2 + (${4 * k})^2 gives a hypotenuse of ?`,
      pictorial: `The two legs are ${3 * k} and ${4 * k}. The hypotenuse completes the bar. It is ?`,
      abstract: `Legs ${3 * k} and ${4 * k}. Hypotenuse = ?`,
      bar: [3 * k, 4 * k],
      answer: solved.answer,
      aliases: solved.aliases,
      note: "A 3-4-5 triangle scales. The hypotenuse is 5 times the scale.",
    };
  }
  if (!geometry) {
    const run = 1 + (variant % 5);
    const slope = 1 + (Math.floor(variant / 5) % 5);
    const rise = run * slope;
    const solved = whole(slope);
    return {
      strand: geometry ? "geometry" : "measurement",
      heuristic: null,
      topic,
      concrete: `${name} reads a line that rises ${rise} and runs ${run}. Slope = ${rise} ÷ ${run} = ?`,
      pictorial: `The bar rises ${rise} across a run of ${run}. ${rise} ÷ ${run} = ?`,
      abstract: `Slope = ${rise} ÷ ${run} = ?`,
      bar: [rise, run],
      answer: solved.answer,
      aliases: solved.aliases,
      note: "Slope is rise divided by run.",
    };
  }
  if (grade <= 2) {
    const count = 1 + variant;
    const solved = whole(count * (grade === 1 ? 3 : 4));
    const shape = grade === 1 ? "triangle" : "square";
    const corners = grade === 1 ? 3 : 4;
    return {
      strand: geometry ? "geometry" : "measurement",
      heuristic: null,
      topic,
      concrete: `${name} has ${count} ${shape}s. Each has ${corners} corners. ${count} × ${corners} = ?`,
      pictorial: `The bar is ${count} copies of ${corners} corners. How many corners?`,
      abstract: `${count} × ${corners} = ?`,
      bar: Array.from({ length: Math.min(count, 8) }, () => corners),
      answer: solved.answer,
      aliases: solved.aliases,
      note: grade === 1 ? "A triangle has 3 corners." : "A square has 4 corners.",
    };
  }
  if (grade === 4) {
    const count = 1 + variant;
    const solved = whole(count * 4);
    return {
      strand: geometry ? "geometry" : "measurement",
      heuristic: null,
      topic,
      concrete: `${name} has ${count} rectangles. Each has 4 right angles. ${count} × 4 = ?`,
      pictorial: `The bar is ${count} copies of 4 right angles. How many right angles?`,
      abstract: `Right angles = ${count} × 4`,
      bar: [count, 4],
      answer: solved.answer,
      aliases: solved.aliases,
      note: "A rectangle has 4 right angles.",
    };
  }
  if (grade === 3) {
    const angle = 20 + variant * 3;
    const solved = whole(180 - angle);
    return {
      strand: geometry ? "geometry" : "measurement",
      heuristic: null,
      topic,
      concrete: `${name} sees ${angle}° on a straight line. ${angle}° + ? = 180°`,
      pictorial: `The straight bar is 180°. One part is ${angle}°. The other part is ?`,
      abstract: `180 - ${angle} = ?`,
      bar: [angle, 180 - angle],
      answer: solved.answer,
      aliases: [...solved.aliases, `${180 - angle} degrees`],
      note: "Angles on a straight line add to 180°.",
    };
  }
  if (grade === 6) {
    const angle = 12 + variant * 3;
    const solved = whole(angle);
    return {
      strand: geometry ? "geometry" : "measurement",
      heuristic: null,
      topic,
      concrete: `${name} sees vertically opposite angles. One angle is ${angle}°. The opposite angle is ?`,
      pictorial: `The crossing bars make opposite angles equal. ${angle}° matches ?`,
      abstract: `Opposite angle = ${angle}`,
      bar: [angle, angle],
      answer: solved.answer,
      aliases: [...solved.aliases, `${angle} degrees`],
      note: "Vertically opposite angles are equal.",
    };
  }
  if (grade === 5) {
    const first = 20 + variant;
    const second = 35;
    const third = 180 - first - second;
    const solved = whole(third);
    return {
      strand: geometry ? "geometry" : "measurement",
      heuristic: null,
      topic,
      concrete: `${name} knows two angles of a triangle: ${first}° and ${second}°. ${first} + ${second} + ? = 180`,
      pictorial: `The angle bar totals 180°. Two parts are ${first} and ${second}. The third is ?`,
      abstract: `180 - ${first} - ${second} = ?`,
      bar: [first, second, third],
      answer: solved.answer,
      aliases: solved.aliases,
      note: "The angles of a triangle add to 180°.",
    };
  }
  if (grade === 7) {
    const sides = 3 + variant;
    const solved = whole((sides - 2) * 180);
    return {
      strand: geometry ? "geometry" : "measurement",
      heuristic: null,
      topic,
      concrete: `${name} finds the interior-angle sum of a ${sides}-sided polygon. (${sides} - 2) × 180 = ?`,
      pictorial: `The polygon splits into ${sides - 2} triangles. ${sides - 2} × 180 = ?`,
      abstract: `(${sides} - 2) × 180 = ?`,
      bar: [sides - 2, 180],
      answer: solved.answer,
      aliases: solved.aliases,
      note: "A polygon with n sides splits into n - 2 triangles.",
    };
  }
  const k = grade + variant;
  const solved = whole(5 * k);
  return {
    strand: geometry ? "geometry" : "measurement",
    heuristic: null,
    topic,
    concrete: `${name} measures legs ${3 * k} and ${4 * k}. (${3 * k})^2 + (${4 * k})^2. Hypotenuse = ?`,
    pictorial: `The right angle sits between ${3 * k} and ${4 * k}. The hypotenuse is ?`,
    abstract: `sqrt((${3 * k})^2 + (${4 * k})^2) = ?`,
    bar: [3 * k, 4 * k],
    answer: solved.answer,
    aliases: solved.aliases,
    note: "Scale a 3-4-5 triangle.",
  };
}

function dataCore(grade: number, variant: number): Core {
  const name = kid(variant);
  const topic = singaporePlace(grade).topics[2]!.name;
  if (grade <= 4) {
    const first = grade + (variant % 9);
    const second = grade + 1 + (Math.floor(variant / 9) % 4);
    const solved = whole(first + second);
    return {
      strand: "data",
      heuristic: null,
      topic,
      concrete: `${name} draws ${first} stars + ${second} stars on a picture graph. How many stars?`,
      pictorial: `One row of the graph is ${first} and the other is ${second}. ${first} + ${second} = ?`,
      abstract: `Graph: ${first} + ${second} = ?`,
      bar: [first, second],
      answer: solved.answer,
      aliases: solved.aliases,
      note: "Add the amounts the graph shows.",
    };
  }
  if (grade <= 7 || grade === 12) {
    const mean = grade * 10 + variant;
    const low = mean - 2;
    const high = mean + 3;
    const third = mean - 1;
    const solved = whole(mean);
    return {
      strand: "data",
      heuristic: null,
      topic,
      concrete: `${name} finds the average of ${low}, ${high}, and ${third}. (${low} + ${high} + ${third}) ÷ 3 = ?`,
      pictorial: `Three bars level off at the average. (${low} + ${high} + ${third}) ÷ 3 = ?`,
      abstract: `(${low} + ${high} + ${third}) ÷ 3 = ?`,
      bar: [low, high, third],
      answer: solved.answer,
      aliases: solved.aliases,
      note: "The average is the total divided by how many values there are.",
    };
  }
  if (grade === 11) {
    const n = 4 + variant;
    const solved = whole((n * (n - 1)) / 2);
    return {
      strand: "data",
      heuristic: null,
      topic,
      concrete: `${name} chooses 2 items from ${n}. The number of ways is ${n} × ${n - 1} ÷ 2 = ?`,
      pictorial: `Each of ${n} items pairs with the others once. ${n} × ${n - 1} ÷ 2 = ?`,
      abstract: `C(${n}, 2) = ?`,
      bar: [n, n - 1],
      answer: solved.answer,
      aliases: solved.aliases,
      note: "The number of ways to choose 2 items from n is n × (n - 1) ÷ 2.",
    };
  }
  const total = 8 + grade + variant;
  const favorable = 1 + (variant % 4);
  const text = fraction(favorable, total);
  return {
    strand: "data",
    heuristic: null,
    topic,
    concrete: `${name} has ${favorable} wanted outcomes out of ${total}. Probability = ${favorable} ÷ ${total} = ?`,
    pictorial: `The bar has ${total} equal parts and ${favorable} are shaded. The probability is ?`,
    abstract: `${favorable}/${total} in simplest form is ?`,
    bar: [favorable, total - favorable],
    answer: text,
    aliases: [String(favorable / total), `${favorable} / ${total}`],
    note: "Probability is the number of wanted outcomes divided by the number of equally likely outcomes.",
  };
}

function heuristicCore(grade: number, variant: number): Core {
  const name = kid(variant);
  const kind = (["bar model", "work backwards", "guess and check", "look for a pattern"] as const)[variant % 4]!;
  const slot = Math.floor(variant / 4);
  const topic = "Thinking skills and heuristics";
  const a = 2 + (slot % 9) + grade;
  const b = 3 + (slot % 5);
  if (kind === "bar model") {
    const solved = whole(a + b);
    return {
      strand: "number",
      heuristic: "bar model",
      topic,
      concrete: `${name} uses a bar model for ${a} + ${b}. What is the whole?`,
      pictorial: `Read the bar for ${a} + ${b}. What is the whole?`,
      abstract: `Bar model: ${a} + ${b} = ?`,
      bar: [a, b],
      answer: solved.answer,
      aliases: solved.aliases,
      note: "A bar model shows the parts and the whole.",
    };
  }
  if (kind === "work backwards") {
    const total = a + b;
    const solved = whole(a);
    return {
      strand: "number",
      heuristic: "work backwards",
      topic,
      concrete: `${name} ended at ${total} after adding ${b}. Work backwards. ${total} - ${b} = ?`,
      pictorial: `The bond shows the whole ${total} and the added part ${b}. The start is ?`,
      abstract: `Work backwards: ${total} - ${b} = ?`,
      bond: [total, b],
      answer: solved.answer,
      aliases: solved.aliases,
      note: "Work backwards undoes the last step.",
    };
  }
  if (kind === "guess and check") {
    const solved = whole(a);
    return {
      strand: "number",
      heuristic: "guess and check",
      topic,
      concrete: `${name} tries ${a} and ${a + 1}. Which one makes the number + ${b} equal ${a + b}?`,
      pictorial: `Check ${a} + ${b} and ${a + 1} + ${b}. Which first number works?`,
      abstract: `Guess and check: n + ${b} = ${a + b}. n = ?`,
      bar: [a, b],
      answer: solved.answer,
      aliases: solved.aliases,
      note: "Guess a number, check it, and keep the one that fits.",
    };
  }
  const difference = 2 + (slot % 4);
  const start = 1 + (slot % 6) + grade;
  const next = start + 3 * difference;
  const solved = whole(next);
  return {
    strand: "number",
    heuristic: "look for a pattern",
    topic,
    concrete: `${name} sees ${start}, ${start + difference}, ${start + 2 * difference}. The pattern adds + ${difference}. What is next?`,
    pictorial: `Each step of the bar grows by + ${difference}. After ${start + 2 * difference}, the next is ?`,
    abstract: `${start}, ${start + difference}, ${start + 2 * difference}, ... + ${difference}. Next = ?`,
    bar: [start, start + difference, start + 2 * difference],
    answer: solved.answer,
    aliases: solved.aliases,
    note: "A pattern repeats the same change.",
  };
}

function coreFor(grade: number, family: number, variant: number): Core {
  if (family === 1) return measureCore(grade, variant);
  if (family === 2) return dataCore(grade, variant);
  if (family === 3) return heuristicCore(grade, variant);
  return numberCore(grade, variant);
}

export function sgCell(grade: number, step: number): Cell {
  const level = Math.min(12, Math.max(1, Math.round(grade) || 1));
  const stage = STAGES[Math.min(2, Math.max(0, Math.round(step) || 0))]!;
  return {
    count: SG_CELL_COUNT,
    build(index) {
      const wrapped = ((Math.trunc(index) % SG_CELL_COUNT) + SG_CELL_COUNT) % SG_CELL_COUNT;
      const family = wrapped % SG_FAMILIES;
      const variant = Math.floor(wrapped / SG_FAMILIES);
      return pack(level, stage, coreFor(level, family, variant));
    },
  };
}

export type BandCount = { id: string; name: string; raw: number; distinct: number };

/** Distinct questions in each Singapore band. The key keeps operators, so 3 + 4 and 3 - 4 stay apart. */
export function singaporeBandCensus(): { bands: BandCount[]; distinct: number; raw: number } {
  const seen = new Map<string, Set<string>>();
  const raw = new Map<string, number>();
  for (const band of BANDS) {
    seen.set(band.id, new Set());
    raw.set(band.id, 0);
  }
  let all = new Set<string>();
  let total = 0;
  for (const band of BANDS) {
    for (const grade of band.grades) {
      for (let step = 0; step < STAGES.length; step += 1) {
        const cell = sgCell(grade, step);
        raw.set(band.id, (raw.get(band.id) ?? 0) + cell.count);
        total += cell.count;
        for (let index = 0; index < cell.count; index += 1) {
          const key = questionKey(cell.build(index).stem);
          seen.get(band.id)!.add(key);
          all.add(key);
        }
      }
    }
  }
  return {
    bands: BANDS.map((band) => ({
      id: band.id,
      name: band.label,
      raw: raw.get(band.id) ?? 0,
      distinct: seen.get(band.id)?.size ?? 0,
    })),
    distinct: all.size,
    raw: total,
  };
}
