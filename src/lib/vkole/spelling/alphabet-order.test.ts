import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  MEMORY_LETTER_PROMPT,
  alphabet,
  autoLetters,
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

  it("plays every capital, then every small letter, then both together, then the recitation", () => {
    const upper = autoLetters(2);
    const lower = autoLetters(3);
    const both = autoLetters(4);
    assert.equal(upper.length, alphabet().length);
    assert.equal(lower.length, alphabet().length);
    assert.equal(both.length, alphabet().length);
    assert.equal(upper[0]?.shown, "A");
    assert.equal(upper[0]?.say, "A");
    assert.equal(upper[25]?.shown, "Z");
    assert.equal(letterExercise(upper[0]?.index ?? -1), 2);
    assert.equal(letterExercise(upper[25]?.index ?? -1), 2);
    assert.equal(lower[0]?.shown, "a");
    assert.equal(lower[25]?.shown, "z");
    assert.equal(lower[0]?.say, "A");
    assert.equal(letterExercise(lower[12]?.index ?? -1), 3);
    assert.equal(both[0]?.pair, "A a");
    assert.equal(both[25]?.pair, "Z z");
    assert.equal(both[0]?.say, "A");
    assert.equal(letterView({ index: both[0]?.index ?? 0, silence: 0, wrong: 0 }).id, "lk-recall-a");
    assert.equal(letterExercise(both[25]?.index ?? -1), 4);
    assert.equal(nextAlphabetExercise(2), 3);
    assert.equal(nextAlphabetExercise(3), 4);
    assert.equal(nextAlphabetExercise(4), 5);
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
    assert.equal(stage.includes("autoLetters"), true);
    assert.equal(stage.includes("nextAlphabetExercise"), true);
    assert.equal(stage.includes('setPhase("play")'), true);
    const jumps = stage.split("<AlphabetJumps").length - 1;
    assert.equal(jumps, 4);
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
