import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { engineNavLabel, enginePickLabel } from "../../climb-rules.ts";
import { parseSchoolProfile, schoolWriteBody } from "../../school-account.ts";
import { spAccountLevel } from "./level.ts";
import {
  SPELLING_BANDS,
  SPELLING_ENGINE,
  SPELLING_HAPPY_FACE_MS,
  SPELLING_LETTER_MS,
  SPELLING_MAX_CHANGES_PER_SECOND,
  SPELLING_RESPONSE_MS,
  SPELLING_SONG_MS,
  alphabet,
  applyLetterAnswer,
  bandMeta,
  cardFromAccount,
  filledBands,
  itemAt,
  letterAtSongTime,
  letterColors,
  letterView,
  micListensDuring,
  openingPrompt,
  reviewChangesPerSecond,
  startCard,
} from "./items.ts";
import { judgeSpellingSpoken, spellingSpokenMatches } from "./match.ts";
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
  });
});

describe("letter knowledge sequence", () => {
  it("starts with the spoken first-letter prompt, then next letter, letter after X, and letter names", () => {
    assert.equal(engineNavLabel("sp"), "VKOLE/Spelling ZPD");
    assert.equal(engineNavLabel("sp"), lists.navLabel);
    assert.equal(enginePickLabel("sp"), "Spelling ZPD");
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
    assert.equal(lists.answerFlow.wrong[1]?.action, "cue");
    assert.equal(lists.answerFlow.wrong[1]?.letters, 5);
    assert.equal(lists.answerFlow.wrong[2]?.action, "restart");
    assert.equal(lists.answerFlow.wrong[2]?.letter, "A");
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
    assert.equal(wrapped.index, 0);
    assert.equal(letterView(wrapped).answer, "A");
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
    assert.equal(atA.shown, "");
    assert.equal(atA.answer, "A");
  });

  it("shows and speaks the 5 prior letters after another wrong answer or silence", () => {
    const cue3 = applyLetterAnswer(g, "miss");
    const cue5 = applyLetterAnswer(cue3, "miss");
    assert.equal(cue5.wrong, 2);
    assert.equal(cue5.index, g.index);
    const view = letterView(cue5);
    assert.equal(view.kind, "cue");
    assert.deepEqual(view.cue, ["B", "C", "D", "E", "F"]);
    assert.equal(view.show, "B C D E F");
    assert.equal(view.say, "B, C, D, E, F");
    assert.equal(view.answer, "G");
    const fromSilence = letterView(applyLetterAnswer(cue3, "timeout"));
    assert.deepEqual(fromSilence.cue, ["B", "C", "D", "E", "F"]);
    assert.equal(fromSilence.answer, "G");
  });

  it("starts again at A after the 5-letter prompt is still wrong", () => {
    const cue3 = applyLetterAnswer(g, "miss");
    const cue5 = applyLetterAnswer(cue3, "miss");
    const restart = applyLetterAnswer(cue5, "miss");
    assert.deepEqual(restart, { index: 0, silence: 0, wrong: 0 });
    const view = letterView(restart);
    assert.equal(view.kind, "ask");
    assert.equal(view.answer, "A");
    assert.equal(view.say, openingPrompt());
    const fromSilence = applyLetterAnswer(cue5, "timeout");
    assert.deepEqual(fromSilence, { index: 0, silence: 0, wrong: 0 });
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
    assert.equal(judgeSpellingSpoken(first.answer, "", true, first.also), "miss");
    assert.equal(judgeSpellingSpoken(first.answer, "be", false, first.also), "wait");
    assert.equal(judgeSpellingSpoken(first.answer, "ay", false, first.also), "correct");
    assert.equal(judgeSpellingSpoken(first.answer, "bee", true, first.also), "miss");
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
    assert.equal(kept?.profile.level.sp?.index, 25);
    assert.equal(kept?.profile.level.sp?.word, letterView({ index: 25, silence: 0, wrong: 0 }).id);
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
});
