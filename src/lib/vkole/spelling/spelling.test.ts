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
  letterExercise,
  letterOnScreen,
  letterView,
  MEMORY_LETTER_PROMPT,
  progressAfterSong,
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
    assert.match(stage, /if \(outcome === "correct"\) \{[\s\S]*SPELLING_HAPPY_FACE_MS[\s\S]*return;\s*\}\s*onDoneRef\.current\(outcome\);/);
    assert.equal(stage.includes("micListensDuring"), true);
    assert.equal(stage.includes('aria-label="Happy Face"'), true);
    assert.equal(stage.includes("VKOLE/Alphabet ZPD"), true);
    assert.equal(stage.includes('aria-label="Start alphabet"'), true);
    assert.equal(stage.includes("VKOLE/Spelling"), false);
    assert.equal(stage.includes("Start spelling"), false);
  });
});

describe("letter knowledge sequence", () => {
  it("starts with the spoken first-letter prompt, then next letter, letter after X, and letter names", () => {
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
    assert.equal(bandMeta("LK").count, 77);
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
    const afterX = lists.bands[0]?.items.find((item) => item.id === "lk-after-x");
    assert.equal(afterX?.kind, "letter-after");
    assert.equal(afterX?.say, "What letter comes after X?");
    assert.equal(afterX?.show, "What letter comes after X?");
    assert.equal(afterX?.answer, "Y");
    const nameM = lists.bands[0]?.items.find((item) => item.id === "lk-name-m");
    assert.equal(nameM?.kind, "letter-name");
    assert.equal(nameM?.say, "What letter is this?");
    assert.equal(nameM?.letter, "M");
    assert.equal(nameM?.answer, "M");
    assert.equal(startCard(1).id, "lk-first");
    assert.equal(lists.micRecords, false);
    assert.equal(lists.answerFlow.correct.action, "next");
    assert.equal(lists.answerFlow.silence[0]?.action, "repeat");
    assert.equal(lists.answerFlow.silence[1]?.action, "back");
    assert.equal(lists.answerFlow.silence[1]?.letters, 3);
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
    assert.equal(letterView(wrapped).id, "lk-after-a");
    assert.equal(letterView(wrapped).answer, "B");
    assert.equal(letterView(wrapped).shown, "A");
  });

  it("enters the memory exercise at A with no letter on screen, then continues", () => {
    let index = 0;
    while (itemAt("LK", index).kind !== "letter-name" && index < bandMeta("LK").count) index += 1;
    const at = applyLetterAnswer({ index: index - 1, silence: 0, wrong: 0 }, "correct");
    const view = letterView(at);
    assert.equal(itemAt("LK", index - 1).kind, "letter-after");
    assert.equal(view.id, "lk-name-a");
    assert.equal(view.kind, "ask");
    assert.equal(view.answer, "A");
    assert.equal(view.letter, "A");
    assert.equal(view.shown, "");
    assert.equal(view.say.trim().length > 0, true);
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
    assert.equal(letterView(stayed).id, "lk-name-a");
    assert.equal(letterView(stayed).shown, "");
    const next = letterView(applyLetterAnswer(at, "correct"));
    assert.equal(next.id, "lk-name-b");
    assert.equal(next.answer, "B");
    assert.equal(next.shown, "");
    const last = bandMeta("LK").count - 1;
    assert.equal(letterView({ index: last, silence: 0, wrong: 0 }).id, "lk-name-z");
    assert.equal(applyLetterAnswer({ index: last, silence: 0, wrong: 0 }, "correct").index, 0);
    const stage = readFileSync(stageFile, "utf8");
    const promptEffect = stage.slice(stage.indexOf('phase !== "prompt"'), stage.indexOf("if (!canScore)"));
    assert.equal(promptEffect.includes("spellingPromptStartsListen"), true);
    assert.equal(promptEffect.includes('setPhase("listen")'), true);
    assert.equal(promptEffect.includes("view.shown"), false);
  });

  it("keeps a letter on screen across every exercise handoff, and hides it only for memory", () => {
    const count = bandMeta("LK").count;
    const lastOf = (exercise: 1 | 2 | 3) => {
      let index = 0;
      for (let i = 0; i < count; i += 1) if (letterExercise(i) === exercise) index = i;
      return index;
    };
    const end1 = lastOf(1);
    const into2 = letterView(applyLetterAnswer({ index: end1, silence: 0, wrong: 0 }, "correct"));
    assert.equal(letterExercise(end1), 1);
    assert.equal(letterExercise(into2.index), 2);
    assert.equal(into2.id, "lk-after-a");
    assert.equal(into2.shown, "A");
    assert.notEqual(into2.say, MEMORY_LETTER_PROMPT);

    const end2 = lastOf(2);
    const into3 = letterView(applyLetterAnswer({ index: end2, silence: 0, wrong: 0 }, "correct"));
    assert.equal(itemAt("LK", end2).id, "lk-after-y");
    assert.equal(letterExercise(into3.index), 3);
    assert.equal(into3.id, "lk-name-a");
    assert.equal(into3.shown, "");
    assert.equal(into3.say, MEMORY_LETTER_PROMPT);

    const end3 = lastOf(3);
    const restarted = applyLetterAnswer({ index: end3, silence: 0, wrong: 0 }, "correct");
    const restart = letterView(restarted);
    assert.equal(itemAt("LK", end3).id, "lk-name-z");
    assert.equal(restart.index, 0);
    assert.equal(letterExercise(restart.index), 1);
    assert.equal(restart.shown, "A");
    assert.notEqual(restart.say, MEMORY_LETTER_PROMPT);
    const continued = letterView(applyLetterAnswer(restarted, "correct"));
    assert.equal(continued.id, "lk-next-b");
    assert.equal(continued.shown, "A");
    assert.equal(letterExercise(continued.index), 1);
    assert.notEqual(continued.say, MEMORY_LETTER_PROMPT);

    const afterSong = letterView({ index: 0, silence: 0, wrong: 0 });
    assert.equal(afterSong.shown, "A");
    assert.equal(afterSong.say, openingPrompt());
    assert.notEqual(afterSong.say, MEMORY_LETTER_PROMPT);
    assert.equal(letterOnScreen("first-letter", "", "A"), "A");
    assert.equal(letterOnScreen("letter-after", "", "Y"), "Y");
    assert.equal(letterOnScreen("letter-name", "M", "M"), "");

    const sung = songSpokenLines();
    assert.deepEqual(sung, alphabet());
    const memoryAt = lastOf(3);
    const afterMemory = letterView(progressAfterSong({ index: memoryAt, silence: 2, wrong: 1 }));
    assert.equal(afterMemory.index, 0);
    assert.equal(afterMemory.shown, "A");
    assert.equal(afterMemory.say, openingPrompt());
    assert.notEqual(afterMemory.say, MEMORY_LETTER_PROMPT);
    const afterShowing = letterView(progressAfterSong({ index: end1, silence: 1, wrong: 0 }));
    assert.equal(afterShowing.index, end1);
    assert.match(afterShowing.shown, /^[A-Z]$/);
    assert.notEqual(afterShowing.say, MEMORY_LETTER_PROMPT);
    const afterSecond = letterView(progressAfterSong({ index: end2, silence: 0, wrong: 0 }));
    assert.equal(letterExercise(afterSecond.index), 2);
    assert.match(afterSecond.shown, /^[A-Z]$/);
    assert.notEqual(afterSecond.say, MEMORY_LETTER_PROMPT);
    const stage = readFileSync(stageFile, "utf8");
    assert.equal(stage.includes("progressAfterSong"), true);
    assert.equal(stage.includes("setAfterSong(true)"), true);

    for (let index = 0; index < count; index += 1) {
      const view = letterView({ index, silence: 0, wrong: 0 });
      if (letterExercise(index) === 3) {
        assert.equal(view.shown, "");
        assert.equal(view.say, MEMORY_LETTER_PROMPT);
      } else {
        assert.match(view.shown, /^[A-Z]$/);
        assert.notEqual(view.say, MEMORY_LETTER_PROMPT);
      }
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

  it("goes back 3 letters after a second silence, and clamps at A", () => {
    const once = applyLetterAnswer(g, "timeout");
    const back = applyLetterAnswer(once, "timeout");
    assert.equal(back.index, g.index - 3);
    assert.equal(back.silence, 0);
    assert.equal(back.wrong, 0);
    const view = letterView(back);
    assert.equal(view.kind, "ask");
    assert.equal(view.answer, "D");
    const fromB = applyLetterAnswer({ index: alphabet().indexOf("B"), silence: 1, wrong: 0 }, "timeout");
    assert.equal(fromB.index, 0);
    assert.equal(letterView(fromB).answer, "A");
    const fromC = applyLetterAnswer({ index: alphabet().indexOf("C"), silence: 1, wrong: 0 }, "timeout");
    assert.equal(fromC.index, 0);
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
    assert.equal(timedAgain.index, g.index - 3);
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
    const nameW = lists.bands[0]?.items.find((item) => item.id === "lk-name-w");
    assert.ok(nameW);
    assert.equal(spellingSpokenMatches(nameW.answer, "double you", nameW.also), true);
    assert.equal(spellingSpokenMatches(nameW.answer, "double u", nameW.also), true);
    assert.equal(spellingSpokenMatches(nameW.answer, "u", nameW.also), false);
    const nameY = lists.bands[0]?.items.find((item) => item.id === "lk-name-y");
    assert.ok(nameY);
    assert.equal(spellingSpokenMatches(nameY.answer, "why", nameY.also), true);
    const nameZ = lists.bands[0]?.items.find((item) => item.id === "lk-name-z");
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
      D: ["dee"],
      E: ["ee"],
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
    const nameM = itemAt("LK", 0);
    let letterM = nameM;
    for (let index = 0; index < 80 && letterM.id !== "lk-name-m"; index += 1) letterM = itemAt("LK", index);
    assert.equal(letterM.id, "lk-name-m");
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
    assert.equal(noSpeech.includes('finishRef.current("miss")'), false);
    assert.equal(noSpeech.includes('finishRef.current("timeout")'), false);
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
    assert.equal(kept?.profile.level.sp?.index, 51);
    assert.equal(kept?.profile.level.sp?.word, "lk-name-a");
    assert.equal(letterView({ index: 51, silence: 0, wrong: 0 }).shown, "");
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
