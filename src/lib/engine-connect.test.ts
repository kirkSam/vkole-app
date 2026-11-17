import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { AGREED_VERSION } from "@kirkpatrick/vekole-engine";
import { cycleInstruction } from "./vkole-cycle.ts";
import {
  CONNECTED_ENGINE,
  chooseNextServe,
  cleanTypedAnswer,
  freshEngineSession,
  scoreEngineItem,
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
  it("pins the shared package at v0.1.3", () => {
    assert.equal(CONNECTED_ENGINE, "v0.1.3");
    assert.equal(AGREED_VERSION, "v0.1.3");
    const installed = readFileSync(new URL("../../node_modules/@kirkpatrick/vekole-engine/package.json", import.meta.url), "utf8");
    assert.match(installed, /"version": "0.1.3"/);
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
      session: { ...freshEngineSession(NOW), itemsServed: 3, reviewsServed: 0 },
      records,
      now: NOW,
      subject: "m",
    });
    assert.equal(open.itemKey, "m:3:0:1");
    assert.equal(open.session.serveKind, "review");
    const closed = chooseNextServe({
      session: { ...freshEngineSession(NOW), itemsServed: 0, reviewsServed: 0 },
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
});
