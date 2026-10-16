import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyAnswer } from "./climb-rules.ts";
import { questionKey } from "./next-sheet.ts";
import { moveVkoleRung } from "./vkole-cap.ts";
import { nextVariant, poolQuestion, type BagState } from "./question-pool.ts";
import { parseSchoolProfile, sgAccountLevel } from "./school-account.ts";
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
    assert.equal(parseSgCode(pictorial.standard)?.heuristic, "bar model");
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
      { detail: JSON.stringify({ code: "SG.3.number.bar model" }), correct: true },
      { detail: JSON.stringify({ code: "SG.3.geometry" }), correct: false },
      { detail: JSON.stringify({ code: "SG.3.algebra.look for a pattern" }), correct: true },
    ]);
    const report = formatMasteryReport(mastery);
    assert.match(report, /number: 1 of 1 correct/);
    assert.match(report, /measurement: 0 of 0 correct/);
    assert.match(report, /geometry: 0 of 1 correct/);
    assert.match(report, /data and statistics: 0 of 0 correct/);
    assert.match(report, /algebra: 1 of 1 correct/);
    assert.match(report, /calculus: 0 of 0 correct/);
    assert.match(report, /bar model: 1 of 1 correct/);
    assert.match(report, /look for a pattern: 1 of 1 correct/);
    assert.match(report, /work backwards: 0 of 0 correct/);
    assert.match(report, /guess and check: 0 of 0 correct/);
    assert.deepEqual(mastery.strands.number, { asked: 1, correct: 1 });
    assert.deepEqual(mastery.strands.geometry, { asked: 1, correct: 0 });
    assert.equal(mastery.strands.measurement, undefined);
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
              strands: {
                number: { asked: 4, correct: 3 },
                "Number and algebra": { asked: 9, correct: 9 },
              },
              heuristics: {
                "bar model": { asked: 1, correct: 1 },
                "bar-model": { asked: 8, correct: 8 },
              },
            },
          },
        },
      },
    });
    assert.equal(parsed?.profile.level.sg?.grade, 4);
    assert.equal(parsed?.profile.level.sg?.step, 2);
    assert.deepEqual(parsed?.profile.level.sg?.mastery?.strands.number, { asked: 4, correct: 3 });
    assert.equal(parsed?.profile.level.sg?.mastery?.strands.measurement, undefined);
    assert.deepEqual(parsed?.profile.level.sg?.mastery?.heuristics["bar model"], { asked: 1, correct: 1 });
    assert.equal(parsed?.profile.level.sg?.mastery?.heuristics["bar-model" as "bar model"], undefined);
  });

  it("keeps the website sg field names and drops an empty tally", () => {
    const source = {
      id: "sg-alex",
      name: "Alex",
      enteredBy: "parent",
      grade: 4,
      step: 1,
      earnedGrade: 4,
      standardId: "4-1",
      tier: "on",
      simple: false,
      streak: 0,
      missStreak: 1,
      reached: 2,
      missed: 0,
      updatedAt: 1710000000000,
      pending: {
        prompt: "3 + 4 = ?",
        code: "SG.4.number",
        label: "number",
        grade: 4,
        figure: { kind: "bar", whole: 7, parts: [{ label: "3", value: 3 }, { label: "?", value: null }] },
      },
      mastery: {
        strands: {
          number: { asked: 4, correct: 3 },
          measurement: { asked: 0, correct: 0 },
          geometry: { asked: 2, correct: 9 },
        },
        heuristics: { "work backwards": { asked: 1, correct: 0 } },
      },
    };
    const parsed = parseSchoolProfile({
      ok: true,
      id: "ada@school.test",
      profile: { access: "open", level: { sg: source } },
    });
    const sg = parsed?.profile.level.sg;
    assert.equal(sg?.id, "sg-alex");
    assert.equal(sg?.name, "Alex");
    assert.equal(sg?.enteredBy, "parent");
    assert.equal(sg?.earnedGrade, 4);
    assert.equal(sg?.standardId, "4-1");
    assert.equal(sg?.tier, "on");
    assert.equal(sg?.simple, false);
    assert.equal(sg?.streak, 0);
    assert.equal(sg?.missStreak, 1);
    assert.equal(sg?.reached, 2);
    assert.equal(sg?.missed, 0);
    assert.equal(sg?.updatedAt, 1710000000000);
    assert.equal(sg?.pending?.figure?.kind, "bar");
    assert.equal(sg?.mastery?.strands.measurement, undefined);
    assert.deepEqual(sg?.mastery?.strands.geometry, { asked: 2, correct: 2 });
    assert.deepEqual(sg?.mastery?.heuristics["work backwards"], { asked: 1, correct: 0 });
    const written = sgAccountLevel(sg, {
      name: "Alex",
      grade: 5,
      step: 0,
      earnedGrade: 4,
      streak: 0,
      missStreak: 0,
      reached: 2,
      missed: 0,
      mastery: sg?.mastery,
      updatedAt: 1710000001000,
    });
    assert.equal(written.id, "sg-alex");
    assert.equal(written.standardId, "4-1");
    assert.equal(written.grade, 5);
    assert.equal(written.step, 0);
    assert.equal(written.tier, "on");
    assert.equal(written.pending?.code, "SG.4.number");
    assert.deepEqual(written.mastery?.heuristics["work backwards"], { asked: 1, correct: 0 });
  });
});
