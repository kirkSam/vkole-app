import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyAnswer } from "./climb-rules.ts";
import { questionKey } from "./next-sheet.ts";
import { moveVkoleRung } from "./vkole-cap.ts";
import { nextVariant, poolQuestion, type BagState } from "./question-pool.ts";
import { parseSchoolProfile } from "./school-account.ts";
import { formatMasteryReport, masteryFromDetails } from "./vkole-singapore-report.ts";
import { sgCell, singaporeBandCensus } from "./vkole-singapore-pool.ts";
import { BANDS, gradeRisesOnlyAfterAbstract, parseSgCode, singaporePlace, STAGES } from "./vkole-singapore.ts";

describe("Singapore spine", () => {
  it("maps US grades 1 to 12 onto P1-P6, S1-S4, AM, and H2", () => {
    assert.equal(BANDS.length, 12);
    assert.deepEqual(
      BANDS.map((band) => band.label),
      [
        "P1",
        "P2",
        "P3",
        "P4",
        "P5",
        "P6",
        "S1",
        "S2",
        "S3",
        "S4",
        "AM (Additional Mathematics)",
        "H2 (H1 and H2 Mathematics)",
      ],
    );
    assert.equal(singaporePlace(1).short, "US 1 · P1");
    assert.equal(singaporePlace(6).short, "US 6 · P6");
    assert.equal(singaporePlace(7).short, "US 7 · S1");
    assert.equal(singaporePlace(7).course, "O-Level Mathematics");
    assert.equal(singaporePlace(10).short, "US 10 · S4");
    assert.equal(singaporePlace(10).course, "O-Level Mathematics");
    assert.equal(singaporePlace(11).short, "US 11 · AM (Additional Mathematics)");
    assert.equal(singaporePlace(11).course, "Additional Mathematics");
    assert.equal(singaporePlace(12).short, "US 12 · H2 (H1 and H2 Mathematics)");
    assert.equal(singaporePlace(12).course, "H1 and H2 Mathematics");
  });

  it("moves one step at a time and changes grade only after abstract", () => {
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
    const oneMiss = moveVkoleRung({ grade: 4, step: 1, correct: false, correctStreak: 0, missStreak: 0 });
    assert.equal(oneMiss.grade, 4);
    assert.equal(oneMiss.step, 1);
    const downStep = moveVkoleRung({ grade: 4, step: 1, correct: false, correctStreak: 0, missStreak: 1 });
    assert.equal(downStep.grade, 4);
    assert.equal(downStep.step, 0);
    const downGrade = moveVkoleRung({ grade: 4, step: 0, correct: false, correctStreak: 0, missStreak: 1 });
    assert.equal(downGrade.grade, 3);
    assert.equal(downGrade.step, 2);
    const floor = moveVkoleRung({ grade: 1, step: 0, correct: false, correctStreak: 0, missStreak: 1 });
    assert.equal(floor.grade, 1);
    assert.equal(floor.step, 0);
    const cap = moveVkoleRung({ grade: 12, step: 2, correct: true, correctStreak: 1, missStreak: 0 });
    assert.equal(cap.grade, 12);
    assert.equal(cap.step, 2);
    assert.equal(cap.capped, true);
  });

  it("does not climb a whole grade from the shared answer move", () => {
    const base = { level: 3, step: 0, correctAtLevel: 1, incorrectStreak: 0, asked: 2, rightCount: 1 };
    const up = applyAnswer(base, true);
    assert.equal(up.state.level, 3);
    assert.equal(up.state.step, 1);
    const abstract = applyAnswer({ ...base, step: 2 }, true);
    assert.equal(abstract.state.level, 4);
    assert.equal(abstract.state.step, 0);
    const down = applyAnswer({ ...base, correctAtLevel: 0, incorrectStreak: 1 }, false);
    assert.equal(down.state.level, 2);
    assert.equal(down.state.step, 2);
  });
});

describe("Singapore questions", () => {
  it("keeps operators in the dedupe key", () => {
    assert.notEqual(questionKey("3 + 4"), questionKey("3 - 4"));
    assert.notEqual(questionKey("3 × 4"), questionKey("3 ÷ 4"));
    assert.equal(questionKey("8 + 3"), questionKey("8+3"));
    assert.equal(questionKey("3 × 4"), "3x4");
    assert.equal(questionKey("3 * 4"), "3x4");
    assert.equal(questionKey("3 / 4"), "3/4");
    assert.equal(questionKey("8 = 3"), "8=3");
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
    assert.equal(census.bands.length, 12);
    assert.deepEqual(
      census.bands.map((band) => band.name),
      BANDS.map((band) => band.label),
    );
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

  it("reads the website step name and strand name onto the same sg level", () => {
    const parsed = parseSchoolProfile({
      ok: true,
      id: "ada@school.test",
      profile: {
        access: "open",
        level: {
          sg: {
            grade: 11,
            step: "abstract",
            mastery: {
              strands: { "Number and algebra": { correct: 2, asked: 2 } },
              heuristics: { "Work backwards": { correct: 1, asked: 2 } },
            },
          },
        },
      },
    });
    assert.equal(parsed?.profile.level.sg?.grade, 11);
    assert.equal(parsed?.profile.level.sg?.step, 2);
    assert.deepEqual(parsed?.profile.level.sg?.mastery?.strands.number, { correct: 2, asked: 2 });
    assert.deepEqual(parsed?.profile.level.sg?.mastery?.heuristics["work-backwards"], { correct: 1, asked: 2 });
  });
});
