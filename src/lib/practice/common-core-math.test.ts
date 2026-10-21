import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  PRACTICE_GRADES,
  makeMathSheet,
  parsePracticeGrade,
  standardsForGrade,
  type MathQuestion,
  type PracticeGrade,
} from "./common-core-math.ts";

const K8 = /^(?:K|[1-8])\.[A-Z]{1,4}\.[A-Z]\.\d+$/;
const HS = /^HS[A-Z]-[A-Z]{1,4}\.[A-Z]\.\d+$/;
const HS_DOMAINS = ["Number & Quantity", "Algebra", "Functions", "Geometry", "Statistics & Probability"];
const K_DOMAINS = [
  "Counting and Cardinality",
  "Operations and Algebraic Thinking",
  "Number and Operations in Base Ten",
  "Measurement and Data",
  "Geometry",
];

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

function expected(question: MathQuestion): string {
  const n = question.nums;
  switch (question.op) {
    case "add":
      return String(n[0]! + n[1]!);
    case "add3":
      return String(n[0]! + n[1]! + n[2]!);
    case "sub":
    case "more":
      return String(n[0]! - n[1]!);
    case "mul":
      return String(n[0]! * n[1]!);
    case "div":
      return String(n[0]! / n[1]!);
    case "next":
      return String(n[0]! + 1);
    case "ten-more":
      return String(n[0]! + 10);
    case "ten-less":
      return String(n[0]! - 10);
    case "hundred-more":
      return String(n[0]! + 100);
    case "hundred-less":
      return String(n[0]! - 100);
    case "compare":
      return n[0]! > n[1]! ? ">" : n[0]! < n[1]! ? "<" : "=";
    case "make10":
      return String(10 - n[0]!);
    case "tens-digit":
      return String(Math.floor(n[0]! / 10) % 10);
    case "hundreds-digit":
      return String(Math.floor(n[0]! / 100) % 10);
    case "ones-digit":
      return String(n[0]! % 10);
    case "skip":
      return String(n[0]! + n[1]!);
    case "area":
      return String(n[0]! * n[1]!);
    case "perim":
      return String(2 * (n[0]! + n[1]!));
    case "volume":
      return String(n[0]! * n[1]! * n[2]!);
    case "frac":
      return formatFrac(n[0]!, n[1]!);
    case "frac-add":
      return formatFrac(n[0]! + n[1]!, n[2]!);
    case "frac-add-unlike":
      return formatFrac(n[0]! * n[3]! + n[2]! * n[1]!, n[1]! * n[3]!);
    case "frac-mul":
      return formatFrac(n[0]! * n[2]!, n[1]! * n[3]!);
    case "whole-frac":
      return formatFrac(n[0]! * n[1]!, n[2]!);
    case "percent":
      return String((n[0]! * n[1]!) / 100);
    case "pythag": {
      const c = Math.round(Math.sqrt(n[0]! ** 2 + n[1]! ** 2));
      assert.equal(c * c, n[0]! ** 2 + n[1]! ** 2);
      return String(c);
    }
    case "mean": {
      const sum = n.reduce((total, value) => total + value, 0);
      assert.equal(sum % n.length, 0);
      return String(sum / n.length);
    }
    case "gcf":
      return String(gcd(n[0]!, n[1]!));
    case "equation":
      return String(n[1]! - n[0]!);
    case "count":
    case "recall":
    case "first":
    case "same":
      return String(n[0]!);
    case "second":
      return String(n[1]!);
    case "parity":
      return n[0]! % 2 === 0 ? "even" : "odd";
    case "round10":
      return String(rounded10(n[0]!));
    case "round100":
      return String(rounded100(n[0]!));
    case "round-tenth":
      return roundedTenth(n[0]!, n[1]!, n[2]!);
    case "tenths-add":
      return formatTenths(n[0]! * 10 + n[1]! + (n[2]! * 10 + n[3]!));
    case "max":
      return String(Math.max(...n));
    case "neg-add":
      return String(n[0]! + n[1]!);
    case "neg-mul":
      return String(n[0]! * n[1]!);
    case "mul-add":
      return String(n[0]! * n[1]! + n[2]!);
    case "paren-mul":
      return String((n[0]! + n[1]!) * n[2]!);
    case "prop":
      return String((n[1]! / n[0]!) * n[2]!);
    case "system-x":
      return String((n[0]! + n[1]!) / 2);
    case "linear":
      return String(n[0]! * n[2]! + n[1]!);
    case "exp":
      return String(n[0]! ** n[1]!);
    case "sqrt": {
      const root = Math.round(Math.sqrt(n[0]!));
      assert.equal(root * root, n[0]!);
      return String(root);
    }
    case "pow10":
      return String(n[0]! * 10 ** n[1]!);
    case "cone-pi":
      return String((n[0]! * n[0]! * n[1]!) / 3);
    case "delta-y":
      return String(n[3]! - n[1]!);
    case "real-sum":
      return String(n[0]! + n[2]!);
    case "or":
      return String(n[0]! + n[1]! - n[2]!);
    case "slope":
      return String(n[0]! / n[1]!);
    case "factor-yes":
      return n[1]! % n[0]! === 0 ? "yes" : "no";
    case "irrational-root":
      return isPerfectSquare(n[0]!) ? "rational" : "irrational";
    case "rat-times-root":
      return isPerfectSquare(n[1]!) ? "rational" : "irrational";
    case "rational-int":
      return "rational";
    case "linear-add":
      return "linear";
    case "exp-double":
      return "exponential";
    case "eq-check":
      return n[0]! + n[1]! === n[2]! ? "=" : "no";
    case "dec-10":
      return `0.${n[0]!}`;
    case "div-unit":
      return String((n[0]! * n[2]!) / n[1]!);
    case "px-q":
      return String((n[2]! - n[1]!) / n[0]!);
    default:
      throw new Error(`unknown op ${question.op}`);
  }
}

const WORD_OPS = new Set([
  "compare",
  "parity",
  "factor-yes",
  "irrational-root",
  "rat-times-root",
  "linear-add",
  "exp-double",
  "eq-check",
  "rational-int",
]);
const FRACTION_OPS = new Set(["frac", "frac-add", "frac-add-unlike", "frac-mul", "whole-frac"]);
const DECIMAL_OPS = new Set(["tenths-add", "round-tenth", "dec-10"]);

function checkQuestion(grade: PracticeGrade, question: MathQuestion): void {
  const where = `${grade} ${question.code} ${question.op} ${question.prompt}`;
  assert.equal(question.answer, expected(question), where);
  assert.ok(question.prompt.length > 0, where);
  assert.ok(question.domain.length > 0, where);
  if (question.op !== "recall") {
    for (const value of question.nums) {
      assert.ok(question.prompt.includes(String(value)), `${where} missing ${value}`);
    }
  }
  if (FRACTION_OPS.has(question.op)) {
    assert.match(question.answer, /^\d+(?:\/\d+)?$/, where);
  } else if (!WORD_OPS.has(question.op) && !DECIMAL_OPS.has(question.op)) {
    assert.match(question.answer, /^-?\d+$/, where);
  }
}

describe("common core math practice", () => {
  it("parses a typed level and leaves other words alone", () => {
    assert.equal(parsePracticeGrade("K"), "K");
    assert.equal(parsePracticeGrade(" k "), "K");
    assert.equal(parsePracticeGrade("kindergarten"), "K");
    assert.equal(parsePracticeGrade("Grade K"), "K");
    assert.equal(parsePracticeGrade("0"), "K");
    assert.equal(parsePracticeGrade("3"), "3");
    assert.equal(parsePracticeGrade("grade 12"), "12");
    assert.equal(parsePracticeGrade("13"), null);
    assert.equal(parsePracticeGrade(""), null);
    assert.equal(parsePracticeGrade("third"), null);
  });

  it("reuses the finish email layout on the parent sheet", () => {
    const page = readFileSync(new URL("../../routes/practice.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");
    const shell = readFileSync(new URL("../../components/shell.tsx", import.meta.url), "utf8");
    const home = readFileSync(new URL("../../routes/index.tsx", import.meta.url), "utf8");
    assert.match(page, /createFileRoute\("\/practice"\)/);
    assert.match(page, /reportHtml/);
    assert.match(page, /academicLetter/);
    assert.match(page, /Free Math Practice/);
    assert.match(page, /New questions/);
    assert.match(page, /This page is free\. You do not pay to make these questions\./);
    assert.match(page, /math-key/);
    assert.doesNotMatch(page, /from\s+["']@\/lib\/academic-email/);
    assert.match(css, /reportHtml/);
    assert.match(css, /#173028/);
    assert.match(css, /#c6a15a/);
    assert.match(css, /#2c5e4a/);
    assert.match(css, /#fffdf8/);
    assert.match(css, /#e7efe9/);
    assert.match(shell, /to="\/practice"/);
    assert.match(shell, /Free Math Practice/);
    assert.match(shell, /!path\.startsWith\("\/session"\)/);
    assert.match(home, /to="\/practice"/);
    assert.match(home, /Free Math Practice/);
  });

  it("keeps the generator free of app-only imports", () => {
    const source = readFileSync(new URL("./common-core-math.ts", import.meta.url), "utf8");
    assert.doesNotMatch(source, /from\s+["']@\//);
    assert.doesNotMatch(source, /academic-email/);
    assert.doesNotMatch(source, /openai|fetch\(/);
  });

  it("covers real standards for every grade, including 3.OA.C.7", () => {
    assert.ok(standardsForGrade("3").some((item) => item.code === "3.OA.C.7"));
    for (const grade of PRACTICE_GRADES) {
      const standards = standardsForGrade(grade);
      assert.ok(standards.length >= 10, grade);
      const codes = standards.map((item) => item.code);
      assert.equal(new Set(codes).size, codes.length, grade);
      const high = Number(grade) >= 9;
      for (const item of standards) {
        assert.match(item.code, high ? HS : K8, item.code);
        assert.ok(item.domain.length > 0);
      }
      if (grade === "K") {
        for (const domain of K_DOMAINS) {
          assert.ok(standards.some((item) => item.domain === domain), domain);
        }
      }
      if (high) {
        for (const domain of HS_DOMAINS) {
          assert.ok(standards.some((item) => item.domain === domain), `${grade} ${domain}`);
        }
        assert.ok(standards.every((item) => item.domain !== "Statistics and Probability"));
      } else {
        assert.ok(standards.every((item) => item.domain !== "Number & Quantity"));
        assert.ok(standards.every((item) => item.domain !== "Statistics & Probability"));
      }
    }
  });

  it("makes 10 different questions with correct answers, and two seeds differ", () => {
    for (const grade of PRACTICE_GRADES) {
      const allowed = new Set(standardsForGrade(grade).map((item) => item.code));
      const first = makeMathSheet(grade, 1);
      const second = makeMathSheet(grade, 2);
      for (const sheet of [first, second]) {
        assert.equal(sheet.length, 10, grade);
        assert.equal(new Set(sheet.map((item) => item.code)).size, 10, grade);
        assert.equal(new Set(sheet.map((item) => item.prompt)).size, 10, grade);
        for (const question of sheet) {
          assert.ok(allowed.has(question.code), `${grade} ${question.code}`);
          checkQuestion(grade, question);
        }
      }
      const left = first.map((item) => `${item.prompt}|${item.answer}`).join("\n");
      const right = second.map((item) => `${item.prompt}|${item.answer}`).join("\n");
      assert.notEqual(left, right, grade);
    }
  });

  it("stays correct across more seeds", () => {
    for (const grade of PRACTICE_GRADES) {
      for (let seed = 3; seed <= 12; seed += 1) {
        const sheet = makeMathSheet(grade, seed);
        assert.equal(sheet.length, 10);
        for (const question of sheet) checkQuestion(grade, question);
      }
    }
  });
});
