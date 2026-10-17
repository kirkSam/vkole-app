import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSchoolProfile } from "../../school-account.ts";
import {
  BAND_LABELS,
  GRADE_LABELS,
  GRADE_START_BAND,
  SIGHT_WORD_ADVANCE_MS,
  SIGHT_WORD_BANDS,
  SIGHT_WORD_ENGINE,
  SIGHT_WORD_MAX_SHOW_MS,
  gradeForBand,
} from "../constants.ts";
import { foldSpeech, judgeSpoken, spokenMatches } from "./match.ts";
import { swAccountLevel } from "./level.ts";
import { bandWords, nextCard, sightCard, startCard } from "./words.ts";

describe("sight word lists", () => {
  it("uses the sw key, the sixteen bands, and the spoken timings", () => {
    assert.equal(SIGHT_WORD_ENGINE, "sw");
    assert.deepEqual(SIGHT_WORD_BANDS, ["D-PP", "D-P", "D-1", "D-2", "D-3", "D-N", "F-1", "F-2", "F-3", "F-4", "F-5", "F-6", "F-7", "F-8", "F-9", "F-10"]);
    assert.equal(SIGHT_WORD_ADVANCE_MS, 2000);
    assert.equal(SIGHT_WORD_MAX_SHOW_MS, 20000);
  });

  it("keeps the published Dolch and Fry counts", () => {
    assert.equal(bandWords("D-PP").length, 40);
    assert.equal(bandWords("D-P").length, 52);
    assert.equal(bandWords("D-1").length, 41);
    assert.equal(bandWords("D-2").length, 46);
    assert.equal(bandWords("D-3").length, 41);
    assert.equal(bandWords("D-N").length, 95);
    assert.equal(bandWords("D-PP")[0], "a");
    assert.equal(bandWords("D-PP").includes("I"), true);
    assert.equal(bandWords("D-N").includes("Santa Claus"), true);
    for (let n = 1; n <= 10; n += 1) {
      assert.equal(bandWords(`F-${n}` as "F-1").length, 100);
    }
    assert.equal(bandWords("F-1")[0], "the");
  });

  it("maps each grade to a label and a start band", () => {
    assert.equal(GRADE_LABELS[1], "Grade 1");
    assert.equal(GRADE_LABELS[12], "Grade 12");
    assert.equal(GRADE_START_BAND[1], "D-PP");
    assert.equal(GRADE_START_BAND[2], "D-1");
    assert.equal(GRADE_START_BAND[4], "D-3");
    assert.equal(GRADE_START_BAND[5], "D-N");
    assert.equal(GRADE_START_BAND[6], "F-1");
    assert.equal(GRADE_START_BAND[12], "F-7");
    assert.equal(gradeForBand("D-P"), 1);
    assert.equal(gradeForBand("D-1"), 2);
    assert.equal(gradeForBand("F-8"), 12);
    assert.equal(gradeForBand("F-10"), 12);
    for (let grade = 1; grade <= 12; grade += 1) {
      assert.equal(gradeForBand(GRADE_START_BAND[grade]!), grade);
      assert.equal(BAND_LABELS[GRADE_START_BAND[grade]!].length > 0, true);
    }
  });

  it("moves to the next word and does not stay for a retry", () => {
    const first = startCard(1);
    assert.equal(first.word, "a");
    assert.equal(first.band, "D-PP");
    const second = nextCard(first.band, first.index);
    assert.equal(second.word, "and");
    assert.equal(second.band, "D-PP");
    const end = sightCard("D-PP", 39);
    const crossed = nextCard(end.band, end.index);
    assert.equal(crossed.band, "D-P");
    assert.equal(crossed.index, 0);
    const last = sightCard("F-10", 99);
    const again = nextCard(last.band, last.index);
    assert.equal(again.band, "F-10");
    assert.equal(again.index, 0);
    assert.equal(again.grade, 12);
  });
});

describe("spoken match", () => {
  it("accepts case, apostrophes, fillers, and extra words", () => {
    assert.equal(spokenMatches("the", "The"), true);
    assert.equal(spokenMatches("I", "i"), true);
    assert.equal(spokenMatches("don't", "dont"), true);
    assert.equal(spokenMatches("don't", "don’t"), true);
    assert.equal(spokenMatches("Santa Claus", "um santa claus"), true);
    assert.equal(spokenMatches("the", "the word is the"), true);
    assert.equal(foldSpeech("It's"), "its");
    assert.equal(spokenMatches("it's", "its"), true);
  });

  it("does not treat a different sight word as the same word", () => {
    assert.equal(spokenMatches("to", "too"), false);
    assert.equal(spokenMatches("to", "two"), false);
    assert.equal(spokenMatches("can", "can't"), false);
    assert.equal(spokenMatches("the", ""), false);
    assert.equal(spokenMatches("the", "um"), false);
  });

  it("waits on a partial phrase and misses only a finished one", () => {
    assert.equal(judgeSpoken("there", "th", false), "wait");
    assert.equal(judgeSpoken("there", "the", true), "miss");
    assert.equal(judgeSpoken("there", "there", false), "correct");
  });
});

describe("level.sw", () => {
  it("reads and writes the website field names", () => {
    const parsed = parseSchoolProfile({
      ok: true,
      id: "ada@school.test",
      profile: {
        access: "open",
        student: { name: "Ada" },
        level: {
          sw: {
            id: "sw-ada",
            name: "Ada",
            enteredBy: "parent",
            grade: 4,
            band: "D-3",
            index: 3,
            word: "cut",
            reached: 8,
            missed: 2,
            earnedGrade: 4,
            levelCode: "D-3",
            levelLabel: "Dolch grade 3",
          },
        },
      },
    });
    const sw = parsed?.profile.level.sw;
    assert.equal(sw?.band, "D-3");
    assert.equal(sw?.index, 3);
    assert.equal(sw?.word, "cut");
    assert.equal(sw?.step, 0);
    assert.equal(sw?.grade, 4);
    assert.equal(sw?.id, "sw-ada");
    const written = swAccountLevel(sw, {
      name: "Ada",
      band: "D-3",
      index: 3,
      word: "cut",
      earnedGrade: 4,
      reached: 9,
      missed: 2,
      startingGrade: 4,
      updatedAt: 10,
    });
    assert.equal(written.id, "sw-ada");
    assert.equal(written.band, "D-3");
    assert.equal(written.index, 3);
    assert.equal(written.word, "cut");
    assert.equal(written.levelCode, "D-3");
    assert.equal(written.levelLabel, "Dolch grade 3");
    assert.equal(written.reached, 9);
    assert.equal(written.step, 0);
    assert.equal(written.enteredBy, "parent");
  });

  it("starts a bare grade on that grade's band", () => {
    const parsed = parseSchoolProfile({
      ok: true,
      id: "ada@school.test",
      profile: { level: { sw: 2 } },
    });
    assert.equal(parsed?.profile.level.sw?.grade, 2);
    assert.equal(parsed?.profile.level.sw?.band, "D-1");
    assert.equal(parsed?.profile.level.sw?.index, 0);
    assert.equal(parsed?.profile.level.sw?.levelLabel, "Dolch grade 1");
  });
});
