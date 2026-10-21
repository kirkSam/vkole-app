import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { alphabet, noteExerciseCompletion, rememberCompletedExercise } from "./items.ts";
import {
  TYPING_CAPITAL_LINE,
  TYPING_SMALL_LINE,
  TYPING_TRY_AGAIN,
  TYPING_WAIT_MS,
  advanceTyping,
  judgeTypingKey,
  typingCaseLine,
  typingShown,
  typingStart,
} from "./typing.ts";

describe("alphabet exercise 6 typing", () => {
  it("types every capital letter, then every small letter, and rejects the other case", () => {
    assert.equal(TYPING_TRY_AGAIN, "Try again");
    assert.equal(TYPING_WAIT_MS, 5000);
    const seen: string[] = [];
    let place = typingStart();
    assert.equal(typingShown(place), "A");
    for (let step = 0; step < alphabet().length * 2; step += 1) {
      const shown = typingShown(place);
      seen.push(shown);
      assert.equal(judgeTypingKey(shown, shown), "correct");
      const otherCase = shown === shown.toLowerCase() ? shown.toUpperCase() : shown.toLowerCase();
      assert.notEqual(otherCase, shown);
      assert.equal(judgeTypingKey(shown, otherCase), "case");
      assert.equal(typingCaseLine(shown), shown === shown.toUpperCase() ? TYPING_CAPITAL_LINE : TYPING_SMALL_LINE);
      const other = shown.toLowerCase() === "a" ? "b" : "a";
      assert.equal(judgeTypingKey(shown, other), "wrong");
      assert.equal(judgeTypingKey(shown, ""), "ignore");
      assert.equal(judgeTypingKey(shown, "   "), "ignore");
      const next = advanceTyping(place);
      if (next.done) {
        assert.equal(shown, "z");
        assert.equal(step, alphabet().length * 2 - 1);
        break;
      }
      assert.equal(next.done, false);
      place = next.place;
    }
    assert.equal(seen.length, 52);
    assert.deepEqual(seen.slice(0, 26), alphabet());
    assert.deepEqual(
      seen.slice(26),
      alphabet().map((letter) => letter.toLowerCase()),
    );
    const stayed = advanceTyping({ index: 0, letterCase: "upper" });
    assert.equal(typingShown(stayed.place), "B");
    assert.equal(stayed.done, false);
  });

  it("reminds the student about Shift when the letter is right and the case is wrong", () => {
    assert.equal(TYPING_CAPITAL_LINE, "Use a capital letter. Hold Shift or press Caps Lock.");
    assert.equal(TYPING_SMALL_LINE, "Use a small letter. Let go of Shift or turn off Caps Lock.");
    const capital = typingStart();
    assert.equal(typingShown(capital), "A");
    assert.equal(judgeTypingKey(typingShown(capital), "a"), "case");
    assert.equal(typingCaseLine(typingShown(capital)), TYPING_CAPITAL_LINE);
    assert.equal(judgeTypingKey(typingShown(capital), "A"), "correct");
    assert.equal(judgeTypingKey(typingShown(capital), "b"), "wrong");
    assert.equal(typingShown(capital), "A");
    const small = { index: 0, letterCase: "lower" as const };
    assert.equal(typingShown(small), "a");
    assert.equal(judgeTypingKey(typingShown(small), "A"), "case");
    assert.equal(typingCaseLine(typingShown(small)), TYPING_SMALL_LINE);
    assert.equal(judgeTypingKey(typingShown(small), "a"), "correct");
    assert.equal(judgeTypingKey(typingShown(small), "B"), "wrong");
    assert.equal(typingShown(small), "a");
    for (const letter of alphabet()) {
      assert.equal(judgeTypingKey(letter, letter.toLowerCase()), "case");
      assert.equal(typingCaseLine(letter), TYPING_CAPITAL_LINE);
      assert.equal(judgeTypingKey(letter.toLowerCase(), letter), "case");
      assert.equal(typingCaseLine(letter.toLowerCase()), TYPING_SMALL_LINE);
      const other = letter === "A" ? "B" : "A";
      assert.equal(judgeTypingKey(letter, other), "wrong");
      assert.equal(judgeTypingKey(letter.toLowerCase(), other.toLowerCase()), "wrong");
    }
  });

  it("saves exercise 6 the same way as the other finished exercises", () => {
    assert.deepEqual(rememberCompletedExercise(undefined, 6), [6]);
    assert.deepEqual(rememberCompletedExercise("2,3,4,5", 6), [2, 3, 4, 5, 6]);
    assert.deepEqual(rememberCompletedExercise([2, 6], 6), [2, 6]);
    assert.deepEqual(noteExerciseCompletion(78, 78, [2, 3, 4], true, true), [2, 3, 4, 5, 6]);
    assert.deepEqual(noteExerciseCompletion(0, 26, [], false, false), [2]);
  });
});
