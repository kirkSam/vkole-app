import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { questionKey } from "./next-sheet.ts";
import { moveVkoleRung } from "./vkole-cap.ts";
import { nextVariant, poolQuestion, type BagState } from "./question-pool.ts";
import { parseSchoolProfile } from "./school-account.ts";
import { formatMasteryReport, masteryFromDetails } from "./vkole-singapore-report.ts";
import { sgCell, singaporeBandCensus } from "./vkole-singapore-pool.ts";
import { gradeRisesOnlyAfterAbstract, parseSgCode, singaporePlace, STAGES } from "./vkole-singapore.ts";

describe("Singapore spine", () => {
  it("maps Primary through H2 onto US grades 1 to 12", () => {
    assert.equal(singaporePlace(1).moe, "Primary 1");
    assert.equal(singaporePlace(6).moe, "Primary 6");
    assert.equal(singaporePlace(7).moe, "Secondary 1");
    assert.equal(singaporePlace(7).course, "O-Level Mathematics");
    assert.equal(singaporePlace(9).moe, "Secondary 3");
    assert.match(singaporePlace(9).course, /Additional Mathematics/);
    assert.equal(singaporePlace(10).moe, "Secondary 4");
    assert.equal(singaporePlace(11).moe, "H1 Mathematics");
    assert.equal(singaporePlace(12).moe, "H2 Mathematics");
    assert.equal(singaporePlace(12).short, "US Grade 12 · H2 Mathematics");
  });

  it("moves the grade up only after the abstract step is correct", () => {
    const concrete = moveVkoleRung({ grade: 3, step: 0, correct: true, correctStreak: 1, missStreak: 0 });
    assert.equal(concrete.grade, 3);
    assert.equal(concrete.step, 1);
    const pictorial = moveVkoleRung({ grade: 3, step: 1, correct: true, correctStreak: 1, missStreak: 0 });
    assert.equal(pictorial.grade, 3);
    assert.equal(pictorial.step, 2);
    const oneAbstract = moveVkoleRung({ grade: 3, step: 2, correct: true, correctStreak: 0, missStreak: 0 });
    assert.equal(oneAbstract.grade, 3);
    const twoAbstract = moveVkoleRung({ grade: 3, step: 2, correct: true, correctStreak: 1, missStreak: 0 });
    assert.equal(twoAbstract.grade, 4);
    assert.equal(twoAbstract.step, 0);
    assert.equal(gradeRisesOnlyAfterAbstract(3, 2, 4, 0), true);
    assert.equal(gradeRisesOnlyAfterAbstract(3, 0, 4, 0), false);
  });
});

describe("Singapore questions", () => {
  it("keeps operators in the dedupe key", () => {
    assert.notEqual(questionKey("3 + 4"), questionKey("3 - 4"));
    assert.notEqual(questionKey("3 × 4"), questionKey("3 ÷ 4"));
    assert.equal(questionKey("8 + 3"), questionKey("8+3"));
  });

  it("computes the abstract grade 1 sum and draws a bar before the abstract step", () => {
    const concrete = poolQuestion("sg", 1, 0, 0);
    const pictorial = poolQuestion("sg", 1, 1, 0);
    const abstract = poolQuestion("sg", 1, 2, 0);
    assert.match(concrete.stem, /1 counters \+ 1 counters/);
    assert.match(pictorial.stem, /^\[bar 1 1\]/);
    assert.equal(abstract.stem, "1 + 1 = ?");
    assert.equal(abstract.answer, "2");
    assert.equal(parseSgCode(abstract.standard)?.strand, "number");
    assert.equal(parseSgCode(pictorial.standard)?.heuristic, "bar-model");
  });

  it("gives every stage at least 50 distinct questions and reports bands", () => {
    for (let grade = 1; grade <= 12; grade += 1) {
      for (let step = 0; step < STAGES.length; step += 1) {
        const cell = sgCell(grade, step);
        assert.ok(cell.count >= 50, `grade ${grade} step ${step} has ${cell.count}`);
        const keys = new Set<string>();
        for (let index = 0; index < cell.count; index += 1) {
          const built = cell.build(index);
          assert.ok(built.answer.trim());
          assert.match(built.standard, /^SG\./);
          if (step === 1) assert.match(built.stem, /^\[(?:bar|bond)\b/);
          if (step === 2) assert.match(built.stem, /[+\-×÷*/=^]/);
          keys.add(questionKey(built.stem));
        }
        assert.equal(keys.size, cell.count, `grade ${grade} ${STAGES[step]} collapsed operators or repeated a stem`);
      }
    }
    const census = singaporeBandCensus();
    assert.equal(census.bands.length, 3);
    for (const band of census.bands) {
      assert.ok(band.distinct >= 50, `${band.name} distinct ${band.distinct}`);
      assert.ok(band.distinct <= band.raw);
    }
    assert.ok(census.distinct >= Math.max(...census.bands.map((band) => band.distinct)));
  });

  it("does not repeat one of the last 50 Singapore questions", () => {
    let state: BagState | null = null;
    const recent = new Set<number>();
    const count = sgCell(4, 1).count;
    for (let turn = 0; turn < 50; turn += 1) {
      const next = nextVariant(count, state, recent, Math.random);
      assert.equal(recent.has(next.index), false);
      recent.add(next.index);
      state = next.state;
    }
  });
});

describe("Singapore mastery", () => {
  it("reports each strand and each heuristic", () => {
    const mastery = masteryFromDetails([
      { detail: JSON.stringify({ code: "SG.3.number.bar-model" }), correct: true },
      { detail: JSON.stringify({ code: "SG.3.measure" }), correct: false },
      { detail: JSON.stringify({ code: "SG.3.number.patterns" }), correct: true },
    ]);
    const report = formatMasteryReport(mastery);
    assert.match(report, /Number and algebra: 2 of 2 correct/);
    assert.match(report, /Measurement and geometry: 0 of 1 correct/);
    assert.match(report, /Statistics: 0 of 0 correct/);
    assert.match(report, /Bar model: 1 of 1 correct/);
    assert.match(report, /Patterns: 1 of 1 correct/);
    assert.match(report, /Work backwards: 0 of 0 correct/);
    assert.match(report, /Guess and check: 0 of 0 correct/);
  });

  it("keeps mastery on the website account level", () => {
    const parsed = parseSchoolProfile({
      ok: true,
      id: "ada@school.test",
      profile: {
        access: "open",
        level: {
          sg: {
            grade: 4,
            step: 2,
            mastery: {
              strands: { number: { correct: 3, asked: 4 } },
              heuristics: { "bar-model": { correct: 1, asked: 1 } },
            },
          },
        },
      },
    });
    assert.equal(parsed?.profile.level.sg?.grade, 4);
    assert.equal(parsed?.profile.level.sg?.step, 2);
    assert.deepEqual(parsed?.profile.level.sg?.mastery?.strands.number, { correct: 3, asked: 4 });
    assert.deepEqual(parsed?.profile.level.sg?.mastery?.heuristics["bar-model"], { correct: 1, asked: 1 });
  });
});
