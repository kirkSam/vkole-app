import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { academicLetter, parentLogoutLetter, trialState } from "../../academic-email.ts";
import { engineNavLabel, enginePickLabel } from "../../climb-rules.ts";
import { parseSchoolProfile, schoolWriteBody } from "../../school-account.ts";
import { paAccountLevel } from "./level.ts";
import {
  PA_ADVANCE_MS,
  PA_BANDS,
  PA_DROP_AFTER,
  PA_ENGINE,
  PA_MAX_SHOW_MS,
  PA_RISE_AFTER,
  PA_ROUND_SIZE,
  canonicalBands,
  cardFromAccount,
  itemAt,
  nextAfterAnswer,
  startBand,
  startCard,
} from "./items.ts";
import { judgePaSpoken, paSpokenMatches } from "./match.ts";
import lists from "./data.json" with { type: "json" };

const appFile = fileURLToPath(new URL("./data.json", import.meta.url));
const docFile = fileURLToPath(new URL("../../../../docs/phonemic-awareness-website-canonical.json", import.meta.url));

describe("canonical phonemic awareness file", () => {
  it("copies the website file byte for byte", () => {
    const app = readFileSync(appFile);
    const doc = readFileSync(docFile);
    assert.equal(app.equals(doc), true);
    assert.equal(app.length, 19313);
  });

  it("keeps the eight bands, timings, and round size from that file", () => {
    assert.equal(PA_ENGINE, "pa");
    assert.deepEqual(PA_BANDS, ["WA", "RH", "SY", "OR", "IS", "BL", "PS", "PD"]);
    assert.deepEqual(
      canonicalBands().map((band) => band.id),
      lists.bands.map((band) => band.id),
    );
    assert.equal(PA_ADVANCE_MS, 2000);
    assert.equal(PA_MAX_SHOW_MS, 20000);
    assert.equal(PA_RISE_AFTER, 2);
    assert.equal(PA_DROP_AFTER, 2);
    assert.equal(PA_ROUND_SIZE, 5);
    assert.equal(lists.placement.byAge["4"], "WA");
    assert.equal(lists.placement.byAge["5"], "RH");
    assert.equal(lists.placement.byGrade["1"], "IS");
    assert.equal(lists.placement.byGrade["2"], "PD");
    assert.equal(lists.placement.older, "PD");
    for (const band of canonicalBands()) {
      assert.equal(band.count, 8, band.id);
    }
    assert.equal(canonicalBands()[0]?.name, "Word awareness");
    assert.equal(canonicalBands()[0]?.grade, "Pre-K");
    assert.equal(canonicalBands()[0]?.first, "wa-cat-sat");
    assert.equal(canonicalBands()[7]?.name, "Phoneme deletion and substitution");
    assert.equal(canonicalBands()[7]?.grade, "2nd");
    assert.equal(canonicalBands()[7]?.last, "pd-sub-log");
    assert.equal(itemAt("PS", 0).boxes, 3);
    assert.equal(engineNavLabel("pa"), "VKOLE/Phonemic Awareness ZPD");
    assert.equal(enginePickLabel("pa"), "Phonemic Awareness ZPD");
  });
});

describe("phonemic placement and movement", () => {
  it("starts from age before grade, and keeps a saved band", () => {
    assert.equal(startBand({ age: 4, grade: 2 }), "WA");
    assert.equal(startBand({ age: 5, grade: 1 }), "RH");
    assert.equal(startBand({ age: 6, grade: 1 }), "IS");
    assert.equal(startBand({ grade: 1 }), "IS");
    assert.equal(startBand({ grade: 2 }), "PD");
    assert.equal(startBand({ age: 12, grade: 8 }), "PD");
    assert.equal(startBand({ grade: 0 }), "WA");
    assert.equal(startCard(1, 4).id, "wa-cat-sat");
    assert.equal(startCard(1, 4).grade, 1);
    const saved = cardFromAccount({ grade: 2, age: 4, band: "PS", index: 3 }, 2);
    assert.equal(saved.band, "PS");
    assert.equal(saved.index, 3);
    assert.equal(saved.id, "ps-dog");
    assert.equal(saved.grade, 2);
    const byCode = cardFromAccount({ grade: 1, levelCode: "BL" }, 1);
    assert.equal(byCode.band, "BL");
    assert.equal(byCode.id, "bl-cat");
  });

  it("moves up after two correct answers and down after two misses", () => {
    const first = nextAfterAnswer({ band: "WA", index: 0, grade: 1, correctStreak: 0, missStreak: 0 }, true);
    assert.equal(first.move, "stay");
    assert.equal(first.band, "WA");
    assert.equal(first.index, 1);
    assert.equal(first.grade, 1);
    assert.equal(first.correctStreak, 1);
    const up = nextAfterAnswer(first, true);
    assert.equal(up.move, "up");
    assert.equal(up.band, "RH");
    assert.equal(up.index, 0);
    assert.equal(up.grade, 1);
    assert.equal(up.correctStreak, 0);
    const miss = nextAfterAnswer({ band: "IS", index: 4, grade: 5, correctStreak: 1, missStreak: 0 }, false);
    assert.equal(miss.move, "stay");
    assert.equal(miss.band, "IS");
    assert.equal(miss.index, 5);
    assert.equal(miss.correctStreak, 0);
    assert.equal(miss.missStreak, 1);
    assert.equal(miss.grade, 5);
    const down = nextAfterAnswer(miss, false);
    assert.equal(down.move, "down");
    assert.equal(down.band, "OR");
    assert.equal(down.index, 0);
    assert.equal(down.grade, 5);
    const floor = nextAfterAnswer({ band: "WA", index: 2, grade: 1, correctStreak: 0, missStreak: 1 }, false);
    assert.equal(floor.move, "stay");
    assert.equal(floor.band, "WA");
    assert.equal(floor.index, 3);
    assert.equal(floor.missStreak, 0);
    const cap = nextAfterAnswer({ band: "PD", index: 6, grade: 4, correctStreak: 1, missStreak: 0 }, true);
    assert.equal(cap.move, "stay");
    assert.equal(cap.band, "PD");
    assert.equal(cap.index, 7);
    assert.equal(cap.grade, 4);
    assert.equal(cap.correctStreak, 0);
  });
});

describe("spoken phonemic answers", () => {
  it("accepts the answer, the also list, phoneme sounds, and a rhyme that is not the cue", () => {
    const count = itemAt("WA", 0);
    assert.equal(paSpokenMatches(count, "Three"), true);
    assert.equal(paSpokenMatches(count, "3"), true);
    assert.equal(paSpokenMatches(count, "four"), false);
    const rhyme = itemAt("RH", 0);
    assert.equal(paSpokenMatches(rhyme, "yeah"), true);
    assert.equal(paSpokenMatches(rhyme, "no"), false);
    const make = itemAt("RH", 4);
    assert.equal(paSpokenMatches(make, "hat"), true);
    assert.equal(paSpokenMatches(make, "splat"), true);
    assert.equal(paSpokenMatches(make, "cat"), false);
    const first = itemAt("IS", 0);
    assert.equal(paSpokenMatches(first, "sss"), true);
    assert.equal(paSpokenMatches(first, "s"), true);
    assert.equal(paSpokenMatches(first, "sun"), false);
    const segment = itemAt("PS", 0);
    assert.equal(paSpokenMatches(segment, "kuh aeh tuh"), true);
    assert.equal(paSpokenMatches(segment, "cuh ae t"), true);
    assert.equal(paSpokenMatches(segment, "cat"), false);
    assert.equal(judgePaSpoken(count, "", true), "miss");
    assert.equal(judgePaSpoken(count, "th", false), "wait");
    assert.equal(judgePaSpoken(count, "three", false), "correct");
    assert.equal(judgePaSpoken(count, "four", true), "miss");
  });
});

describe("level.pa", () => {
  it("reads and writes only this account's phonemic band", () => {
    const parsed = parseSchoolProfile({
      family: {
        email: "ada@family.test",
        access: "open",
        student: { name: "Ada" },
        level: {
          pa: {
            id: "pa-ada",
            name: "Ada",
            enteredBy: "parent",
            grade: 1,
            band: "WA",
            index: 1,
            word: "wa-see-dog",
            streak: 1,
            missStreak: 0,
            reached: 2,
            missed: 1,
            earnedGrade: 1,
            levelCode: "WA",
            levelLabel: "Pre-K",
          },
        },
      },
    });
    const pa = parsed?.profile.level.pa;
    assert.equal(parsed?.id, "ada@family.test");
    assert.equal(pa?.band, "WA");
    assert.equal(pa?.index, 1);
    assert.equal(pa?.word, "wa-see-dog");
    assert.equal(pa?.grade, 1);
    assert.equal(pa?.step, 0);
    assert.equal(pa?.streak, 1);
    assert.equal(pa?.id, "pa-ada");
    const written = paAccountLevel(pa, {
      name: "Ada",
      grade: 1,
      band: "RH",
      index: 0,
      word: "rh-cat-hat",
      earnedGrade: 1,
      reached: 3,
      missed: 1,
      streak: 0,
      missStreak: 0,
      startingGrade: 1,
      updatedAt: 10,
    });
    assert.equal(written.band, "RH");
    assert.equal(written.word, "rh-cat-hat");
    assert.equal(written.levelCode, "RH");
    assert.equal(written.levelLabel, "K");
    assert.equal(written.grade, 1);
    assert.equal(written.step, 0);
    const body = schoolWriteBody({ pa: written }, 0, 0, []);
    assert.equal(body.levels.pa?.band, "RH");
    assert.equal("sw" in body.levels, false);
    assert.equal(JSON.stringify(body).includes("bea@other.test"), false);
  });

  it("lets age 4 win, and a saved band win over age", () => {
    const byGrade = parseSchoolProfile({
      family: {
        email: "ada@family.test", level: { pa: 1 } },
    });
    assert.equal(byGrade?.profile.level.pa?.band, "IS");
    assert.equal(byGrade?.profile.level.pa?.word, "is-first-sun");
    const older = parseSchoolProfile({
      family: {
        email: "ada@family.test", level: { pa: { grade: 4, age: 4 } } },
    });
    assert.equal(older?.profile.level.pa?.band, "WA");
    assert.equal(older?.profile.level.pa?.grade, 4);
    const kept = parseSchoolProfile({
      family: {
        email: "ada@family.test", level: { pa: { grade: 2, age: 4, band: "PD", index: 4 } } },
    });
    assert.equal(kept?.profile.level.pa?.band, "PD");
    assert.equal(kept?.profile.level.pa?.word, "pd-sub-hat");
  });

  it("does not put another family's name or email in this child's letter", () => {
    const letter = academicLetter({
      firstName: "Ada",
      age: 4,
      subject: "pa",
      level: 1,
      standardCode: "WA",
      standardLabel: "Word awareness",
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
            question: "How many words do you hear? The cat sat.",
            answer: "heard",
            note: "Heard.",
            correct: true,
            code: "WA",
            label: "Word awareness",
          }),
        },
      ],
    });
    assert.equal(letter.recipient, "ada@family.test");
    assert.equal(letter.body.includes("bea@other.test"), false);
    assert.equal(letter.body.includes("Bea"), false);
    assert.match(letter.body, /Word awareness/);
    assert.equal(letter.body.includes("Common Core"), false);
    const logout = parentLogoutLetter({
      parentName: "Ada Parent",
      parentEmail: "ada@family.test",
      children: [{ firstName: "Ada", apps: [{ subject: "pa", level: 1, earnedLevel: 1, onlineSeconds: 12, loggedIn: true }] }],
    });
    assert.equal(logout.recipient, "ada@family.test");
    assert.match(logout.body, /VKOLE\/PA/);
    assert.equal(logout.body.includes("bea@other.test"), false);
    assert.equal(logout.body.includes("Bea"), false);
  });
});
