import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { AGREED_VERSION, VEKOLE_SETTINGS } from "@kirkpatrick/vekole-engine";
import { cycleInstruction } from "./vkole-cycle.ts";
import {
  CONNECTED_ENGINE,
  chooseNextServe,
  chooseSightNext,
  cleanTypedAnswer,
  freshEngineSession,
  scoreEngineItem,
  scoreSightWord,
  sightListAdvances,
  sightServeHoldsPlace,
  nextSightPlace,
  type ItemMemory,
} from "./engine-connect.ts";

const NOW = new Date("2026-11-17T20:00:00.000Z");

function memory(itemKey: string, strengthDays: number, daysAgo: number): ItemMemory {
  return {
    itemKey,
    strengthDays,
    lastPracticedAt: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
    reviews: 1,
    misses: 0,
  };
}

describe("connected engine", () => {
  it("pins the shared package at v0.2.4", () => {
    assert.equal(CONNECTED_ENGINE, "v0.2.4");
    assert.equal(AGREED_VERSION, "v0.2.4");
    assert.equal(VEKOLE_SETTINGS.answerLimit, 500);
    assert.equal(VEKOLE_SETTINGS.spiralGapItems, 3);
    assert.equal(VEKOLE_SETTINGS.spiralMaxReturns, 2);
    assert.equal(VEKOLE_SETTINGS.recognitionAlternatives, 5);
    const installed = readFileSync(new URL("../../node_modules/@kirkpatrick/vekole-engine/package.json", import.meta.url), "utf8");
    assert.match(installed, /"version": "0.2.4"/);
  });

  it("removes personal details before a typed answer can be sent, and leaves ordinary answers", () => {
    assert.equal(cleanTypedAnswer("my email is sam@example.com"), "my email is [removed]");
    assert.equal(cleanTypedAnswer("call 510-555-1234"), "call [removed]");
    assert.equal(cleanTypedAnswer("I live at 123 Main Street"), "I live at [removed]");
    assert.equal(cleanTypedAnswer("12 Oak Ave"), "[removed]");
    assert.equal(cleanTypedAnswer("He drove 60 miles down the road."), "He drove 60 miles down the road.");
    assert.equal(cleanTypedAnswer("The answer is 3 because we place the decimal."), "The answer is 3 because we place the decimal.");
    assert.equal(cleanTypedAnswer("Add 10 the same way."), "Add 10 the same way.");
    assert.equal(cleanTypedAnswer("I counted 5 cars on the street."), "I counted 5 cars on the street.");
    assert.equal(cleanTypedAnswer("456-1234 = -778"), "456-1234 = -778");
    assert.equal(cleanTypedAnswer("12 x 4 = 48"), "12 x 4 = 48");
    const instruction = cycleInstruction({
      subject: "m",
      startGrade: 3,
      grade: 3,
      code: "3.OA.1",
      label: "Multiply",
      correctStreak: 0,
      incorrectStreak: 0,
      question: "What is 3 x 4?",
      answer: "my email is sam@example.com and I live at 123 Main Street",
    });
    assert.equal(instruction.includes("sam@example.com"), false);
    assert.equal(instruction.includes("123 Main Street"), false);
    assert.match(instruction, /\[removed\]/);
  });

  it("starts memory on the first correct answer and does not move the level for a review", () => {
    const first = scoreEngineItem({
      session: freshEngineSession(NOW),
      records: [],
      itemKey: "m:3:0:1",
      correct: true,
      elapsedMs: 4000,
      now: NOW,
      engine: "m",
    });
    assert.equal(first.holdLevel, false);
    assert.equal(first.records[0]?.strengthDays, 4.5);
    const due = memory("m:3:0:1", 4.5, 3);
    const review = scoreEngineItem({
      session: { ...freshEngineSession(NOW), serveKind: "review", serveItem: due.itemKey },
      records: [due],
      itemKey: due.itemKey,
      correct: true,
      elapsedMs: 4000,
      now: NOW,
      engine: "m",
    });
    assert.equal(review.holdLevel, true);
    assert.ok(review.records[0]!.strengthDays > 4.5);
  });

  it("mixes at most one review per four items and skips reviews while fatigue is high", () => {
    const records = [memory("m:3:0:1", 4.5, 3)];
    const open = chooseNextServe({
      session: { ...freshEngineSession(NOW), itemsSinceMixed: VEKOLE_SETTINGS.reviewEvery - 1, reviewsServed: 0 },
      records,
      now: NOW,
      subject: "m",
    });
    assert.equal(open.itemKey, "m:3:0:1");
    assert.equal(open.session.serveKind, "review");
    const closed = chooseNextServe({
      session: { ...freshEngineSession(NOW), itemsServed: 40, itemsSinceMixed: 0, reviewsServed: 0 },
      records,
      now: NOW,
      subject: "m",
    });
    assert.equal(closed.itemKey, null);
    const tired = chooseNextServe({
      session: {
        ...freshEngineSession(NOW),
        itemsServed: 3,
        reviewsServed: 0,
        fatigue: { timesMs: [1000, 1000, 1000, 1000, 1000], high: true, missStreak: 0, normalStreak: 0 },
      },
      records,
      now: NOW,
      subject: "m",
    });
    assert.equal(tired.itemKey, null);
  });

  it("stays on a sight-word list at 69% and moves at 70%", () => {
    assert.equal(VEKOLE_SETTINGS.sightWordsListRule, 0.7);
    assert.equal(sightListAdvances(69, 100), false);
    assert.equal(sightListAdvances(70, 100), true);
    const source = readFileSync(new URL("./engine-connect.ts", import.meta.url), "utf8");
    const start = source.indexOf("export function sightListAdvances");
    const end = source.indexOf("export function sightItemKey");
    const fn = source.slice(start, end);
    assert.equal(fn.includes("0.7"), false);
    assert.match(fn, /sightWordsListRule/);
    const missed = scoreSightWord({
      session: freshEngineSession(NOW),
      records: [],
      itemKey: "sw:D-1:2",
      correct: false,
      elapsedMs: 4000,
      now: NOW,
      });
    assert.equal(missed.records[0]?.known, false);
    assert.deepEqual(missed.session.learnedThisSession, []);
    const later = new Date(NOW.getTime() + 2 * 86_400_000);
    const review = chooseNextServe({
      session: { ...missed.session, itemsSinceMixed: VEKOLE_SETTINGS.reviewEvery - 1, reviewsServed: 0 },
      records: missed.records,
      now: later,
      subject: "sw",
    });
    assert.equal(review.itemKey, "sw:D-1:2");
    assert.equal(review.session.serveKind, "review");
  });

  it("re-checks only an item first learned in this sitting", () => {
    const learned = scoreEngineItem({
      session: freshEngineSession(NOW),
      records: [],
      itemKey: "m:3:0:4",
      correct: true,
      elapsedMs: 3000,
      now: NOW,
      engine: "m",
    });
    assert.deepEqual(learned.session.learnedThisSession, ["m:3:0:4"]);
    const later = new Date(NOW.getTime() + 11 * 60 * 1000);
    const again = chooseNextServe({
      session: { ...learned.session, itemsServed: 8 },
      records: learned.records,
      now: later,
      subject: "m",
    });
    assert.equal(again.itemKey, "m:3:0:4");
    assert.equal(again.session.serveKind, "recheck");
    const older = memory("m:2:0:1", 4.5, 3);
    const noneLearned = chooseNextServe({
      session: { ...freshEngineSession(NOW), itemsServed: 8, itemsSinceNew: 8, itemsSinceMixed: VEKOLE_SETTINGS.reviewEvery - 1 },
      records: [{ ...older, reviews: 0, misses: 0 }],
      now: NOW,
      subject: "m",
    });
    assert.equal(noneLearned.itemKey, "m:2:0:1");
    assert.equal(noneLearned.session.serveKind, "review");
    const notDue = chooseNextServe({
      session: { ...freshEngineSession(NOW), itemsServed: 8, itemsSinceNew: 8 },
      records: [{ ...memory("m:2:0:1", 4.5, 0), reviews: 0, misses: 0 }],
      now: NOW,
      subject: "m",
    });
    assert.equal(notDue.itemKey, null);
    assert.equal(notDue.session.serveKind, "growth");
    const word = scoreSightWord({
      session: freshEngineSession(NOW),
      records: [],
      itemKey: "sw:D-1:4",
      correct: true,
      elapsedMs: 3000,
      now: NOW,
    });
    assert.deepEqual(word.session.learnedThisSession, ["sw:D-1:4"]);
    const wordAgain = chooseNextServe({
      session: word.session,
      records: word.records,
      now: later,
      subject: "sw",
    });
    assert.equal(wordAgain.itemKey, "sw:D-1:4");
    assert.equal(wordAgain.session.serveKind, "recheck");
    const already = scoreSightWord({
      session: { ...freshEngineSession(NOW), serveKind: "review" },
      records: [{ ...memory("sw:D-1:1", 4.5, 3), known: false }],
      itemKey: "sw:D-1:1",
      correct: true,
      elapsedMs: 3000,
      now: NOW,
    });
    assert.deepEqual(already.session.learnedThisSession, []);
  });

  it("spirals a missed sight word in this sitting, then rests", () => {
    const source = readFileSync(new URL("./engine-connect.ts", import.meta.url), "utf8");
    assert.equal(source.includes("spiralGapItems"), false);
    assert.equal(source.includes("spiralMaxReturns"), false);
    assert.match(source, /chooseSightServe/);
    assert.match(source, /settleSightWord/);
    const planned = Array.from({ length: 18 }, (_, index) => `sw:D-1:${index}`);
    const theKey = planned[4]!;
    let session = freshEngineSession(NOW);
    let records: ItemMemory[] = [];
    const served: { kind: string; key: string; known: boolean }[] = [];
    let plan = 0;
    for (let step = 0; step < 30; step += 1) {
      const choice = chooseSightNext({ session, records, now: NOW });
      let key = choice.itemKey ?? "";
      let correct = true;
      const kind = choice.itemKey ? choice.session.serveKind : "growth";
      if (!choice.itemKey) {
        const next = planned[plan];
        plan += 1;
        if (!next) break;
        key = next;
        correct = next !== theKey;
      } else if (kind === "spiral") {
        correct = false;
      }
      const scored = scoreSightWord({
        session: { ...choice.session, serveKind: kind, serveItem: choice.itemKey ?? "" },
        records,
        itemKey: key,
        correct,
        elapsedMs: 1000,
        now: NOW,
      });
      session = scored.session;
      records = scored.records;
      served.push({ kind, key, known: scored.records.find((row) => row.itemKey === key)?.known === true });
    }
    assert.equal(served[4]?.key, theKey);
    assert.equal(served[4]?.kind, "growth");
    assert.equal(served[8]?.key, theKey);
    assert.equal(served[8]?.kind, "spiral");
    assert.equal(served[12]?.key, theKey);
    assert.equal(served[12]?.kind, "spiral");
    assert.equal(served.slice(13).some((item) => item.key === theKey), false);
    assert.equal(sightServeHoldsPlace("spiral"), true);
    assert.equal(sightServeHoldsPlace("growth"), false);
    const skipped = nextSightPlace({
      band: "D-1",
      index: 0,
      listSize: 5,
      known: 0,
      bands: ["D-1"],
      unknown: new Set([1, 2]),
      blocked: new Set([1]),
    });
    assert.equal(skipped.index, 2);
    const onlyBlocked = nextSightPlace({
      band: "D-1",
      index: 0,
      listSize: 5,
      known: 0,
      bands: ["D-1"],
      unknown: new Set([1]),
      blocked: new Set([1]),
    });
    assert.notEqual(onlyBlocked.index, 1);
    for (let index = 0; index + 4 <= served.length; index += 1) {
      const mixed = served.slice(index, index + 4).filter((item) => item.kind === "spiral" || item.kind === "review").length;
      assert.ok(mixed <= 1);
    }
    assert.equal(records.find((row) => row.itemKey === theKey)?.strengthDays, 1);

    session = freshEngineSession(NOW);
    records = [];
    plan = 0;
    const correctServed: { kind: string; key: string }[] = [];
    for (let step = 0; step < 16; step += 1) {
      const choice = chooseSightNext({ session, records, now: NOW });
      let key = choice.itemKey ?? "";
      let correct = true;
      const kind = choice.itemKey ? choice.session.serveKind : "growth";
      if (!choice.itemKey) {
        const next = planned[plan];
        plan += 1;
        if (!next) break;
        key = next;
        correct = next !== theKey;
      }
      const before = records.find((row) => row.itemKey === key);
      const scored = scoreSightWord({
        session: { ...choice.session, serveKind: kind, serveItem: choice.itemKey ?? "" },
        records,
        itemKey: key,
        correct,
        elapsedMs: 1000,
        now: NOW,
      });
      session = scored.session;
      records = scored.records;
      correctServed.push({ kind, key });
      if (kind === "spiral") {
        const row = scored.records.find((item) => item.itemKey === theKey);
        assert.equal(row?.known, true);
        assert.equal(row?.strengthDays, 1.8);
        assert.equal(row?.lastPracticedAt, before?.lastPracticedAt);
        assert.equal(sightServeHoldsPlace(kind), true);
      }
    }
    assert.equal(correctServed[8]?.kind, "spiral");
    assert.equal(correctServed.slice(9).some((item) => item.key === theKey), false);
    const knownBefore = 6;
    const knownAfter = knownBefore + 1;
    assert.equal(knownBefore / 10 >= VEKOLE_SETTINGS.sightWordsListRule, false);
    assert.equal(knownAfter / 10 >= VEKOLE_SETTINGS.sightWordsListRule, true);

    const paused = chooseSightNext({
      session: {
        ...freshEngineSession(NOW),
        itemsServed: 8,
        fatigue: { timesMs: [1000, 1000, 1000, 1000, 1000], high: true, missStreak: 0, normalStreak: 0 },
        spirals: [{ itemKey: theKey, newWords: VEKOLE_SETTINGS.spiralGapItems, returns: 0, waiting: true }],
      },
      records,
      now: NOW,
    });
    assert.equal(paused.itemKey, null);
    assert.equal(paused.session.serveKind, "growth");
  });
});
