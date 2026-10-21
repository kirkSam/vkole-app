import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { academicLetter, parentLogoutLetter, trialState } from "../../academic-email.ts";
import { engineNavLabel, enginePickLabel } from "../../climb-rules.ts";
import { parseSchoolProfile, schoolWriteBody } from "../../school-account.ts";
import { spAccountLevel } from "./level.ts";
import {
  SPELLING_BANDS,
  SPELLING_ENGINE,
  SPELLING_HAPPY_FACE_MS,
  SPELLING_LETTER_MS,
  SPELLING_LISTEN_GAP_MS,
  SPELLING_MAX_CHANGES_PER_SECOND,
  SPELLING_RECOGNIZER_RESTART_MS,
  SPELLING_RESPONSE_MS,
  SPELLING_SONG_MS,
  SPELLING_START_MS,
  alphabet,
  applyLetterAnswer,
  bandMeta,
  cardFromAccount,
  filledBands,
  itemAt,
  letterAtSongTime,
  letterColors,
  earlyHandoffMiss,
  letterExercise,
  letterOnScreen,
  letterView,
  MEMORY_LETTER_PROMPT,
  migrateAlphabetIndex,
  micOpensAfterPrompt,
  progressAfterSong,
  promptPlayedLongEnough,
  SPELLING_PROMPT_MIN_MS,
  songSpokenLines,
  micListensDuring,
  openingPrompt,
  reviewChangesPerSecond,
  spellingPromptStartsListen,
  spellingStartSecondsLeft,
  startCard,
} from "./items.ts";
import {
  describeSpellingHear,
  judgeSpellingAlternatives,
  judgeSpellingSpoken,
  recognitionErrorRelistens,
  spellingGrammar,
  spellingSpokenMatches,
} from "./match.ts";
import { celebrationFrame, GOOD_JOB_LINE, reciteHear, RECITE_PROMPT, SPELLING_CELEBRATION_MS } from "./recite.ts";
import lists from "./data.json" with { type: "json" };

const stageFile = fileURLToPath(new URL("../../../components/spelling-stage.tsx", import.meta.url));

describe("spelling timing", () => {
  it("keeps the alphabet at 1.5 seconds per letter, a 39 second song, a 2 second Happy Face, and a 5 second timer", () => {
    assert.equal(SPELLING_ENGINE, "sp");
    assert.equal(SPELLING_LETTER_MS, 1500);
    assert.equal(SPELLING_SONG_MS, 39000);
    assert.equal(SPELLING_SONG_MS, alphabet().length * SPELLING_LETTER_MS);
    assert.equal(SPELLING_HAPPY_FACE_MS, 2000);
    assert.equal(SPELLING_RESPONSE_MS, 5000);
    assert.equal(lists.answerFlow.happyFaceMs, 2000);
    assert.equal(lists.answerFlow.responseMs, 5000);
    assert.equal(lists.happyFaceMs, SPELLING_HAPPY_FACE_MS);
    assert.equal(lists.responseMs, SPELLING_RESPONSE_MS);
    assert.equal(lists.letterMs, 1500);
    assert.equal(lists.songMs, 39000);
    assert.equal(lists.happyFaceMs, 2000);
    assert.equal(lists.responseMs, 5000);
    assert.equal(lists.review.msPerLetter, 1500);
    assert.equal(lists.review.durationMs, 39000);
    assert.equal(letterAtSongTime(0).letter, "A");
    assert.equal(letterAtSongTime(0).done, false);
    assert.equal(letterAtSongTime(1499).letter, "A");
    assert.equal(letterAtSongTime(1500).letter, "B");
    assert.equal(letterAtSongTime(1500).index, 1);
    assert.equal(letterAtSongTime(37500).letter, "Z");
    assert.equal(letterAtSongTime(38999).done, false);
    assert.equal(letterAtSongTime(39000).done, true);
    assert.equal(reviewChangesPerSecond(), 1000 / 1500);
    assert.ok(reviewChangesPerSecond() < 3);
    assert.ok(reviewChangesPerSecond() <= SPELLING_MAX_CHANGES_PER_SECOND);
    assert.equal(micListensDuring("song"), false);
    assert.equal(micListensDuring("prompt"), false);
    assert.equal(micListensDuring("happy"), false);
    assert.equal(micListensDuring("model"), false);
    assert.equal(micListensDuring("listen"), true);
  });

  it("changes the letter color and background once per letter, and does not flash", () => {
    const colors = letterColors();
    assert.equal(colors.length, 26);
    assert.equal(new Set(colors.map((color) => color.letter)).size, 26);
    assert.equal(new Set(colors.map((color) => color.background)).size, 26);
    const stage = readFileSync(stageFile, "utf8");
    assert.equal(stage.includes("MediaRecorder"), false);
    assert.equal(stage.includes("getUserMedia"), false);
    assert.equal(stage.includes("SPELLING_LETTER_MS"), true);
    assert.equal(stage.includes("SPELLING_HAPPY_FACE_MS"), true);
    assert.equal(stage.includes("SPELLING_RESPONSE_MS"), true);
    assert.equal(stage.includes("SPELLING_ADVANCE_MS"), false);
    assert.equal(stage.includes(".model"), false);
    assert.match(
      stage,
      /function takeAnswer\(outcome: Outcome\) \{\s*if \(outcome === "correct"\) \{[\s\S]*?SPELLING_HAPPY_FACE_MS[\s\S]*?return;\s*\}\s*const after = applyLetterAnswer\(placeRef\.current, outcome\);/,
    );
    assert.equal(stage.includes('onDoneRef.current("correct")'), true);
    assert.equal(stage.includes("onDoneRef.current(outcome)"), false);
    assert.equal(stage.includes("micListensDuring"), true);
    assert.equal(stage.includes('aria-label="Happy Face"'), true);
    assert.equal(stage.includes("VKOLE/Alphabet ZPD"), true);
    assert.equal(stage.includes('aria-label="Start alphabet"'), true);
    assert.equal(stage.includes("VKOLE/Spelling"), false);
    assert.equal(stage.includes("Start spelling"), false);
  });
});

describe("letter knowledge sequence", () => {
  it("starts with the spoken first-letter prompt, then capital letters, small letters, recall, and reciting", () => {
    assert.equal(engineNavLabel("sp"), "VKOLE/Alphabet ZPD");
    assert.equal(engineNavLabel("sp"), lists.navLabel);
    assert.equal(enginePickLabel("sp"), "Alphabet ZPD");
    assert.equal(lists.name, "VKOLE/Alphabet ZPD");
    assert.equal(lists.pickLabel, "Alphabet ZPD");
    assert.deepEqual(SPELLING_BANDS, ["LK", "LS", "CVC", "DOLCH", "FRY"]);
    assert.deepEqual(filledBands(), ["LK"]);
    assert.deepEqual(
      lists.bands.map((band) => band.id),
      ["LK", "LS", "CVC", "DOLCH", "FRY"],
    );
    assert.equal(bandMeta("LS").count, 0);
    assert.equal(bandMeta("CVC").count, 0);
    assert.equal(bandMeta("DOLCH").count, 0);
    assert.equal(bandMeta("FRY").count, 0);
    assert.equal(bandMeta("LK").name, "Letter knowledge");
    assert.equal(bandMeta("LK").count, 79);
    const first = itemAt("LK", 0);
    assert.equal(first.id, "lk-first");
    assert.equal(first.kind, "first-letter");
    assert.equal(first.say, "Your turn! What is the first letter of the alphabet?");
    assert.equal(first.show, first.say);
    assert.equal(first.answer, "A");
    assert.equal(openingPrompt(), first.say);
    assert.equal(lists.review.then, first.say);
    const nextB = itemAt("LK", 1);
    assert.equal(nextB.kind, "next-letter");
    assert.equal(nextB.letter, "A");
    assert.equal(nextB.answer, "B");
    assert.equal(nextB.say, "What letter comes next?");
    const lowerA = lists.bands[0]?.items.find((item) => item.id === "lk-lower-a");
    assert.equal(lowerA?.kind, "lower-letter");
    assert.equal(lowerA?.letter, "a");
    assert.equal(lowerA?.answer, "A");
    const recallA = lists.bands[0]?.items.find((item) => item.id === "lk-recall-a");
    assert.equal(recallA?.kind, "recall");
    assert.equal(recallA?.say, "What is the first letter of the alphabet?");
    assert.equal(recallA?.letter, "");
    assert.equal(recallA?.answer, "A");
    const recite = lists.bands[0]?.items.find((item) => item.id === "lk-recite");
    assert.equal(recite?.kind, "recite");
    assert.equal(recite?.say, RECITE_PROMPT);
    assert.equal(recite?.answer, "Z");
    assert.equal(startCard(1).id, "lk-first");
    assert.equal(lists.micRecords, false);
    assert.equal(lists.answerFlow.correct.action, "next");
    assert.equal(lists.answerFlow.silence[0]?.action, "repeat");
    assert.equal(lists.answerFlow.silence[1]?.action, "repeat");
    assert.equal(lists.answerFlow.silence.some((row) => row.action === "back"), false);
    assert.equal(lists.answerFlow.wrong[0]?.action, "cue");
    assert.equal(lists.answerFlow.wrong[0]?.letters, 3);
    assert.equal(lists.answerFlow.wrong[1]?.action, "back");
    assert.equal(lists.answerFlow.wrong[1]?.letters, 1);
    assert.equal(lists.answerFlow.wrong.some((row) => row.action === "restart"), false);
    assert.equal(lists.answerFlow.clamp, "A");
  });

  it("keeps a saved letter and skips an empty later band", () => {
    const saved = cardFromAccount({ grade: 4, band: "LK", index: 12 }, 1);
    assert.equal(saved.band, "LK");
    assert.equal(saved.index, 12);
    assert.equal(saved.grade, 4);
    const emptyLater = cardFromAccount({ grade: 2, band: "CVC", index: 0 }, 2);
    assert.equal(emptyLater.band, "LK");
    assert.equal(emptyLater.id, "lk-first");
  });
});

describe("letter answer flow", () => {
  const g = { index: alphabet().indexOf("G"), silence: 0, wrong: 0 };

  it("moves to the next letter as soon as a correct answer is recorded", () => {
    const next = applyLetterAnswer(g, "correct");
    assert.deepEqual(next, { index: g.index + 1, silence: 0, wrong: 0 });
    const view = letterView(next);
    assert.equal(view.kind, "ask");
    assert.equal(view.answer, "H");
    assert.equal(view.shown, "G");
    const fromCue = applyLetterAnswer({ ...g, wrong: 1 }, "correct");
    assert.deepEqual(fromCue, { index: g.index + 1, silence: 0, wrong: 0 });
    const wrapped = applyLetterAnswer({ index: 25, silence: 0, wrong: 0 }, "correct");
    assert.equal(wrapped.index, 26);
    assert.equal(letterView(wrapped).id, "lk-lower-a");
    assert.equal(letterView(wrapped).answer, "A");
    assert.equal(letterView(wrapped).shown, "a");
    assert.equal(letterView(wrapped).exercise, 3);
  });

  it("enters recall at A with nothing on screen, then shows both letters after a correct answer", () => {
    let index = 0;
    while (itemAt("LK", index).kind !== "recall" && index < bandMeta("LK").count) index += 1;
    const at = applyLetterAnswer({ index: index - 1, silence: 0, wrong: 0 }, "correct");
    const view = letterView(at);
    assert.equal(itemAt("LK", index - 1).id, "lk-lower-z");
    assert.equal(view.id, "lk-recall-a");
    assert.equal(view.exercise, 4);
    assert.equal(view.kind, "ask");
    assert.equal(view.answer, "A");
    assert.equal(view.letter, "A");
    assert.equal(view.shown, "");
    assert.equal(view.pair, "A a");
    assert.equal(view.say, "What is the first letter of the alphabet?");
    assert.notEqual(view.say, MEMORY_LETTER_PROMPT);
    assert.equal(spellingSpokenMatches(view.answer, "A", view.also), true);
    assert.equal(spellingSpokenMatches(view.answer, "a", view.also), true);
    assert.equal(spellingSpokenMatches(view.answer, "ay", view.also), true);
    assert.equal(spellingSpokenMatches(view.answer, "eh", view.also), true);
    assert.equal(spellingSpokenMatches(view.answer, "hey", view.also), true);
    assert.equal(spellingSpokenMatches(view.answer, "a.", view.also), true);
    assert.equal(spellingPromptStartsListen(""), "now");
    assert.equal(spellingPromptStartsListen("   "), "now");
    assert.equal(spellingPromptStartsListen(view.say), "after-speech");
    assert.equal(micListensDuring("listen"), true);
    const stayed = applyLetterAnswer(applyLetterAnswer(at, "timeout"), "timeout");
    assert.equal(letterView(stayed).id, "lk-recall-a");
    assert.equal(letterView(stayed).shown, "");
    const next = letterView(applyLetterAnswer(at, "correct"));
    assert.equal(next.id, "lk-recall-b");
    assert.equal(next.answer, "B");
    assert.equal(next.shown, "");
    assert.equal(next.pair, "B b");
    assert.equal(next.say, "What letter comes next?");
    const lastRecall = bandMeta("LK").count - 2;
    assert.equal(letterView({ index: lastRecall, silence: 0, wrong: 0 }).id, "lk-recall-z");
    const recited = applyLetterAnswer({ index: lastRecall, silence: 0, wrong: 0 }, "correct");
    assert.equal(letterView(recited).id, "lk-recite");
    assert.equal(letterView(recited).exercise, 5);
    assert.equal(applyLetterAnswer(recited, "correct").index, recited.index);
    const stage = readFileSync(stageFile, "utf8");
    const promptEffect = stage.slice(stage.indexOf('phase !== "prompt"'), stage.indexOf("if (!canScore)"));
    assert.equal(promptEffect.includes("spellingPromptStartsListen"), true);
    assert.equal(promptEffect.includes('setPhase("listen")'), true);
    assert.equal(promptEffect.includes("view.shown"), false);
  });

  it("walks exercise 2 into 3, 4, and 5, and the song never opens a blank memory prompt", () => {
    const count = bandMeta("LK").count;
    const lastOf = (exercise: 2 | 3 | 4 | 5) => {
      let index = 0;
      for (let i = 0; i < count; i += 1) if (letterExercise(i) === exercise) index = i;
      return index;
    };
    const end2 = lastOf(2);
    const into3 = letterView(applyLetterAnswer({ index: end2, silence: 0, wrong: 0 }, "correct"));
    assert.equal(letterExercise(end2), 2);
    assert.equal(itemAt("LK", end2).id, "lk-next-z");
    assert.equal(into3.id, "lk-lower-a");
    assert.equal(letterExercise(into3.index), 3);
    assert.equal(into3.shown, "a");
    assert.equal(into3.answer, "A");
    assert.notEqual(into3.say, MEMORY_LETTER_PROMPT);

    const end3 = lastOf(3);
    const into4 = letterView(applyLetterAnswer({ index: end3, silence: 0, wrong: 0 }, "correct"));
    assert.equal(itemAt("LK", end3).id, "lk-lower-z");
    assert.equal(letterExercise(into4.index), 4);
    assert.equal(into4.id, "lk-recall-a");
    assert.equal(into4.shown, "");
    assert.equal(into4.pair, "A a");
    assert.equal(into4.say, "What is the first letter of the alphabet?");
    assert.notEqual(into4.say, MEMORY_LETTER_PROMPT);

    const end4 = lastOf(4);
    const into5 = letterView(applyLetterAnswer({ index: end4, silence: 0, wrong: 0 }, "correct"));
    assert.equal(itemAt("LK", end4).id, "lk-recall-z");
    assert.equal(into5.id, "lk-recite");
    assert.equal(letterExercise(into5.index), 5);
    assert.equal(into5.shown, "");
    assert.equal(into5.say, RECITE_PROMPT);
    assert.equal(applyLetterAnswer({ index: into5.index, silence: 0, wrong: 0 }, "correct").index, into5.index);

    const afterSong = letterView({ index: 0, silence: 0, wrong: 0 });
    assert.equal(afterSong.shown, "A");
    assert.equal(afterSong.say, openingPrompt());
    assert.equal(afterSong.exercise, 2);
    assert.notEqual(afterSong.say, MEMORY_LETTER_PROMPT);
    assert.equal(letterOnScreen("first-letter", "", "A"), "A");
    assert.equal(letterOnScreen("lower-next", "a", "B"), "a");
    assert.equal(letterOnScreen("lower-next", "", "B"), "b");
    assert.equal(letterOnScreen("recall", "A", "A"), "");
    assert.equal(letterOnScreen("recite", "", "Z"), "");

    const sung = songSpokenLines();
    assert.deepEqual(sung, alphabet());
    const songNext = letterView(progressAfterSong({ index: into4.index, silence: 2, wrong: 1, word: into4.id }));
    assert.equal(songNext.id, "lk-first");
    assert.equal(songNext.exercise, 2);
    assert.equal(songNext.shown, "A");
    assert.notEqual(songNext.say, MEMORY_LETTER_PROMPT);
    const afterRecite = letterView(progressAfterSong({ index: into5.index, silence: 1, wrong: 1, word: into5.id }));
    assert.equal(afterRecite.id, "lk-first");
    assert.equal(progressAfterSong({ index: into5.index, silence: 1, wrong: 1, word: into5.id }).silence, 0);
    const afterShowing = letterView(progressAfterSong({ index: end2, silence: 1, wrong: 0, word: itemAt("LK", end2).id }));
    assert.equal(afterShowing.id, "lk-first");
    assert.equal(letterExercise(afterShowing.index), 2);
    const afterLower = letterView(progressAfterSong({ index: end3, silence: 0, wrong: 0, word: "lk-lower-z" }));
    assert.equal(afterLower.id, "lk-first");
    assert.notEqual(afterLower.say, MEMORY_LETTER_PROMPT);
    const stage = readFileSync(stageFile, "utf8");
    assert.equal(stage.includes("openingAlphabetExercise"), true);
    assert.equal(stage.includes("autoLetters"), false);
    assert.equal(stage.includes('setPhase("play")'), false);
    assert.equal(stage.includes("takeAnswer"), true);
    assert.equal(stage.includes("SPELLING_LISTEN_GAP_MS"), true);
    assert.equal(stage.includes("EXERCISE_BUTTONS = [1, 2, 3, 4, 5]"), true);
    assert.equal(stage.includes("Exercise 1"), true);
    assert.equal(stage.includes("Exercise {view.exercise}"), true);

    for (let index = 0; index < count; index += 1) {
      const view = letterView({ index, silence: 0, wrong: 0 });
      assert.notEqual(view.say, MEMORY_LETTER_PROMPT);
      if (view.exercise === 2) assert.match(view.shown, /^[A-Z]$/);
      if (view.exercise === 3) assert.match(view.shown, /^[a-z]$/);
      if (view.exercise === 4 || view.exercise === 5) assert.equal(view.shown, "");
    }
  });

  it("shows the same letter again after one silence", () => {
    const once = applyLetterAnswer(g, "timeout");
    assert.deepEqual(once, { index: g.index, silence: 1, wrong: 0 });
    const view = letterView(once);
    assert.equal(view.kind, "ask");
    assert.equal(view.answer, "G");
    assert.equal(view.shown, "F");
    assert.equal(view.say, "What letter comes next?");
  });

  it("asks the same letter again after silence, and never returns to A", () => {
    const once = applyLetterAnswer(g, "timeout");
    const again = applyLetterAnswer(once, "timeout");
    assert.equal(again.index, g.index);
    assert.equal(again.silence, 2);
    assert.equal(again.wrong, 0);
    const view = letterView(again);
    assert.equal(view.kind, "ask");
    assert.equal(view.answer, "G");
    assert.equal(view.shown, "F");
    const fromB = applyLetterAnswer({ index: alphabet().indexOf("B"), silence: 1, wrong: 0 }, "timeout");
    assert.equal(fromB.index, alphabet().indexOf("B"));
    assert.notEqual(letterView(fromB).answer, "A");
    const fromC = applyLetterAnswer({ index: alphabet().indexOf("C"), silence: 1, wrong: 0 }, "timeout");
    assert.equal(fromC.index, alphabet().indexOf("C"));
    assert.notEqual(fromC.index, 0);
  });

  it("shows and speaks the 3 prior letters after a wrong answer", () => {
    const cue = applyLetterAnswer(g, "miss");
    assert.deepEqual(cue, { index: g.index, silence: 0, wrong: 1 });
    const view = letterView(cue);
    assert.equal(view.kind, "cue");
    assert.deepEqual(view.cue, ["D", "E", "F"]);
    assert.equal(view.show, "D E F");
    assert.equal(view.say, "D, E, F");
    assert.equal(view.answer, "G");
    const nearStart = letterView(applyLetterAnswer({ index: alphabet().indexOf("C"), silence: 0, wrong: 0 }, "miss"));
    assert.deepEqual(nearStart.cue, ["A", "B"]);
    assert.equal(nearStart.answer, "C");
    const atA = letterView(applyLetterAnswer({ index: 0, silence: 0, wrong: 0 }, "miss"));
    assert.equal(atA.kind, "ask");
    assert.deepEqual(atA.cue, []);
    assert.equal(atA.shown, "A");
    assert.equal(atA.answer, "A");
  });

  it("steps back one letter after a second miss, and a miss never returns to A", () => {
    const cue = applyLetterAnswer(g, "miss");
    const back = applyLetterAnswer(cue, "miss");
    assert.deepEqual(back, { index: g.index - 1, silence: 0, wrong: 0 });
    const view = letterView(back);
    assert.equal(view.kind, "ask");
    assert.equal(view.answer, "F");
    const fromM = { index: alphabet().indexOf("M"), silence: 0, wrong: 0 };
    const stayed = applyLetterAnswer(fromM, "miss");
    assert.equal(stayed.index, fromM.index);
    assert.equal(stayed.wrong, 1);
    assert.notEqual(letterView(stayed).answer, "A");
    const stepped = applyLetterAnswer(stayed, "miss");
    assert.equal(stepped.index, fromM.index - 1);
    assert.equal(stepped.wrong, 0);
    assert.notEqual(stepped.index, 0);
    let chain = fromM;
    for (let n = 0; n < 6; n += 1) chain = applyLetterAnswer(chain, "miss");
    assert.equal(chain.index, fromM.index - 3);
    assert.ok(chain.index > 0);
    const atA = applyLetterAnswer({ index: 0, silence: 0, wrong: 1 }, "miss");
    assert.equal(atA.index, 0);
    const timed = applyLetterAnswer(cue, "timeout");
    assert.deepEqual(timed, { index: g.index, silence: 1, wrong: 0 });
    assert.equal(letterView(timed).kind, "ask");
    assert.equal(letterView(timed).answer, "G");
    const timedAgain = applyLetterAnswer(timed, "timeout");
    assert.equal(timedAgain.index, g.index);
    assert.equal(timedAgain.silence, 2);
    assert.notEqual(timedAgain.index, 0);
  });
});

describe("spoken spelling answers", () => {
  it("accepts the letter, its spoken name, and a short phrase, and waits on a live miss", () => {
    const first = itemAt("LK", 0);
    assert.equal(spellingSpokenMatches(first.answer, "A", first.also), true);
    assert.equal(spellingSpokenMatches(first.answer, "ay", first.also), true);
    assert.equal(spellingSpokenMatches(first.answer, "The letter A", first.also), true);
    assert.equal(spellingSpokenMatches(first.answer, "bee", first.also), false);
    const nextB = itemAt("LK", 1);
    assert.equal(spellingSpokenMatches(nextB.answer, "bee", nextB.also), true);
    assert.equal(spellingSpokenMatches(nextB.answer, "be", nextB.also), true);
    const nameW = lists.bands[0]?.items.find((item) => item.id === "lk-next-w");
    assert.ok(nameW);
    assert.equal(spellingSpokenMatches(nameW.answer, "double you", nameW.also), true);
    assert.equal(spellingSpokenMatches(nameW.answer, "double u", nameW.also), true);
    assert.equal(spellingSpokenMatches(nameW.answer, "u", nameW.also), false);
    const nameY = lists.bands[0]?.items.find((item) => item.id === "lk-next-y");
    assert.ok(nameY);
    assert.equal(spellingSpokenMatches(nameY.answer, "why", nameY.also), true);
    const nameZ = lists.bands[0]?.items.find((item) => item.id === "lk-next-z");
    assert.ok(nameZ);
    assert.equal(spellingSpokenMatches(nameZ.answer, "zed", nameZ.also), true);
    assert.equal(judgeSpellingSpoken(first.answer, "", true, first.also), "wait");
    assert.equal(judgeSpellingSpoken(first.answer, ".", true, first.also), "wait");
    assert.equal(judgeSpellingSpoken(first.answer, "be", false, first.also), "wait");
    assert.equal(judgeSpellingSpoken(first.answer, "ay", false, first.also), "correct");
    assert.equal(judgeSpellingSpoken(first.answer, "bee", true, first.also), "miss");
  });

  it("accepts the common spoken name of every letter, including M as em", () => {
    const heard: Record<string, string[]> = {
      A: ["a", "ay"],
      B: ["bee", "be"],
      C: ["see", "sea"],
      D: ["dee", "de", "d", "the"],
      E: ["e", "ee"],
      F: ["ef", "eff"],
      G: ["gee", "jee"],
      H: ["aitch", "haitch"],
      I: ["eye"],
      J: ["jay"],
      K: ["kay"],
      L: ["el", "ell"],
      M: ["m", "em", "um", "emm"],
      N: ["en"],
      O: ["oh"],
      P: ["pee", "pea"],
      Q: ["queue", "cue"],
      R: ["are"],
      S: ["ess"],
      T: ["tea", "tee"],
      U: ["you", "u"],
      V: ["vee"],
      W: ["double you", "double u"],
      X: ["ex"],
      Y: ["why"],
      Z: ["zee", "zed"],
    };
    assert.equal(Object.keys(heard).length, 26);
    for (const [letter, forms] of Object.entries(heard)) {
      for (const form of forms) {
        assert.equal(spellingSpokenMatches(letter, form, []), true, `${form} should match ${letter}`);
        assert.equal(judgeSpellingSpoken(letter, form, true, []), "correct");
      }
    }
    assert.equal(spellingSpokenMatches("M", "em", []), true);
    assert.equal(spellingSpokenMatches("W", "u", []), false);
    assert.equal(
      judgeSpellingAlternatives("M", [
        { transcript: "and", final: true },
        { transcript: "em", final: true },
      ]),
      "correct",
    );
    assert.equal(judgeSpellingAlternatives("M", [{ transcript: "and", final: true }]), "miss");
    assert.equal(judgeSpellingAlternatives("M", [{ transcript: "", final: true }, { transcript: ".", final: true }]), "wait");
    assert.equal(judgeSpellingSpoken("M", "em", false, []), "correct");
    assert.equal(recognitionErrorRelistens("no-speech"), true);
    assert.equal(recognitionErrorRelistens("network"), true);
    assert.equal(recognitionErrorRelistens("audio-capture"), true);
    assert.equal(recognitionErrorRelistens("not-allowed"), false);
    assert.equal(recognitionErrorRelistens("service-not-allowed"), false);
  });

  it("accepts M, N, and Q from every alternative, including a one-letter transcript", () => {
    const accepted: Record<string, string[]> = {
      M: ["M", "m", "m.", "em", "emm", "um", "im", "am", "them", "him"],
      N: ["N", "n", "n.", "en", "enn", "in", "and", "an", "end"],
      Q: ["Q", "q", "q.", "cue", "queue", "kyu", "kew", "cute", "que"],
    };
    for (const [letter, forms] of Object.entries(accepted)) {
      for (const form of forms) {
        assert.equal(spellingSpokenMatches(letter, form, []), true, `${form} should match ${letter}`);
        const heard = describeSpellingHear(letter, [{ transcript: form, final: true, confidence: 0 }]);
        assert.equal(heard.judgment, "correct", form);
        assert.equal(heard.status, `I heard: ${form}`);
      }
    }
    assert.equal(spellingSpokenMatches("Q", "you", []), false);
    assert.equal(spellingSpokenMatches("M", "en", []), false);
    assert.equal(spellingSpokenMatches("N", "em", []), false);
    assert.equal(spellingSpokenMatches("U", "you", []), true);
    const lower = describeSpellingHear("N", [
      { transcript: "the", final: true },
      { transcript: "enn", final: true, confidence: 0.1 },
    ]);
    assert.equal(lower.judgment, "correct");
    assert.equal(lower.status, "I heard: enn");
    assert.equal(describeSpellingHear("M", [{ transcript: "and", final: true }]).judgment, "miss");
    assert.equal(describeSpellingHear("M", [{ transcript: "and", final: true }]).status, "I heard: and");
    assert.equal(describeSpellingHear("Q", [{ transcript: "", final: true }, { transcript: ".", final: true }]).status, "I didn't hear anything");
    assert.equal(describeSpellingHear("Q", [{ transcript: "", final: true }, { transcript: ".", final: true }]).judgment, "wait");
    const letterM = itemAt("LK", 12);
    assert.equal(letterM.id, "lk-next-m");
    assert.equal(letterM.also.includes("him"), true);
    assert.equal(letterM.also.includes("them"), true);
    assert.equal(spellingGrammar("Q").includes("kyu"), true);
    assert.equal(spellingGrammar("Q").includes("you"), false);
    assert.equal(spellingGrammar("M").includes("em"), true);
    assert.equal(spellingGrammar("N").includes("and"), true);
    const stage = readFileSync(stageFile, "utf8");
    assert.equal(stage.includes("maxAlternatives = 8"), true);
    assert.equal(stage.includes("interimResults = true"), true);
    assert.equal(stage.includes("applyLetterGrammar"), true);
    assert.equal(stage.includes("I didn't hear anything"), true);
    assert.equal(stage.includes("I heard:"), true);
  });
});

describe("spelling start", () => {
  it("shows START and counts down 30 seconds before the alphabet begins", () => {
    assert.equal(SPELLING_START_MS, 30000);
    assert.equal(spellingStartSecondsLeft(0), 30);
    assert.equal(spellingStartSecondsLeft(1000), 29);
    assert.equal(spellingStartSecondsLeft(29001), 1);
    assert.equal(spellingStartSecondsLeft(30000), 0);
    assert.equal(spellingStartSecondsLeft(-5), 30);
    const stage = readFileSync(stageFile, "utf8");
    assert.match(stage, />\s*START\s*</);
    assert.equal(stage.includes("Starts in"), true);
    assert.equal(stage.includes("spellingStartSecondsLeft"), true);
    assert.equal(stage.includes("SPELLING_RECOGNIZER_RESTART_MS"), true);
    assert.equal(SPELLING_RECOGNIZER_RESTART_MS > 0, true);
    assert.equal(stage.includes("recognitionErrorRelistens"), true);
    assert.equal(stage.includes("describeSpellingHear"), true);
    assert.match(stage, /scheduleRestart/);
    const noSpeech = stage.slice(stage.indexOf("rec.onerror"), stage.indexOf("rec.onend"));
    assert.equal(noSpeech.includes("recognitionErrorRelistens"), true);
    assert.equal(noSpeech.includes("scheduleRestart()"), true);
    assert.equal(noSpeech.includes('finishRef.current("miss")'), false);
    assert.equal(noSpeech.includes('finishRef.current("timeout")'), false);
  });
});

describe("exercise 2 next letter", () => {
  it("hears the next letter across A through E, and ignores the prompt", () => {
    const prompt = "What letter comes next?";
    const rounds = [
      { shown: "A", answer: "B", shownSaid: ["A", "ay"], aliases: ["B", "bee", "be"] },
      { shown: "B", answer: "C", shownSaid: ["B", "bee", "be"], aliases: ["C", "see", "sea"] },
      { shown: "C", answer: "D", shownSaid: ["C", "see", "sea"], aliases: ["D", "dee", "the"] },
      { shown: "D", answer: "E", shownSaid: ["D", "dee", "the"], aliases: ["E", "e", "ee"] },
      { shown: "E", answer: "F", shownSaid: ["E", "e", "ee"], aliases: ["F", "ef"] },
    ];
    assert.equal(micOpensAfterPrompt(false, SPELLING_LISTEN_GAP_MS), false);
    assert.equal(micOpensAfterPrompt(true, SPELLING_LISTEN_GAP_MS - 1), false);
    assert.equal(micOpensAfterPrompt(true, SPELLING_LISTEN_GAP_MS), true);
    assert.equal(SPELLING_LISTEN_GAP_MS >= 400, true);
    assert.equal(spellingSpokenMatches("A", "the", []), false);
    assert.equal(spellingSpokenMatches("N", "the", []), false);
    assert.equal(spellingSpokenMatches("D", "the", []), true);
    assert.equal(judgeSpellingSpoken("D", openingPrompt(), true, [], openingPrompt()), "wait");

    let state = { index: 1, silence: 0, wrong: 0 };
    for (const round of rounds) {
      const ask = letterView(state);
      assert.equal(ask.say, prompt, round.answer);
      assert.equal(ask.shown, round.shown);
      assert.equal(ask.answer, round.answer);
      assert.notEqual(ask.answer, ask.shown);

      const echo = describeSpellingHear(ask.answer, [{ transcript: prompt, final: true }], ask.also, ask.say);
      assert.equal(echo.judgment, "wait", round.answer);
      assert.equal(echo.status, "I didn't hear anything");
      assert.equal(judgeSpellingSpoken(ask.answer, prompt, true, ask.also, ask.say), "wait");
      assert.equal(judgeSpellingSpoken(ask.answer, "comes next", true, ask.also, ask.say), "wait");
      assert.equal(judgeSpellingSpoken(ask.answer, "", true, ask.also, ask.say), "wait");
      assert.equal(judgeSpellingSpoken(ask.answer, ".", true, ask.also, ask.say), "wait");

      for (const said of round.shownSaid) {
        assert.equal(judgeSpellingSpoken(ask.answer, said, false, ask.also, ask.say), "wait", said);
        assert.equal(judgeSpellingSpoken(ask.answer, said, true, ask.also, ask.say), "miss", said);
        const heard = describeSpellingHear(ask.answer, [{ transcript: said, final: true }], ask.also, ask.say);
        assert.equal(heard.judgment, "miss", said);
        assert.equal(heard.status, `I heard: ${said}`);
      }

      for (const alias of round.aliases) {
        const withPrompt = `${prompt} ${alias}`;
        assert.equal(judgeSpellingSpoken(ask.answer, alias, true, ask.also, ask.say), "correct", alias);
        assert.equal(judgeSpellingSpoken(ask.answer, withPrompt, true, ask.also, ask.say), "correct", withPrompt);
        const heard = describeSpellingHear(ask.answer, [{ transcript: withPrompt, final: true }], ask.also, ask.say);
        assert.equal(heard.judgment, "correct", alias);
        assert.equal(heard.status, `I heard: ${withPrompt}`);
      }

      const missed = applyLetterAnswer(state, "miss");
      assert.equal(missed.index, ask.index);
      assert.equal(missed.wrong, 1);
      const cue = letterView(missed);
      assert.equal(cue.answer, round.answer);
      assert.equal(judgeSpellingSpoken(cue.answer, "", true, cue.also, cue.say), "wait");
      const alias = round.aliases[1] ?? round.aliases[0];
      const heardAlias = describeSpellingHear(cue.answer, [{ transcript: alias, final: true }], cue.also, cue.say);
      assert.equal(heardAlias.judgment, "correct", alias);
      assert.equal(heardAlias.status, `I heard: ${alias}`);
      state = applyLetterAnswer(missed, "correct");
      assert.equal(state.silence, 0);
      assert.equal(state.wrong, 0);
    }

    const landed = letterView(state);
    assert.equal(landed.shown, "F");
    assert.equal(landed.answer, "G");
    assert.equal(landed.say, prompt);

    const lowerA = itemAt("LK", 26);
    assert.equal(lowerA.id, "lk-lower-a");
    assert.equal(lowerA.letter, "a");
    assert.equal(judgeSpellingSpoken(lowerA.answer, lowerA.say, true, lowerA.also, lowerA.say), "wait");
    assert.equal(judgeSpellingSpoken(lowerA.answer, "A", true, lowerA.also, lowerA.say), "correct");
    assert.equal(judgeSpellingSpoken(lowerA.answer, "ay", true, lowerA.also, lowerA.say), "correct");
    assert.equal(judgeSpellingSpoken(lowerA.answer, "eh", true, lowerA.also, lowerA.say), "correct");
    assert.equal(judgeSpellingSpoken(lowerA.answer, "B", true, lowerA.also, lowerA.say), "miss");

    const stage = readFileSync(stageFile, "utf8");
    const promptEffect = stage.slice(stage.indexOf('phase !== "prompt"'), stage.indexOf("if (!canScore)"));
    assert.equal(promptEffect.includes("SPELLING_LISTEN_GAP_MS"), true);
    assert.equal(promptEffect.includes('setPhase("listen")'), true);
    assert.equal(promptEffect.includes("view.shown"), false);
    assert.equal(stage.includes("describeSpellingHear(current.answer, alternatives, current.also, current.say)"), true);
    assert.match(stage, /phase === "prompt" \|\| phase === "listen" \|\| phase === "happy"/);
    const session = readFileSync(fileURLToPath(new URL("../../../routes/session.$id.tsx", import.meta.url)), "utf8");
    assert.equal(session.includes("spellingHeard"), true);
    assert.equal(session.includes("onHeard={setSpellingHeard}"), true);
    assert.equal(session.includes("heard={spellingHeard}"), true);
  });

  it("replays shown A through D: a fumble, two good cards, then a didn't-hear stays on D", () => {
    assert.equal(promptPlayedLongEnough(SPELLING_PROMPT_MIN_MS - 1), false);
    assert.equal(promptPlayedLongEnough(SPELLING_PROMPT_MIN_MS), true);
    assert.equal(earlyHandoffMiss(SPELLING_LISTEN_GAP_MS - 1, "miss"), true);
    assert.equal(earlyHandoffMiss(SPELLING_LISTEN_GAP_MS, "miss"), false);
    assert.equal(earlyHandoffMiss(0, "correct"), false);
    assert.equal(spellingSpokenMatches("D", "dee", []), true);
    assert.equal(spellingSpokenMatches("D", "de", []), true);
    assert.equal(spellingSpokenMatches("D", "d", []), true);
    assert.equal(spellingSpokenMatches("D", "the", []), true);
    assert.equal(spellingSpokenMatches("D", "tea", []), false);
    assert.equal(spellingSpokenMatches("T", "tea", []), true);
    assert.equal(spellingSpokenMatches("A", "de", []), false);
    assert.equal(spellingSpokenMatches("E", "de", []), false);
    assert.equal(spellingSpokenMatches("T", "de", []), false);

    const prompt = "What letter comes next?";
    let state = { index: 1, silence: 0, wrong: 0 };
    const shownA = letterView(state);
    assert.equal(shownA.shown, "A");
    assert.equal(shownA.answer, "B");
    assert.equal(shownA.say, prompt);
    assert.equal(judgeSpellingSpoken(shownA.answer, "A", true, shownA.also, shownA.say), "miss");
    assert.equal(judgeSpellingSpoken(shownA.answer, "B", true, shownA.also, shownA.say), "correct");
    const fumble = applyLetterAnswer(state, "miss");
    assert.equal(fumble.index, shownA.index);
    assert.equal(fumble.wrong, 1);
    assert.equal(letterView(fumble).answer, "B");
    state = applyLetterAnswer(fumble, "correct");

    const shownB = letterView(state);
    assert.equal(shownB.shown, "B");
    assert.equal(shownB.answer, "C");
    assert.equal(judgeSpellingSpoken(shownB.answer, "see", true, shownB.also, shownB.say), "correct");
    state = applyLetterAnswer(state, "correct");

    const shownC = letterView(state);
    assert.equal(shownC.shown, "C");
    assert.equal(shownC.answer, "D");
    for (const said of ["dee", "de", "d", "the"]) {
      assert.equal(judgeSpellingSpoken(shownC.answer, said, true, shownC.also, shownC.say), "correct", said);
    }
    assert.equal(judgeSpellingSpoken(shownC.answer, "tea", true, shownC.also, shownC.say), "miss");
    state = applyLetterAnswer(state, "correct");

    const shownD = letterView(state);
    assert.equal(shownD.shown, "D");
    assert.equal(shownD.answer, "E");
    assert.equal(shownD.say, prompt);
    const silent = describeSpellingHear(shownD.answer, [{ transcript: "", final: true }], shownD.also, shownD.say);
    assert.equal(silent.judgment, "wait");
    assert.equal(silent.status, "I didn't hear anything");
    assert.equal(judgeSpellingSpoken(shownD.answer, prompt, true, shownD.also, shownD.say), "wait");
    state = applyLetterAnswer(state, "timeout");
    assert.equal(state.index, shownD.index);
    assert.equal(letterView(state).shown, "D");
    assert.equal(letterView(state).say, prompt);
    state = applyLetterAnswer(state, "timeout");
    const stayed = letterView(state);
    assert.equal(stayed.shown, "D");
    assert.equal(stayed.answer, "E");
    assert.equal(stayed.index, shownD.index);
    assert.notEqual(stayed.index, 0);
    assert.notEqual(stayed.shown, "A");
    assert.equal(state.silence, 2);

    const stage = readFileSync(stageFile, "utf8");
    const promptEffect = stage.slice(stage.indexOf('phase !== "prompt"'), stage.indexOf("if (!canScore)"));
    assert.equal(promptEffect.includes("promptPlayedLongEnough"), true);
    assert.equal(promptEffect.includes("attempts < 3"), true);
    assert.equal(stage.includes("earlyHandoffMiss"), true);
    const noSpeech = stage.slice(stage.indexOf("rec.onerror"), stage.indexOf("rec.onend"));
    assert.equal(noSpeech.includes('setPhase("prompt")'), true);
    assert.equal(noSpeech.includes("scheduleRestart()"), true);
    assert.equal(noSpeech.includes('finishRef.current("timeout")'), false);
    assert.equal(noSpeech.includes('finishRef.current("miss")'), false);
  });
});

describe("alphabet exercises 3, 4, and 5", () => {
  it("keeps a miss inside the small-letter exercise and inside recall", () => {
    const lower = applyLetterAnswer(applyLetterAnswer({ index: 26, silence: 0, wrong: 0 }, "miss"), "miss");
    assert.equal(lower.index, 26);
    assert.equal(letterExercise(lower.index), 3);
    assert.equal(letterView(lower).shown, "a");
    const recallAt = letterView({ index: 0, silence: 0, wrong: 0 });
    let index = 0;
    while (itemAt("LK", index).id !== "lk-recall-a") index += 1;
    const recall = applyLetterAnswer(applyLetterAnswer({ index, silence: 0, wrong: 0 }, "miss"), "miss");
    assert.equal(recall.index, index);
    assert.equal(letterExercise(recall.index), 4);
    assert.notEqual(recall.index, 0);
    assert.equal(recallAt.exercise, 2);
    let lowerM = 0;
    while (itemAt("LK", lowerM).id !== "lk-lower-m") lowerM += 1;
    const smallM = itemAt("LK", lowerM);
    assert.equal(spellingSpokenMatches(smallM.answer, "em", smallM.also), true);
    assert.equal(spellingSpokenMatches(smallM.answer, "him", smallM.also), true);
    assert.equal(judgeSpellingSpoken(smallM.answer, "the", true, smallM.also, smallM.say), "miss");
  });

  it("moves an old hidden-letter save to exercise 4 and leaves a new card where it is", () => {
    const recallA = migrateAlphabetIndex({ index: 51 });
    assert.equal(letterView({ index: recallA, silence: 0, wrong: 0 }).id, "lk-recall-a");
    assert.equal(letterView({ index: recallA, silence: 0, wrong: 0 }).shown, "");
    assert.equal(letterView({ index: recallA, silence: 0, wrong: 0 }).say, "What is the first letter of the alphabet?");
    const recallM = migrateAlphabetIndex({ index: 63, word: "m" });
    assert.equal(letterView({ index: recallM, silence: 0, wrong: 0 }).id, "lk-recall-m");
    assert.equal(migrateAlphabetIndex({ word: "lk-name-m" }), recallM);
    assert.equal(migrateAlphabetIndex({ index: 51, prompt: MEMORY_LETTER_PROMPT }), recallA);
    const lowerZ = migrateAlphabetIndex({ index: 51, word: "z" });
    assert.equal(letterView({ index: lowerZ, silence: 0, wrong: 0 }).id, "lk-lower-z");
    assert.equal(letterView({ index: lowerZ, silence: 0, wrong: 0 }).shown, "y");
    const keptRecall = migrateAlphabetIndex({ index: 52, word: "a" });
    assert.equal(letterView({ index: keptRecall, silence: 0, wrong: 0 }).id, "lk-recall-a");
    const fromAfter = migrateAlphabetIndex({ word: "lk-after-a" });
    assert.equal(letterView({ index: fromAfter, silence: 0, wrong: 0 }).id, "lk-lower-a");
    const sung = progressAfterSong({ index: 63, silence: 2, wrong: 1, prompt: MEMORY_LETTER_PROMPT });
    assert.equal(itemAt("LK", sung.index).id, "lk-first");
    assert.equal(letterExercise(sung.index), 2);
    const opened = letterView({ index: sung.index, silence: 0, wrong: 0 });
    assert.equal(opened.id, "lk-first");
    assert.notEqual(opened.say, MEMORY_LETTER_PROMPT);
    const stayed = letterView(progressAfterSong({ index: 51, silence: 0, wrong: 0, word: "lk-lower-z" }));
    assert.equal(stayed.id, "lk-first");
    assert.notEqual(stayed.say, MEMORY_LETTER_PROMPT);
  });

  it("tracks a recited alphabet through chunks, names, and pauses, then celebrates for 5 seconds", () => {
    assert.equal(SPELLING_CELEBRATION_MS, 5000);
    assert.equal(celebrationFrame(0), "celebrate");
    assert.equal(celebrationFrame(4999), "celebrate");
    assert.equal(celebrationFrame(5000), "done");
    assert.equal(celebrationFrame(5001), "done");
    assert.equal(GOOD_JOB_LINE, "Good job!");
    const chunk = reciteHear({ next: 0 }, "ay bee see", RECITE_PROMPT);
    assert.equal(chunk.next, 3);
    assert.deepEqual(chunk.accepted, ["A", "B", "C"]);
    assert.equal(chunk.status, "I heard: A B C");
    const named = reciteHear({ next: 3 }, "the", RECITE_PROMPT);
    assert.equal(named.next, 4);
    assert.deepEqual(named.accepted, ["D"]);
    const tea = reciteHear({ next: 3 }, "tea", RECITE_PROMPT);
    assert.equal(tea.next, 3);
    assert.deepEqual(tea.accepted, []);
    const quiet = reciteHear({ next: 5 }, "", RECITE_PROMPT);
    assert.equal(quiet.next, 5);
    assert.equal(quiet.status, "I didn't hear anything");
    const skipped = reciteHear({ next: 0 }, "c", RECITE_PROMPT);
    assert.equal(skipped.next, 0);
    const partial = reciteHear({ next: 0 }, "A B D", RECITE_PROMPT);
    assert.equal(partial.next, 2);
    assert.deepEqual(partial.accepted, ["A", "B"]);
    const continued = reciteHear({ next: partial.next }, "see", RECITE_PROMPT);
    assert.equal(continued.next, 3);
    const w = reciteHear({ next: alphabet().indexOf("W") }, "double you", RECITE_PROMPT);
    assert.equal(w.next, alphabet().indexOf("W") + 1);
    assert.deepEqual(w.accepted, ["W"]);
    const done = reciteHear({ next: 25 }, "zed", RECITE_PROMPT);
    assert.equal(done.next, 26);
    const stage = readFileSync(stageFile, "utf8");
    assert.equal(stage.includes("celebrationFrame"), true);
    assert.equal(stage.includes("SPELLING_CELEBRATION_MS"), true);
    assert.equal(stage.includes("reciteHear"), true);
    assert.equal(stage.includes("sp-celebrate"), true);
    assert.equal(stage.includes(GOOD_JOB_LINE) || stage.includes("GOOD_JOB_LINE"), true);
    assert.equal(stage.includes('viewRef.current.exercise === 5'), true);
    const session = readFileSync(fileURLToPath(new URL("../../../routes/session.$id.tsx", import.meta.url)), "utf8");
    assert.equal(session.includes('letterExercise(answered) === 5'), true);
    assert.equal(session.includes('finishRef.current("finished")'), true);
  });
});

describe("level.sp", () => {
  it("reads and writes only this account's spelling band", () => {
    const parsed = parseSchoolProfile({
      family: {
        email: "ada@family.test",
        access: "open",
        student: { name: "Ada" },
        level: {
          sp: {
            id: "sp-ada",
            name: "Ada",
            enteredBy: "parent",
            grade: 1,
            band: "LK",
            index: 1,
            word: "lk-next-b",
            reached: 2,
            missed: 1,
            earnedGrade: 1,
            levelCode: "LK",
            levelLabel: "Letter knowledge",
          },
          sw: { grade: 1, band: "D-1", index: 0, word: "after" },
        },
      },
    });
    const sp = parsed?.profile.level.sp;
    assert.equal(parsed?.id, "ada@family.test");
    assert.equal(sp?.band, "LK");
    assert.equal(sp?.index, 1);
    assert.equal(sp?.word, "lk-next-b");
    assert.equal(sp?.grade, 1);
    assert.equal(sp?.step, 0);
    assert.equal(sp?.id, "sp-ada");
    assert.equal(parsed?.profile.level.sw?.word, "after");
    const written = spAccountLevel(sp, {
      name: "Ada",
      grade: 1,
      band: "LK",
      index: 2,
      word: "lk-next-c",
      silence: 1,
      wrong: 2,
      earnedGrade: 1,
      reached: 3,
      missed: 1,
      startingGrade: 1,
      updatedAt: 10,
    });
    const cue = letterView({ index: 2, silence: 1, wrong: 2 });
    assert.equal(written.band, "LK");
    assert.equal(written.index, 2);
    assert.equal(written.streak, 1);
    assert.equal(written.missStreak, 2);
    assert.equal(written.word, cue.id);
    assert.equal(cue.kind, "cue");
    assert.equal(written.levelCode, "LK");
    assert.equal(written.levelLabel, "Letter knowledge");
    assert.equal(written.step, 0);
    const body = schoolWriteBody({ sp: written }, 0, 0, []);
    assert.equal(body.levels.sp?.band, "cvc");
    assert.equal(body.levels.sp?.word, "c");
    assert.equal(body.levels.sp?.index, 2);
    assert.equal(body.levels.sp?.streak, 1);
    assert.equal(body.levels.sp?.missStreak, 2);
    assert.equal(written.band, "LK");
    assert.equal(written.word, cue.id);
    assert.equal("sw" in body.levels, false);
    assert.equal(JSON.stringify(body).includes("bea@other.test"), false);
    assert.equal(JSON.stringify(body).includes("after"), false);
  });

  it("starts a numeric grade at the first letter, and keeps a saved index", () => {
    const fresh = parseSchoolProfile({
      family: {
        email: "ada@family.test", level: { sp: 1 } },
    });
    assert.equal(fresh?.profile.level.sp?.band, "LK");
    assert.equal(fresh?.profile.level.sp?.index, 0);
    assert.equal(fresh?.profile.level.sp?.word, "lk-first");
    const kept = parseSchoolProfile({
      family: {
        email: "ada@family.test", level: { sp: { grade: 5, levelCode: "LK", index: 51 } } },
    });
    assert.equal(kept?.profile.level.sp?.band, "LK");
    const recalled = letterView({ index: kept?.profile.level.sp?.index ?? 0, silence: 0, wrong: 0 });
    assert.equal(recalled.id, "lk-recall-a");
    assert.equal(kept?.profile.level.sp?.word, "lk-recall-a");
    assert.equal(recalled.shown, "");
    assert.equal(recalled.say, "What is the first letter of the alphabet?");
    assert.notEqual(recalled.say, MEMORY_LETTER_PROMPT);
    const mid = parseSchoolProfile({
      family: {
        email: "ada@family.test", level: { sp: { grade: 2, band: "LK", index: 12 } } },
    });
    assert.equal(mid?.profile.level.sp?.index, 12);
    assert.equal(mid?.profile.level.sp?.word, "lk-next-m");
  });

  it("sends a spelling payload the website keeps, and reads the letter back", () => {
    const websiteBands = ["cvc", "blends", "vowels", "patterns", "affixes"];
    const wordRule = /^[a-z]+(?:'[a-z]+)?$/;
    const written = spAccountLevel(undefined, {
      name: "Ada",
      grade: 0,
      band: "LK",
      index: 12,
      word: "lk-next-m",
      silence: 1,
      wrong: 2,
      earnedGrade: 1,
      reached: 4,
      missed: 1,
      updatedAt: 10,
    });
    const high = spAccountLevel(undefined, {
      name: "Ada",
      grade: 14,
      band: "LK",
      index: 0,
      word: "lk-first",
      silence: 0,
      wrong: 0,
      earnedGrade: 1,
      reached: 0,
      missed: 0,
      updatedAt: 10,
    });
    const body = schoolWriteBody({ sp: written }, 0, 0, []);
    const sp = body.levels.sp;
    assert.ok(sp);
    assert.equal(websiteBands.includes(String(sp.band)), true);
    assert.equal(sp.band, "cvc");
    assert.equal(Number.isInteger(sp.grade) && sp.grade >= 1 && sp.grade <= 12, true);
    assert.equal(sp.grade, 1);
    assert.match(sp.word ?? "", wordRule);
    assert.equal(sp.word, "m");
    assert.equal(sp.index, 12);
    assert.equal(sp.streak, 1);
    assert.equal(sp.missStreak, 2);
    assert.equal(sp.levelCode, "cvc");
    assert.equal(wordRule.test("lk-next-m"), false);
    assert.equal(wordRule.test("don't"), true);
    const capped = schoolWriteBody({ sp: high }, 0, 0, []);
    assert.equal(capped.levels.sp?.grade, 12);
    assert.equal(capped.levels.sp?.word, "a");
    const restored = parseSchoolProfile({
      family: {
        email: "ada@family.test",
        level: { sp: { grade: sp.grade, band: sp.band, word: sp.word, index: sp.index, streak: sp.streak, missStreak: sp.missStreak } },
      },
    });
    const again = restored?.profile.level.sp;
    const cue = letterView({ index: 12, silence: 1, wrong: 2 });
    assert.equal(again?.band, "LK");
    assert.equal(again?.index, 12);
    assert.equal(again?.word, cue.id);
    assert.equal(again?.streak, 1);
    assert.equal(again?.missStreak, 2);
    assert.equal(again?.levelCode, "LK");
    const letterOnly = parseSchoolProfile({
      family: { email: "ada@family.test", level: { sp: { grade: 3, band: "cvc", word: "m" } } },
    });
    assert.equal(letterOnly?.profile.level.sp?.band, "LK");
    assert.equal(letterOnly?.profile.level.sp?.index, 12);
    assert.equal(letterOnly?.profile.level.sp?.word, letterView({ index: 12, silence: 0, wrong: 0 }).id);
    const keptWord = parseSchoolProfile({
      family: { email: "ada@family.test", level: { sp: { grade: 2, band: "blends", word: "bl" } } },
    });
    const kept = schoolWriteBody({ sp: keptWord?.profile.level.sp ?? { grade: 1, step: 0 } }, 0, 0, []);
    assert.equal(kept.levels.sp?.band, "blends");
    assert.equal(kept.levels.sp?.word, "bl");
    assert.match(kept.levels.sp?.word ?? "", wordRule);
  });

  it("shows Alphabet to parents, including a sitting stored as VKOLE/Spelling", () => {
    const letter = academicLetter({
      firstName: "Ada",
      age: 6,
      subject: "sp",
      level: 1,
      standardCode: "LK",
      standardLabel: "The letter A",
      asked: 1,
      rightCount: 1,
      parentEmail: "ada@family.test",
      trial: trialState("2026-10-01T00:00:00.000Z"),
      events: [
        {
          at: "2026-10-01T00:00:00.000Z",
          levelAfter: 1,
          correct: true,
          detail: JSON.stringify({
            question: "A",
            answer: "A",
            note: "Heard.",
            correct: true,
            engine: "VKOLE/Spelling",
            code: "LK",
            label: "The letter A",
            grade: "1",
          }),
        },
      ],
    });
    assert.match(letter.body, /Engine: VKOLE\/Alphabet/);
    assert.equal(letter.body.includes("VKOLE/Spelling"), false);
    assert.match(letter.body, /Band: LK/);
    assert.equal(letter.body.includes("Common Core"), false);
    assert.match(letter.html, />VKOLE\/Alphabet</);
    assert.match(letter.html, /<strong>Band:<\/strong> LK/);
    const logout = parentLogoutLetter({
      parentName: "Ada Parent",
      parentEmail: "ada@family.test",
      children: [{ firstName: "Ada", apps: [{ subject: "sp", level: 1, earnedLevel: 1, onlineSeconds: 12, loggedIn: true }] }],
    });
    assert.match(logout.body, /VKOLE\/Alphabet/);
    assert.equal(logout.body.includes("Spelling"), false);
  });
});
