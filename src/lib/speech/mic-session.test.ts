import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  MIC_COUNTDOWN_MS,
  MIC_LEAD_MS,
  MIC_TAIL_MS,
  MIC_WINDOW_MS,
  claimRecognizer,
  micAnswer,
  micCountdown,
  planMicStart,
  recognizerIsIdle,
  releaseRecognizer,
  resetRecognizerGate,
} from "./mic-session.ts";

type FakeRecognizer = {
  active: boolean;
  starts: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
  browserOpened: () => void;
  browserEnded: () => void;
};

function fakeRecognizer(): FakeRecognizer {
  const rec: FakeRecognizer = {
    active: false,
    starts: 0,
    onstart: null,
    onend: null,
    start() {
      if (rec.active) throw new Error("InvalidStateError");
      rec.active = true;
      rec.starts += 1;
    },
    abort() {
      if (!rec.active) return;
      rec.active = false;
      rec.onend?.();
    },
    browserOpened() {
      if (!rec.active) throw new Error("not started");
      rec.onstart?.();
    },
    browserEnded() {
      if (!rec.active) return;
      rec.active = false;
      rec.onend?.();
    },
  };
  return rec;
}

type FakeTimer = { id: number; at: number; fn: () => void };

function fakeClock() {
  let now = 0;
  let nextId = 1;
  let timers: FakeTimer[] = [];
  return {
    now: () => now,
    setTimeout(fn: () => void, ms: number) {
      const id = nextId;
      nextId += 1;
      timers.push({ id, at: now + ms, fn });
      return id;
    },
    clearTimeout(id: number) {
      timers = timers.filter((timer) => timer.id !== id);
    },
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const due = timers.filter((timer) => timer.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        timers = timers.filter((timer) => timer.id !== due.id);
        now = due.at;
        due.fn();
      }
      now = end;
    },
    pending: () => timers.length,
  };
}

describe("alphabet microphone window", () => {
  it("uses a 1 second lead, a 5 second countdown, and a 1 second tail", () => {
    assert.equal(MIC_LEAD_MS, 1000);
    assert.equal(MIC_COUNTDOWN_MS, 5000);
    assert.equal(MIC_TAIL_MS, 1000);
    assert.equal(MIC_WINDOW_MS, 7000);

    resetRecognizerGate();
    const rec = fakeRecognizer();
    let openedAt: number | null = null;
    let listening = false;
    rec.onstart = () => {
      listening = true;
      if (openedAt == null) openedAt = 500;
    };
    rec.onend = () => {
      listening = false;
    };

    assert.equal(planMicStart({ speechBusy: true, previousEnded: true }), "wait");
    assert.equal(rec.active, false);
    assert.equal(planMicStart({ speechBusy: false, previousEnded: recognizerIsIdle() }), "start");
    claimRecognizer();
    rec.start();
    assert.equal(rec.starts, 1);
    assert.equal(listening, false);
    assert.deepEqual(micCountdown(openedAt, 500), { showCountdown: false, seconds: null, close: false });

    rec.browserOpened();
    assert.equal(listening, true);
    assert.equal(openedAt, 500);
    assert.equal(micCountdown(openedAt, 500 + MIC_LEAD_MS - 1).showCountdown, false);
    assert.equal(micCountdown(openedAt, 500 + MIC_LEAD_MS).seconds, 5);
    assert.equal(micCountdown(openedAt, 500 + MIC_LEAD_MS + 999).seconds, 5);
    assert.equal(micCountdown(openedAt, 500 + MIC_LEAD_MS + 1000).seconds, 4);
    assert.equal(micCountdown(openedAt, 500 + MIC_LEAD_MS + MIC_COUNTDOWN_MS).seconds, 0);
    assert.equal(micCountdown(openedAt, 500 + MIC_LEAD_MS + MIC_COUNTDOWN_MS).close, false);
    assert.equal(micCountdown(openedAt, 500 + MIC_WINDOW_MS - 1).seconds, 0);
    assert.equal(micCountdown(openedAt, 500 + MIC_WINDOW_MS - 1).close, false);
    assert.equal(listening, true);
    assert.equal(micCountdown(openedAt, 500 + MIC_WINDOW_MS).close, true);

    assert.equal(micAnswer("again"), "keep");
    assert.equal(micAnswer("wait"), "keep");
    assert.equal(openedAt, 500);
    assert.equal(rec.active, true);
    assert.equal(micAnswer("correct"), "advance");
    assert.equal(micAnswer("miss"), "retry");
  });

  it("drops the old close timer when a wrong answer starts the next letter", () => {
    resetRecognizerGate();
    const clock = fakeClock();
    const first = fakeRecognizer();
    const closes: string[] = [];
    let openedAt: number | null = null;
    let listening = false;
    let closeTimer = 0;
    let serial = 0;

    const arm = (at: number) => {
      openedAt = at;
      clock.clearTimeout(closeTimer);
      closeTimer = clock.setTimeout(() => {
        closes.push(`close-${at}`);
        listening = false;
        first.active = false;
      }, MIC_WINDOW_MS);
    };

    first.onstart = () => {
      listening = true;
      if (openedAt == null) arm(clock.now());
    };
    first.onend = () => {
      listening = false;
      releaseRecognizer(serial);
    };

    assert.equal(planMicStart({ speechBusy: false, previousEnded: true }), "start");
    serial = claimRecognizer();
    first.start();
    first.browserOpened();
    assert.equal(listening, true);
    assert.equal(micCountdown(openedAt, clock.now()).showCountdown, false);

    clock.advance(MIC_LEAD_MS);
    assert.equal(micCountdown(openedAt, clock.now()).seconds, 5);
    clock.advance(1_000);
    assert.equal(micCountdown(openedAt, clock.now()).seconds, 4);
    assert.equal(micAnswer("again"), "keep");
    assert.equal(openedAt, 0);

    clock.advance(500);
    assert.equal(micAnswer("miss"), "retry");
    assert.throws(() => first.start(), /InvalidStateError/);
    clock.clearTimeout(closeTimer);
    openedAt = null;
    listening = false;
    first.abort();
    assert.equal(first.active, false);
    assert.equal(recognizerIsIdle(), true);
    assert.equal(micCountdown(openedAt, clock.now()).close, false);

    clock.advance(MIC_WINDOW_MS);
    assert.equal(closes.length, 0);

    const second = fakeRecognizer();
    second.onstart = () => {
      listening = true;
      openedAt = clock.now();
      closeTimer = clock.setTimeout(() => {
        closes.push("next");
        listening = false;
      }, MIC_WINDOW_MS);
    };
    second.onend = () => {
      listening = false;
      releaseRecognizer(serial);
    };
    assert.equal(planMicStart({ speechBusy: true, previousEnded: recognizerIsIdle() }), "wait");
    assert.equal(planMicStart({ speechBusy: false, previousEnded: false }), "wait");
    assert.equal(planMicStart({ speechBusy: false, previousEnded: true }), "start");
    serial = claimRecognizer();
    second.start();
    assert.equal(second.active, true);
    assert.equal(first.active, false);
    second.browserOpened();
    const nextOpen = openedAt ?? 0;
    assert.equal(micCountdown(nextOpen, nextOpen).showCountdown, false);
    clock.advance(MIC_LEAD_MS);
    assert.equal(micCountdown(nextOpen, clock.now()).seconds, 5);
    clock.advance(MIC_COUNTDOWN_MS);
    assert.equal(micCountdown(nextOpen, clock.now()).seconds, 0);
    assert.equal(listening, true);
    assert.deepEqual(closes, []);
    clock.advance(MIC_TAIL_MS);
    assert.deepEqual([...closes], ["next"]);
    assert.equal(listening, false);
    assert.equal(clock.pending(), 0);
  });

  it("points exercises 2 through 5 at these constants", () => {
    const stage = readFileSync(new URL("../../components/spelling-stage.tsx", import.meta.url), "utf8");
    assert.equal(stage.includes("MIC_LEAD_MS"), true);
    assert.equal(stage.includes("MIC_COUNTDOWN_MS"), true);
    assert.equal(stage.includes("MIC_TAIL_MS"), true);
    assert.equal(stage.includes("MIC_WINDOW_MS"), true);
    assert.equal(stage.includes("micCountdown"), true);
    assert.equal(stage.includes("micAnswer"), true);
    assert.equal(stage.includes("rec.onstart"), true);
    assert.equal(stage.includes('noteHeard("Try again")'), true);
    assert.equal(stage.includes('outcome: "again"'), false);
    const exercises = stage.slice(stage.indexOf("if (!canScore) return;"), stage.indexOf("phase !== \"good-job\""));
    assert.equal(exercises.includes("viewRef.current.exercise === 5"), true);
    assert.equal(exercises.includes("viewRef.current.exercise !== 5"), true);
    assert.equal(exercises.split("armWindow(").length - 1 >= 1, true);
  });
});
