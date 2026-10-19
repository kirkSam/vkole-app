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
    assert.equal(paSpokenMatches(segment, "k"), false);
    assert.equal(paSpokenMatches(segment, "cat"), false);
    assert.equal(judgePaSpoken(count, "", false), "wait");
    assert.equal(judgePaSpoken(count, "", true), "miss");
    assert.equal(judgePaSpoken(count, "th", false), "wait");
    assert.equal(judgePaSpoken(count, "three", false), "correct");
    assert.equal(judgePaSpoken(count, "four", true), "miss");
  });

  it("accepts case, punctuation, /k/ variants, and a hyphenated c-a-t", () => {
    const segment = itemAt("PS", 0);
    assert.equal(segment.sounds.join(" "), "k a t");
    assert.equal(paSpokenMatches(segment, "kuh"), false);
    assert.equal(paSpokenMatches(segment, "KUH AEH TUH"), true);
    assert.equal(paSpokenMatches(segment, "Kuh. Aeh. Tuh!"), true);
    assert.equal(paSpokenMatches(segment, "k, kuh, aeh, tuh"), true);
    assert.equal(paSpokenMatches(segment, "c-a-t"), true);
    assert.equal(paSpokenMatches(segment, "C-A-T"), true);
    assert.equal(judgePaSpoken(segment, "c-a-t", false), "correct");
    assert.equal(judgePaSpoken(segment, "cat", true), "miss");
    assert.equal(judgePaSpoken(segment, "", false), "wait");
  });
});

describe("stretched sounds and a full-bank run", () => {
  it("accepts nn for the last sound in sun and rejects a different sound", () => {
    const last = itemAt("IS", 1);
    assert.equal(last.id, "is-last-sun");
    assert.equal(last.answer, "nnn");
    for (const heard of ["n", "nn", "nnn", "nnnn", "en", "nuh", "sun nn", "sun nuh", "sunn"]) {
      assert.equal(judgePaSpoken(last, heard, true), "correct", heard);
    }
    for (const heard of ["m", "mm", "mmm", "em", "muh", "sun", "sun m", "sun muh", "ess"]) {
      assert.equal(judgePaSpoken(last, heard, true), "miss", heard);
    }
    const first = itemAt("IS", 0);
    assert.equal(judgePaSpoken(first, "ss", true), "correct");
    assert.equal(judgePaSpoken(first, "ess", true), "correct");
    assert.equal(judgePaSpoken(first, "suh", true), "correct");
    assert.equal(judgePaSpoken(first, "sun s", true), "correct");
    assert.equal(judgePaSpoken(first, "en", true), "miss");
    assert.equal(judgePaSpoken(first, "sun", true), "miss");
    const onset = itemAt("OR", 4);
    assert.equal(onset.kind, "onset-isolate");
    assert.equal(judgePaSpoken(onset, "ss", true), "correct");
    assert.equal(judgePaSpoken(onset, "nn", true), "miss");
    const rime = itemAt("OR", 6);
    assert.equal(rime.kind, "rime-say");
    assert.equal(judgePaSpoken(rime, "at", true), "correct");
    assert.equal(judgePaSpoken(rime, "aat", true), "correct");
    assert.equal(judgePaSpoken(rime, "att", true), "correct");
    assert.equal(judgePaSpoken(rime, "cat", true), "miss");
    assert.equal(judgePaSpoken(rime, "un", true), "miss");
    const segment = itemAt("PS", 1);
    assert.equal(segment.id, "ps-sun");
    assert.equal(judgePaSpoken(segment, "ss uh nn", true), "correct");
    assert.equal(judgePaSpoken(segment, "s u n", true), "correct");
    assert.equal(judgePaSpoken(segment, "sss uhhhh nnnn", true), "correct");
    assert.equal(judgePaSpoken(segment, "sun", true), "miss");
    assert.equal(judgePaSpoken(segment, "mmm aeh puh", true), "miss");
    assert.equal(judgePaSpoken(itemAt("PS", 0), "cat", true), "miss");
  });

  it("walks IS, BL, PS, PD when every answer from grade 1 is correct", () => {
    let state = { band: startBand({ grade: 1 }), index: 0, grade: 1, correctStreak: 0, missStreak: 0 };
    assert.equal(state.band, "IS");
    const bands: string[] = [];
    for (let n = 0; n < 8; n += 1) {
      const card = itemAt(state.band, state.index);
      const judged = judgePaSpoken(card, card.answer, true);
      assert.equal(judged, "correct");
      if (!bands.includes(state.band)) bands.push(state.band);
      const next = nextAfterAnswer(state, judged === "correct");
      state = {
        band: next.band,
        index: next.index,
        grade: next.grade,
        correctStreak: next.correctStreak,
        missStreak: next.missStreak,
      };
    }
    assert.deepEqual(bands, ["IS", "BL", "PS", "PD"]);
    assert.equal(state.grade, 1);
    assert.equal(state.band, "PD");
  });

  it("uses all 8 items in a band before any item repeats", () => {
    let state = { band: "IS" as const, index: 0, grade: 1, correctStreak: 0, missStreak: 0 };
    const ids: string[] = [];
    for (let n = 0; n < 8; n += 1) {
      const card = itemAt(state.band, state.index);
      ids.push(card.id);
      const correct = n % 2 === 0;
      const next = nextAfterAnswer(state, correct);
      assert.equal(next.band, "IS");
      assert.equal(next.move, "stay");
      state = {
        band: next.band,
        index: next.index,
        grade: next.grade,
        correctStreak: next.correctStreak,
        missStreak: next.missStreak,
      };
    }
    assert.equal(ids.length, 8);
    assert.equal(new Set(ids).size, 8);
    assert.ok(ids.length > PA_ROUND_SIZE);
    assert.equal(itemAt(state.band, state.index).id, ids[0]);
    const prompts = ids.map((id, index) => `${state.band}:${id}:${index}`);
    assert.notDeepEqual(prompts.slice(0, 3), prompts.slice(3, 6));
  });

  it("keeps a saved band and index through a push and the next pull", () => {
    const heard = judgePaSpoken(itemAt("IS", 0), "sss", true);
    assert.equal(heard, "correct");
    const moved = nextAfterAnswer({ band: "IS", index: 0, grade: 1, correctStreak: 0, missStreak: 0 }, heard === "correct");
    assert.equal(moved.band, "IS");
    assert.equal(moved.index, 1);
    assert.equal(moved.correctStreak, 1);
    assert.equal(moved.missStreak, 0);
    const card = cardFromAccount(
      {
        grade: 1,
        band: moved.band,
        index: moved.index,
        word: itemAt(moved.band, moved.index).say,
      },
      1,
    );
    assert.equal(card.band, "IS");
    assert.equal(card.index, 1);
    assert.equal(card.id, "is-last-sun");
    const pushed = paAccountLevel(undefined, {
      name: "Ada",
      grade: 1,
      band: card.band,
      index: card.index,
      word: card.id,
      earnedGrade: 1,
      reached: 1,
      missed: 0,
      streak: moved.correctStreak,
      missStreak: moved.missStreak,
      updatedAt: 10,
    });
    const body = schoolWriteBody({ pa: pushed }, 0, 0, []);
    const reloaded = parseSchoolProfile({
      family: { email: "ada@family.test", level: body.levels },
    });
    const pa = reloaded?.profile.level.pa;
    assert.equal(pa?.band, "IS");
    assert.equal(pa?.index, 1);
    assert.equal(pa?.word, "is-last-sun");
    assert.equal(pa?.streak, 1);
    assert.equal(pa?.missStreak, 0);
    assert.equal(pa?.step, 0);
    const again = cardFromAccount({ grade: 1, band: pa?.band, index: pa?.index, word: pa?.word }, 1);
    assert.equal(again.band, "IS");
    assert.equal(again.index, 1);
    assert.equal(again.id, "is-last-sun");
    const fromPrompt = parseSchoolProfile({
      family: {
        email: "ada@family.test",
        level: {
          pa: {
            grade: 1,
            band: "IS",
            word: "What is the last sound in sun?",
            streak: 1,
            missStreak: 0,
          },
        },
      },
    });
    assert.equal(fromPrompt?.profile.level.pa?.band, "IS");
    assert.equal(fromPrompt?.profile.level.pa?.index, 1);
    assert.equal(fromPrompt?.profile.level.pa?.word, "is-last-sun");
    const kept = cardFromAccount(
      { grade: 1, band: "PS", index: 5, word: "What is the first sound in sun?" },
      1,
    );
    assert.equal(kept.band, "PS");
    assert.equal(kept.index, 5);
    assert.equal(kept.id, "ps-up");
    const rose = cardFromAccount({ grade: 1, band: "BL", index: 0, word: "bl-cat" }, 1);
    assert.equal(rose.band, "BL");
    assert.equal(rose.index, 0);
    assert.equal(rose.id, "bl-cat");
  });
});

describe("automatic advance and drop", () => {
  it("moves to the next item on one right answer and rises on the second", () => {
    const firstHeard = judgePaSpoken(itemAt("PS", 0), "c-a-t", true);
    assert.equal(firstHeard, "correct");
    const stayed = nextAfterAnswer({ band: "PS", index: 0, grade: 1, correctStreak: 0, missStreak: 0 }, true);
    assert.equal(stayed.move, "stay");
    assert.equal(stayed.band, "PS");
    assert.equal(stayed.index, 1);
    assert.equal(stayed.correctStreak, 1);
    assert.equal(judgePaSpoken(itemAt("PS", stayed.index), "sss uh nnn", true), "correct");
    const rose = nextAfterAnswer(stayed, true);
    assert.equal(rose.move, "up");
    assert.equal(rose.band, "PD");
    assert.equal(rose.index, 0);
    assert.equal(rose.correctStreak, 0);
    assert.equal(rose.grade, 1);
  });

  it("treats a wrong answer and a timeout as a miss, and drops on the second", () => {
    const wrong = judgePaSpoken(itemAt("BL", 1), "dog", true);
    assert.equal(wrong, "miss");
    const stayed = nextAfterAnswer({ band: "BL", index: 1, grade: 2, correctStreak: 1, missStreak: 0 }, false);
    assert.equal(stayed.move, "stay");
    assert.equal(stayed.band, "BL");
    assert.equal(stayed.index, 2);
    assert.equal(stayed.correctStreak, 0);
    assert.equal(stayed.missStreak, 1);
    const dropped = nextAfterAnswer(stayed, false);
    assert.equal(dropped.move, "down");
    assert.equal(dropped.band, "IS");
    assert.equal(dropped.index, 0);
    assert.equal(dropped.missStreak, 0);
    assert.equal(dropped.grade, 2);
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
    const saved = body.levels.pa as Record<string, unknown> | undefined;
    assert.equal(saved?.band, "RH");
    assert.equal(saved?.streak, 0);
    assert.equal(saved?.missStreak, 0);
    assert.equal(saved?.adult, undefined);
    assert.equal(saved?.approved, undefined);
    assert.equal("sw" in body.levels, false);
    assert.equal(JSON.stringify(body).includes("bea@other.test"), false);
    assert.equal(JSON.stringify(body).includes("adult"), false);
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
