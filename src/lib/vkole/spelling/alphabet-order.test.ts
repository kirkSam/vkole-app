import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  MEMORY_LETTER_PROMPT,
  alphabet,
  exerciseStartIndex,
  jumpToExercise,
  letterExercise,
  letterView,
  nextAlphabetExercise,
  openingAlphabetExercise,
  progressAfterSong,
  runFromButton,
} from "./items.ts";

const stageFile = fileURLToPath(new URL("../../../components/spelling-stage.tsx", import.meta.url));
const sessionFile = fileURLToPath(new URL("../../../routes/session.$id.tsx", import.meta.url));
const cssFile = fileURLToPath(new URL("../../../styles.css", import.meta.url));

describe("alphabet opens at exercise 1 and plays through 5", () => {
  it("starts at exercise 1 on sign-in even when a later card was saved", () => {
    assert.equal(openingAlphabetExercise(null), 1);
    assert.equal(openingAlphabetExercise({ index: 0 }), 1);
    assert.equal(openingAlphabetExercise({ index: 12, word: "lk-next-m" }), 1);
    assert.equal(openingAlphabetExercise({ index: 26, word: "lk-lower-a" }), 1);
    assert.equal(openingAlphabetExercise({ index: 63, word: "m", prompt: MEMORY_LETTER_PROMPT }), 1);
    assert.equal(openingAlphabetExercise({ index: 52, word: "lk-recall-a" }), 1);
    assert.equal(openingAlphabetExercise({ index: 78, word: "lk-recite" }), 1);
    const songNext = letterView(progressAfterSong({ index: 63, silence: 4, wrong: 1, prompt: MEMORY_LETTER_PROMPT }));
    assert.equal(songNext.id, "lk-first");
    assert.equal(songNext.exercise, 2);
    assert.equal(songNext.silence, 0);
  });

  it("plays 1, then 2, then 3, then 4, then 5 with no gap", () => {
    assert.equal(nextAlphabetExercise(1), 2);
    assert.equal(nextAlphabetExercise(2), 3);
    assert.equal(nextAlphabetExercise(3), 4);
    assert.equal(nextAlphabetExercise(4), 5);
    assert.equal(nextAlphabetExercise(5), null);
    assert.deepEqual(runFromButton(1), [1, 2, 3, 4, 5]);
  });

  it("waits on every letter in exercises 2, 3, and 4, and keeps exercise 4 blank until the answer", () => {
    const letters = alphabet();
    assert.equal(letters.length, 26);
    for (let offset = 0; offset < letters.length; offset += 1) {
      const upper = letterView({ index: exerciseStartIndex(2) + offset, silence: 0, wrong: 0 });
      const lower = letterView({ index: exerciseStartIndex(3) + offset, silence: 0, wrong: 0 });
      const recall = letterView({ index: exerciseStartIndex(4) + offset, silence: 0, wrong: 0 });
      const name = letters[offset] ?? "";
      assert.equal(upper.exercise, 2);
      assert.match(upper.shown, /^[A-Z]$/);
      assert.equal(upper.answer, name);
      assert.equal(upper.pair, "");
      assert.equal(lower.exercise, 3);
      assert.match(lower.shown, /^[a-z]$/);
      assert.equal(lower.answer, name);
      assert.equal(lower.pair, "");
      assert.equal(recall.exercise, 4);
      assert.equal(recall.shown, "");
      assert.equal(recall.answer, name);
      assert.equal(recall.pair, `${name} ${name.toLowerCase()}`);
    }
    const firstUpper = letterView({ index: exerciseStartIndex(2), silence: 0, wrong: 0 });
    assert.equal(firstUpper.id, "lk-first");
    assert.equal(firstUpper.shown, "A");
    const firstLower = letterView({ index: exerciseStartIndex(3), silence: 0, wrong: 0 });
    assert.equal(firstLower.id, "lk-lower-a");
    assert.equal(firstLower.shown, "a");
    const firstRecall = letterView({ index: exerciseStartIndex(4), silence: 0, wrong: 0 });
    assert.equal(firstRecall.id, "lk-recall-a");
    assert.equal(firstRecall.shown, "");
    assert.equal(firstRecall.say, "What is the first letter of the alphabet?");
    assert.equal(firstRecall.pair, "A a");
    const recite = jumpToExercise(5);
    assert.equal(letterView(recite ?? { index: 0, silence: 0, wrong: 0 }).id, "lk-recite");
    assert.equal(letterExercise(exerciseStartIndex(5)), 5);
  });
});

describe("alphabet exercise buttons", () => {
  it("starts a new run at the pressed exercise and continues through exercise 5", () => {
    assert.deepEqual(runFromButton(1), [1, 2, 3, 4, 5]);
    assert.deepEqual(runFromButton(2), [2, 3, 4, 5]);
    assert.deepEqual(runFromButton(3), [3, 4, 5]);
    assert.deepEqual(runFromButton(4), [4, 5]);
    assert.deepEqual(runFromButton(5), [5]);
    assert.equal(letterView(jumpToExercise(2) ?? { index: 0, silence: 0, wrong: 0 }).id, "lk-first");
    assert.equal(letterView(jumpToExercise(3) ?? { index: 0, silence: 0, wrong: 0 }).id, "lk-lower-a");
    assert.equal(letterView(jumpToExercise(4) ?? { index: 0, silence: 0, wrong: 0 }).id, "lk-recall-a");
    assert.equal(jumpToExercise(1), null);
  });

  it("a second button replaces the run instead of continuing the old one", () => {
    const first = runFromButton(4);
    const again = runFromButton(2);
    assert.deepEqual(first, [4, 5]);
    assert.deepEqual(again, [2, 3, 4, 5]);
    assert.equal(again[0], 2);
    assert.equal(again.includes(1), false);
    const backToSong = runFromButton(1);
    assert.equal(backToSong[0], 1);
    assert.deepEqual(backToSong, [1, 2, 3, 4, 5]);
  });

  it("draws five small pastel buttons above the letter and the microphone", () => {
    const stage = readFileSync(stageFile, "utf8");
    const css = readFileSync(cssFile, "utf8");
    const session = readFileSync(sessionFile, "utf8");
    assert.equal(stage.includes("const EXERCISE_BUTTONS = [1, 2, 3, 4, 5]"), true);
    assert.equal(stage.includes('aria-label="Exercises"'), true);
    assert.equal(stage.includes('aria-label={`Exercise ${exercise}`}'), true);
    assert.equal(stage.includes('aria-current={exercise === current ? "true" : undefined}'), true);
    assert.equal(stage.includes('className="sp-jumps"'), true);
    assert.equal(stage.includes("is-current"), true);
    assert.equal(stage.includes("openingAlphabetExercise"), true);
    assert.equal(stage.includes('useState<Phase>("gate")'), true);
    assert.equal(stage.includes("autoLetters"), false);
    assert.equal(stage.includes('setPhase("play")'), false);
    assert.equal(stage.includes('"play"'), false);
    assert.equal(stage.includes("takeAnswer"), true);
    assert.equal(stage.includes("applyLetterAnswer"), true);
    assert.equal(stage.includes("SPELLING_LISTEN_GAP_MS"), true);
    assert.equal(stage.includes('setPhase("listen")'), true);
    const begin = stage.slice(stage.indexOf("function beginExercise"), stage.indexOf("function takeAnswer"));
    assert.equal(begin.includes("clearTimeout(advanceRef.current)"), true);
    assert.equal(begin.includes('setPhase("song")'), true);
    assert.equal(begin.includes('setPhase("prompt")'), true);
    assert.equal(begin.includes("exerciseStartIndex(next)"), true);
    const take = stage.slice(stage.indexOf("function takeAnswer"), stage.indexOf("function noteHeard"));
    assert.equal(take.includes('setPhase("happy")'), true);
    assert.equal(take.includes("SPELLING_HAPPY_FACE_MS"), true);
    assert.equal(take.includes("applyLetterAnswer"), true);
    assert.equal(take.includes("onDone"), false);
    const score = stage.slice(
      stage.indexOf("if (viewRef.current.exercise === 5) return;"),
      stage.indexOf("if (!canScore || viewRef.current.exercise !== 5) return;"),
    );
    assert.equal(score.includes('takeAnswer("correct")'), true);
    assert.equal(score.includes("onDone"), false);
    const happy = stage.slice(stage.indexOf('phase === "happy"'), stage.indexOf('view.kind === "cue"'));
    assert.equal(happy.includes("view.pair"), true);
    const ask = stage.slice(stage.indexOf('view.kind === "cue"'), stage.indexOf('phase === "listen" && !needsMic && view.exercise'));
    assert.equal(ask.includes("view.shown"), true);
    assert.equal(ask.includes("view.pair"), false);
    const jumps = stage.split("<AlphabetJumps").length - 1;
    assert.equal(jumps, 3);
    const jumpCss = css.slice(css.indexOf(".sp-jumps {"), css.indexOf(".sp-letter {"));
    assert.equal(jumpCss.includes("position: static"), true);
    assert.equal(jumpCss.includes("position: absolute"), false);
    assert.equal(jumpCss.includes("position: fixed"), false);
    assert.equal(jumpCss.includes("#d4f0ee"), true);
    assert.equal(jumpCss.includes("#f8e3b0"), true);
    assert.equal(jumpCss.includes("#f8dce8"), true);
    assert.equal(jumpCss.includes("#e4dcf6"), true);
    assert.equal(jumpCss.includes("#d9f3d4"), true);
    assert.equal(jumpCss.includes(".is-current"), true);
    assert.equal(session.includes("placeSpellingAfterSong"), false);
    assert.equal(session.includes("placeSpellingExercise"), true);
    assert.equal(session.includes("exercise: 5"), true);
    assert.equal(session.includes('key={`${climb.id}:${spellingRound}`}'), true);
    assert.equal(session.includes("standardStep}:${climb.correctAtLevel"), false);
  });
});
