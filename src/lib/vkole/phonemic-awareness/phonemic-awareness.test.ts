import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
  bandMeta,
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
    assert.equal(createHash("sha256").update(app).digest("hex"), createHash("sha256").update(doc).digest("hex"));
    const items = lists.bands.reduce((total, band) => total + band.items.length, 0);
    assert.equal(lists.bands.length, 88);
    assert.equal(items, 526);
    assert.equal(PA_BANDS.length, 88);
  });

  it("keeps the 88 levels, timings, and round size from that file", () => {
    assert.equal(PA_ENGINE, "pa");
    assert.deepEqual(
      canonicalBands().map((band) => band.id),
      lists.bands.map((band) => band.id),
    );
    assert.equal(PA_BANDS[0], "WA");
    assert.equal(PA_BANDS[1], "RH");
    assert.equal(PA_BANDS[2], "SY");
    assert.equal(PA_BANDS[3], "OR");
    assert.equal(PA_BANDS[4], "c-b");
    assert.equal(PA_BANDS.at(-1), "PD");
    assert.equal(PA_ADVANCE_MS, 2000);
    assert.equal(PA_MAX_SHOW_MS, 20000);
    assert.equal(PA_RISE_AFTER, 2);
    assert.equal(PA_DROP_AFTER, 2);
    assert.equal(PA_ROUND_SIZE, 5);
    assert.equal(lists.placement.byAge["4"], "WA");
    assert.equal(lists.placement.byAge["5"], "RH");
    assert.equal(lists.placement.byGrade["1"], "c-b");
    assert.equal(lists.placement.byGrade["2"], "PD");
    assert.equal(lists.placement.older, "PD");
    assert.equal(lists.legacyBands.IS, "c-b");
    assert.equal(lists.legacyBands.BL, "b-bl");
    assert.equal(lists.legacyBands.PS, "w-ai");
    const counts = new Map<number, number>();
    for (const band of canonicalBands()) counts.set(band.count, (counts.get(band.count) ?? 0) + 1);
    assert.equal(counts.get(8), 5);
    assert.equal(counts.get(6), 79);
    assert.equal(counts.get(3), 4);
    assert.equal(canonicalBands()[0]?.name, "Word awareness");
    assert.equal(canonicalBands()[0]?.grade, "Pre-K");
    assert.equal(canonicalBands()[0]?.first, "wa-cat-sat");
    assert.equal(canonicalBands().at(-1)?.name, "Phoneme deletion and substitution");
    assert.equal(canonicalBands().at(-1)?.grade, "2nd");
    assert.equal(canonicalBands().at(-1)?.last, "pd-sub-log");
    assert.equal(itemAt("c-c", 2).boxes, 3);
    assert.equal(engineNavLabel("pa"), "VKOLE/Phonemic Awareness ZPD");
    assert.equal(enginePickLabel("pa"), "Phonemic Awareness ZPD");
  });
});

describe("phonemic placement and movement", () => {
  it("starts from age before grade, and keeps a saved band", () => {
    assert.equal(startBand({ age: 4, grade: 2 }), "WA");
    assert.equal(startBand({ age: 5, grade: 1 }), "RH");
    assert.equal(startBand({ age: 6, grade: 1 }), "c-b");
    assert.equal(startBand({ grade: 1 }), "c-b");
    assert.equal(startCard(1).id, "c-b-bat-iso");
    assert.equal(startBand({ grade: 2 }), "PD");
    assert.equal(startBand({ age: 12, grade: 8 }), "PD");
    assert.equal(startBand({ grade: 0 }), "WA");
    assert.equal(startCard(1, 4).id, "wa-cat-sat");
    assert.equal(startCard(1, 4).grade, 1);
    const saved = cardFromAccount({ grade: 2, age: 4, band: "w-ai", index: 3 }, 2);
    assert.equal(saved.band, "w-ai");
    assert.equal(saved.index, 3);
    assert.equal(saved.id, "w-ai-train-iso");
    assert.equal(saved.grade, 2);
    const byCode = cardFromAccount({ grade: 1, levelCode: "b-bl" }, 1);
    assert.equal(byCode.band, "b-bl");
    assert.equal(byCode.id, "b-bl-blue-iso");
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
    const miss = nextAfterAnswer({ band: "c-b", index: 4, grade: 5, correctStreak: 1, missStreak: 0 }, false);
    assert.equal(miss.move, "stay");
    assert.equal(miss.band, "c-b");
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
    const first = itemAt("c-s", 0);
    assert.equal(first.id, "c-s-sun-iso");
    assert.equal(paSpokenMatches(first, "sss"), true);
    assert.equal(paSpokenMatches(first, "s"), true);
    assert.equal(paSpokenMatches(first, "sun"), false);
    const segment = itemAt("c-c", 2);
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
    const segment = itemAt("c-c", 2);
    assert.equal(segment.id, "c-c-cat-seg");
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
  it("accepts a stretched n and the new phoneme spellings, and rejects a different sound", () => {
    const last = itemAt("c-n", 0);
    assert.equal(last.id, "c-n-net-iso");
    assert.equal(last.answer, "nnn");
    for (const heard of ["n", "nn", "nnn", "nnnn", "en", "nuh", "net nn", "net nuh", "netn"]) {
      assert.equal(judgePaSpoken(last, heard, true), "correct", heard);
    }
    for (const heard of ["m", "mm", "mmm", "em", "muh", "net", "net m", "ess", "ng"]) {
      assert.equal(judgePaSpoken(last, heard, true), "miss", heard);
    }
    const sh = itemAt("d-sh", 0);
    assert.equal(judgePaSpoken(sh, "sh", true), "correct");
    assert.equal(judgePaSpoken(sh, "shh", true), "correct");
    assert.equal(judgePaSpoken(sh, "shhhh", true), "correct");
    assert.equal(judgePaSpoken(sh, "ch", true), "miss");
    const ch = itemAt("d-ch", 0);
    assert.equal(judgePaSpoken(ch, "ch", true), "correct");
    assert.equal(judgePaSpoken(ch, "chh", true), "correct");
    assert.equal(judgePaSpoken(ch, "th", true), "miss");
    const th = itemAt("d-th", 0);
    assert.equal(judgePaSpoken(th, "th", true), "correct");
    assert.equal(judgePaSpoken(th, "thh", true), "correct");
    assert.equal(judgePaSpoken(th, "t", true), "miss");
    const kw = itemAt("c-q", 0);
    assert.equal(judgePaSpoken(kw, "kw", true), "correct");
    assert.equal(judgePaSpoken(kw, "qu", true), "correct");
    assert.equal(judgePaSpoken(kw, "q", true), "correct");
    assert.equal(judgePaSpoken(kw, "k", true), "miss");
    const ks = itemAt("c-x", 0);
    assert.equal(judgePaSpoken(ks, "ks", true), "correct");
    assert.equal(judgePaSpoken(ks, "x", true), "correct");
    assert.equal(judgePaSpoken(ks, "s", true), "miss");
    const ng = itemAt("d-ng", 0);
    assert.equal(judgePaSpoken(ng, "ng", true), "correct");
    assert.equal(judgePaSpoken(ng, "ngh", true), "correct");
    assert.equal(judgePaSpoken(ng, "n", true), "miss");
    const ar = itemAt("r-ar", 0);
    assert.equal(judgePaSpoken(ar, "ar", true), "correct");
    assert.equal(judgePaSpoken(ar, "arrr", true), "correct");
    assert.equal(judgePaSpoken(ar, "r", true), "miss");
    const er = itemAt("r-er", 0);
    assert.equal(judgePaSpoken(er, "er", true), "correct");
    assert.equal(judgePaSpoken(er, "ir", true), "correct");
    assert.equal(judgePaSpoken(er, "ur", true), "correct");
    assert.equal(judgePaSpoken(er, "r", true), "miss");
    const or = itemAt("r-or", 0);
    assert.equal(judgePaSpoken(or, "or", true), "correct");
    assert.equal(judgePaSpoken(or, "o", true), "miss");
    const ee = itemAt("w-ee", 0);
    assert.equal(judgePaSpoken(ee, "ee", true), "correct");
    assert.equal(judgePaSpoken(ee, "eee", true), "correct");
    assert.equal(judgePaSpoken(ee, "ea", true), "correct");
    assert.equal(judgePaSpoken(ee, "e", true), "miss");
    const oo = itemAt("w-oo-long", 0);
    assert.equal(judgePaSpoken(oo, "oo", true), "correct");
    assert.equal(judgePaSpoken(oo, "ooo", true), "correct");
    assert.equal(judgePaSpoken(oo, "ooh", true), "correct");
    assert.equal(judgePaSpoken(oo, "o", true), "miss");
    const ow = itemAt("w-ow", 0);
    assert.equal(judgePaSpoken(ow, "ow", true), "correct");
    assert.equal(judgePaSpoken(ow, "ou", true), "correct");
    assert.equal(judgePaSpoken(ow, "o", true), "miss");
    const book = itemAt("w-oo-short", 0);
    assert.equal(judgePaSpoken(book, "uu", true), "correct");
    assert.equal(judgePaSpoken(book, "u", true), "miss");
    assert.equal(judgePaSpoken(book, "oo", true), "miss");
  });

  it("grades every canonical answer correct", () => {
    let total = 0;
    for (const band of PA_BANDS) {
      const count = bandMeta(band).count;
      for (let index = 0; index < count; index += 1) {
        const item = itemAt(band, index);
        assert.equal(judgePaSpoken(item, item.answer, true), "correct", item.id);
        total += 1;
      }
    }
    assert.equal(total, 526);
  });

  it("walks all 88 levels in order when every answer is correct", () => {
    let state = { band: PA_BANDS[0] ?? "WA", index: 0, grade: 1, correctStreak: 0, missStreak: 0 };
    const seen: string[] = [];
    for (let n = 0; n < 400 && seen.length < PA_BANDS.length; n += 1) {
      const card = itemAt(state.band, state.index);
      assert.equal(judgePaSpoken(card, card.answer, true), "correct", card.id);
      if (seen[seen.length - 1] !== state.band) seen.push(state.band);
      const next = nextAfterAnswer(state, true);
      assert.equal(next.grade, 1);
      state = {
        band: next.band,
        index: next.index,
        grade: next.grade,
        correctStreak: next.correctStreak,
        missStreak: next.missStreak,
      };
    }
    assert.deepEqual(seen, [...PA_BANDS]);
    assert.equal(new Set(seen).size, 88);
    assert.equal(state.band, "PD");
  });

  it("cycles every item in a 6-item level and in a 3-item level before repeating", () => {
    for (const band of ["c-b", "w-ow"] as const) {
      const count = bandMeta(band).count;
      let state = { band, index: 0, grade: 1, correctStreak: 0, missStreak: 0 };
      const ids: string[] = [];
      for (let n = 0; n < count; n += 1) {
        ids.push(itemAt(state.band, state.index).id);
        const next = nextAfterAnswer(state, n % 2 === 0);
        assert.equal(next.band, band);
        assert.equal(next.move, "stay");
        state = {
          band: next.band,
          index: next.index,
          grade: next.grade,
          correctStreak: next.correctStreak,
          missStreak: next.missStreak,
        };
      }
      assert.equal(new Set(ids).size, count);
      assert.equal(itemAt(state.band, state.index).id, ids[0]);
      assert.notDeepEqual(ids.slice(0, 3), ids.slice(3, 6));
    }
    assert.equal(bandMeta("w-ow").count, 3);
    assert.ok(bandMeta("c-b").count > PA_ROUND_SIZE);
  });

  it("maps the old bands and keeps a saved level and index through a reload", () => {
    const fromIs = cardFromAccount({ grade: 1, band: "IS", index: 2 }, 1);
    assert.equal(fromIs.band, "c-b");
    assert.equal(fromIs.index, 2);
    assert.equal(fromIs.id, "c-b-bat-seg");
    const fromBl = cardFromAccount({ grade: 1, levelCode: "BL", index: 1 }, 1);
    assert.equal(fromBl.band, "b-bl");
    assert.equal(fromBl.index, 1);
    assert.equal(fromBl.id, "b-bl-blue-blend");
    const fromPs = cardFromAccount({ grade: 1, band: "PS", index: 4 }, 1);
    assert.equal(fromPs.band, "w-ai");
    assert.equal(fromPs.index, 4);
    assert.equal(fromPs.id, "w-ai-train-blend");
    const heard = judgePaSpoken(itemAt("d-sh", 3), itemAt("d-sh", 3).answer, true);
    assert.equal(heard, "correct");
    const moved = nextAfterAnswer({ band: "d-sh", index: 3, grade: 1, correctStreak: 0, missStreak: 0 }, true);
    assert.equal(moved.band, "d-sh");
    assert.equal(moved.index, 4);
    assert.equal(moved.correctStreak, 1);
    const card = cardFromAccount(
      { grade: 1, band: moved.band, index: moved.index, word: itemAt(moved.band, moved.index).say },
      1,
    );
    assert.equal(card.index, 4);
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
    const reloaded = parseSchoolProfile({ family: { email: "ada@family.test", level: body.levels } });
    const pa = reloaded?.profile.level.pa;
    assert.equal(pa?.band, "d-sh");
    assert.equal(pa?.index, 4);
    assert.equal(pa?.word, card.id);
    assert.equal(pa?.streak, 1);
    assert.equal(pa?.missStreak, 0);
    const again = cardFromAccount({ grade: 1, band: pa?.band, index: pa?.index, word: pa?.word }, 1);
    assert.equal(again.band, "d-sh");
    assert.equal(again.index, 4);
    const legacy = parseSchoolProfile({
      family: { email: "ada@family.test", level: { pa: { grade: 1, band: "PS", index: 4, streak: 1, missStreak: 0 } } },
    });
    assert.equal(legacy?.profile.level.pa?.band, "w-ai");
    assert.equal(legacy?.profile.level.pa?.index, 4);
    assert.equal(legacy?.profile.level.pa?.streak, 1);
  });
});

describe("automatic advance and drop", () => {
  it("moves to the next item on one right answer and rises on the second", () => {
    const firstHeard = judgePaSpoken(itemAt("c-c", 2), "c-a-t", true);
    assert.equal(firstHeard, "correct");
    const stayed = nextAfterAnswer({ band: "c-c", index: 4, grade: 1, correctStreak: 0, missStreak: 0 }, true);
    assert.equal(stayed.move, "stay");
    assert.equal(stayed.band, "c-c");
    assert.equal(stayed.index, 5);
    assert.equal(stayed.correctStreak, 1);
    assert.equal(judgePaSpoken(itemAt("c-c", stayed.index), itemAt("c-c", stayed.index).answer, true), "correct");
    const rose = nextAfterAnswer(stayed, true);
    assert.equal(rose.move, "up");
    assert.equal(rose.band, "c-d");
    assert.equal(rose.index, 0);
    assert.equal(rose.correctStreak, 0);
    assert.equal(rose.grade, 1);
  });

  it("treats a wrong answer and a timeout as a miss, and drops on the second", () => {
    const wrong = judgePaSpoken(itemAt("c-b", 1), "dog", true);
    assert.equal(wrong, "miss");
    const stayed = nextAfterAnswer({ band: "c-b", index: 1, grade: 2, correctStreak: 1, missStreak: 0 }, false);
    assert.equal(stayed.move, "stay");
    assert.equal(stayed.band, "c-b");
    assert.equal(stayed.index, 2);
    assert.equal(stayed.correctStreak, 0);
    assert.equal(stayed.missStreak, 1);
    const dropped = nextAfterAnswer(stayed, false);
    assert.equal(dropped.move, "down");
    assert.equal(dropped.band, "OR");
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
    assert.equal(byGrade?.profile.level.pa?.band, "c-b");
    assert.equal(byGrade?.profile.level.pa?.word, "c-b-bat-iso");
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
