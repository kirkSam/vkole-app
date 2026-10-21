import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { alphabet, noteExerciseCompletion, rememberCompletedExercise } from "./items.ts";
import { TYPING_TRY_AGAIN, TYPING_WAIT_MS, advanceTyping, judgeTypingKey, typingShown, typingStart } from "./typing.ts";

describe("alphabet exercise 6 typing", () => {
  it("types every capital letter, then every small letter, and accepts either case", () => {
    assert.equal(TYPING_TRY_AGAIN, "Try again");
    assert.equal(TYPING_WAIT_MS, 5000);
    const seen: string[] = [];
    let place = typingStart();
    assert.equal(typingShown(place), "A");
    for (let step = 0; step < alphabet().length * 2; step += 1) {
      const shown = typingShown(place);
      seen.push(shown);
      assert.equal(judgeTypingKey(shown, shown), "correct");
      assert.equal(judgeTypingKey(shown, shown.toLowerCase()), "correct");
      assert.equal(judgeTypingKey(shown, shown.toUpperCase()), "correct");
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

  it("saves exercise 6 the same way as the other finished exercises", () => {
    assert.deepEqual(rememberCompletedExercise(undefined, 6), [6]);
    assert.deepEqual(rememberCompletedExercise("2,3,4,5", 6), [2, 3, 4, 5, 6]);
    assert.deepEqual(rememberCompletedExercise([2, 6], 6), [2, 6]);
    assert.deepEqual(noteExerciseCompletion(78, 78, [2, 3, 4], true, true), [2, 3, 4, 5, 6]);
    assert.deepEqual(noteExerciseCompletion(0, 26, [], false, false), [2]);
  });
});
