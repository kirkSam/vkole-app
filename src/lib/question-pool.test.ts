import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  answersMatch,
  chooseNext,
  generatedQuestionOk,
  nearDuplicate,
  nextVariant,
  poolCensus,
  poolCount,
  poolQuestion,
  type BagState,
} from "./question-pool.ts";

describe("question pool size", () => {
  it("gives every standard at least 50 distinct questions", () => {
    const census = poolCensus();
    for (const subject of ["m", "ela", "ss", "gen"] as const) {
      for (let grade = 1; grade <= 12; grade += 1) {
        for (let step = 0; step < 3; step += 1) {
          const count = census.subjects[subject].grades[grade][step];
          assert.ok(count >= 50, `${subject} grade ${grade} step ${step} has ${count}`);
          const stems = new Set<string>();
          for (let index = 0; index < count; index += 1) stems.add(poolQuestion(subject, grade, step, index).stem);
          assert.ok(stems.size >= 50, `${subject} grade ${grade} step ${step} has ${stems.size} wordings`);
        }
      }
    }
    assert.ok(census.subjects.m.total > 10000);
    assert.ok(census.subjects.ela.total > 1000);
    assert.ok(census.subjects.ss.total > 1000);
    assert.ok(census.subjects.gen.total > 1000);
  });
});

describe("procedural answers", () => {
  it("computes grade 1 addition instead of storing a fixed bank", () => {
    const first = poolQuestion("m", 1, 0, 0);
    assert.equal(first.stem, "1 + 1 = ?");
    assert.equal(first.answer, "2");
    assert.equal(poolQuestion("m", 1, 0, 0).stem, first.stem);
    for (let index = 0; index < 96; index += 1) {
      const question = poolQuestion("m", 1, 0, index);
      const matched = /^(\d+) \+ (\d+) = \?$/.exec(question.stem);
      assert.ok(matched);
      assert.equal(question.answer, String(Number(matched[1]) + Number(matched[2])));
    }
  });

  it("accepts a numeral, a number word, or an equivalent fraction", () => {
    assert.equal(answersMatch("2", "2"), true);
    assert.equal(answersMatch("2", "two", ["two"]), true);
    assert.equal(answersMatch("1/2", "0.5"), true);
    assert.equal(answersMatch("A", "a."), true);
    assert.equal(answersMatch("the judicial branch", "not the judicial branch"), false);
    assert.equal(answersMatch("8", "9"), false);
  });
});

describe("shuffle bag", () => {
  it("does not repeat one of the last 50 while unused questions remain", () => {
    let state: BagState | null = null;
    const recent = new Set<number>();
    const seen: number[] = [];
    for (let turn = 0; turn < 50; turn += 1) {
      const next = nextVariant(80, state, recent, Math.random);
      assert.equal(recent.has(next.index), false);
      seen.push(next.index);
      recent.add(next.index);
      state = next.state;
    }
    assert.equal(new Set(seen).size, 50);
  });

  it("uses a standard's whole pool before a repeat is allowed", () => {
    let state: BagState | null = null;
    const recent = new Set<number>();
    const seen: number[] = [];
    for (let turn = 0; turn < 10; turn += 1) {
      const next = nextVariant(10, state, recent, () => 0.25);
      seen.push(next.index);
      recent.add(next.index);
      state = next.state;
    }
    assert.equal(new Set(seen).size, 10);
    const again = nextVariant(10, state, recent, () => 0.25);
    assert.ok(again.index >= 0 && again.index < 10);
  });

  it("deals different wordings for one standard", () => {
    let state: BagState | null = null;
    const recent = new Set<number>();
    const stems = new Set<string>();
    const count = poolCount("ela", 1, 2);
    for (let turn = 0; turn < 40; turn += 1) {
      const next = nextVariant(count, state, recent, Math.random);
      stems.add(poolQuestion("ela", 1, 2, next.index).stem);
      recent.add(next.index);
      state = next.state;
    }
    assert.equal(stems.size, 40);
  });
});

describe("model questions", () => {
  it("rejects a near-duplicate or a question about text the child cannot see", () => {
    assert.equal(nearDuplicate("What is 8 + 3?", ["What is 8 + 3?"]), true);
    assert.equal(nearDuplicate("What is 8 + 3?", ["What is 8 + 4?"]), false);
    assert.equal(generatedQuestionOk("Read the passage and answer the question.", []), false);
    assert.equal(generatedQuestionOk("Read:\nThe dog sat down.\n\nQuestion: What did the dog do?", []), true);
    assert.equal(generatedQuestionOk("What is 8 + 3?", ["What is 8 + 3?"]), false);
  });

  it("keeps the computed pool question when that is the question the child should see", () => {
    const pool = poolQuestion("m", 4, 2, 3);
    const chosen = chooseNext({
      modelPrompt: "Round 18 to the nearest ten.",
      recent: [],
      pool,
      preferPool: true,
    });
    assert.equal(chosen.fromPool, true);
    assert.equal(chosen.prompt, pool.stem);
    const fallback = chooseNext({
      modelPrompt: "Look at the passage and answer.",
      recent: ["Round 18 to the nearest ten."],
      pool,
      preferPool: false,
    });
    assert.equal(fallback.fromPool, true);
    assert.equal(fallback.prompt, pool.stem);
  });
});
