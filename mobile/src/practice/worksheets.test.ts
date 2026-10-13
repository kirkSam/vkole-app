import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { moveVkoleRung } from "../../../src/lib/vkole-cap.ts";
import { applyAnswers, buildWorksheet, freshRung, practiceShareText, SHEET_LENGTH } from "./worksheets.ts";

describe("offline worksheets", () => {
  it("builds six on-device questions with the answer among the choices", () => {
    for (const subject of ["m", "ela", "ss", "gen"] as const) {
      for (let grade = 1; grade <= 12; grade += 1) {
        const sheet = buildWorksheet(subject, grade, grade + 3);
        assert.equal(sheet.length, SHEET_LENGTH);
        for (const item of sheet) {
          assert.equal(item.options.includes(item.answer), true);
          assert.equal(new Set(item.options).size, item.options.length);
          assert.equal(item.stem.includes("http"), false);
        }
      }
    }
  });

  it("repeats the same sheet for the same seed", () => {
    assert.deepEqual(buildWorksheet("m", 2, 3), buildWorksheet("m", 2, 3));
  });

  it("moves with the same rung rule as the learning engine", () => {
    const up = moveVkoleRung({ grade: 4, step: 2, correct: true, correctStreak: 1, missStreak: 0 });
    assert.equal(up.grade, 5);
    assert.equal(up.step, 0);
    const stayed = applyAnswers(freshRung(4), [true, false]);
    assert.equal(stayed.rung.grade, 4);
    assert.equal(stayed.rung.step, 0);
    const rose = applyAnswers(freshRung(4), [true, true]);
    assert.equal(rose.rung.step, 1);
    const top = moveVkoleRung({ grade: 12, step: 2, correct: true, correctStreak: 1, missStreak: 0 });
    assert.equal(top.capped, true);
    assert.equal(top.grade, 12);
  });

  it("shares a score without a child name", () => {
    const text = practiceShareText({ subjectName: "Mathematics", grade: 3, correct: 4, total: 6 });
    assert.match(text, /does not update the school office/);
    assert.equal(/name|email|@/i.test(text), false);
  });
});
