import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  MIC_WINDOW_MS,
  SPELLING_COUNTDOWN_MS,
  claimRecognizer,
  formatMicTiming,
  micAnswer,
  micCountdown,
  micDeadline,
  micRestartAllowed,
  planMicStart,
  recognizerIsIdle,
  SPEECH_BUSY_WAIT_LIMIT,
  alreadyStartedError,
  releaseRecognizer,
  resetRecognizerGate,
  scheduleMicRestart,
  speechMayBlockMic,
  startWhenIdle,
} from "./mic-session.ts";

type FakeRecognizer = {
  active: boolean;
  starts: number;
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
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
    onaudiostart: null,
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
      rec.onaudiostart?.();
    },
    browserEnded() {
      if (!rec.active) return;
      rec.active = false;
      rec.onend?.();
    },
  };
  return rec;
}

describe("alphabet microphone window", () => {
  it("counts 6 seconds from audio start and closes on that same instant", () => {
    assert.equal(MIC_WINDOW_MS, 6000);
    assert.equal(SPELLING_COUNTDOWN_MS, 6000);
    assert.equal(micDeadline(1_000), 7_000);

    assert.deepEqual(micCountdown(null, 0), { showCountdown: false, seconds: null, close: false });
    const audioAt = 500;
    assert.deepEqual(micCountdown(audioAt, audioAt), { showCountdown: true, seconds: 6, close: false });
    assert.equal(micCountdown(audioAt, audioAt + 1).seconds, 6);
    assert.equal(micCountdown(audioAt, audioAt + 1000).seconds, 5);
    assert.equal(micCountdown(audioAt, audioAt + 5000).seconds, 1);
    assert.equal(micCountdown(audioAt, audioAt + MIC_WINDOW_MS - 1).seconds, 1);
    assert.equal(micCountdown(audioAt, audioAt + MIC_WINDOW_MS - 1).close, false);
    assert.deepEqual(micCountdown(audioAt, audioAt + MIC_WINDOW_MS), { showCountdown: true, seconds: 0, close: true });

    assert.equal(micAnswer("wait"), "keep");
    assert.equal(micAnswer("again"), "reask");
    assert.equal(micAnswer("correct"), "advance");
    assert.equal(micAnswer("miss"), "retry");
  });

  it("keeps a restart inside the same deadline and does not move it", () => {
    const audioAt = 0;
    assert.equal(micDeadline(audioAt), 6000);
    assert.equal(micRestartAllowed(audioAt, 5999), true);
    assert.equal(micRestartAllowed(audioAt, 6000), false);
    assert.equal(scheduleMicRestart(audioAt, 1000, 250), 1250);
    assert.equal(micDeadline(audioAt), 6000);
    assert.equal(scheduleMicRestart(audioAt, 5800, 250), null);
    assert.equal(scheduleMicRestart(null, 5800, 250), 6050);
    assert.equal(micRestartAllowed(null, 9000), true);

    resetRecognizerGate();
    const first = fakeRecognizer();
    let audio = 0;
    let closed = false;
    first.onaudiostart = () => {
      audio = 100;
    };
    first.onend = () => {
      releaseRecognizer(serial);
    };
    assert.equal(planMicStart({ speechBusy: false, previousEnded: true }), "start");
    const serial = claimRecognizer();
    first.start();
    first.browserOpened();
    assert.equal(audio, 100);
    assert.equal(micCountdown(audio, audio + 500).seconds, 6);
    assert.equal(micAnswer("miss"), "retry");
    first.abort();
    assert.equal(recognizerIsIdle(), true);
    assert.equal(scheduleMicRestart(audio, audio + MIC_WINDOW_MS, 250), null);
    closed = micCountdown(audio, audio + MIC_WINDOW_MS).close;
    assert.equal(closed, true);
    assert.equal(micDeadline(audio), audio + MIC_WINDOW_MS);

    const secondAudio = 8_000;
    assert.equal(micCountdown(secondAudio, secondAudio).seconds, 6);
    assert.equal(micCountdown(secondAudio, secondAudio).close, false);
    assert.equal(micDeadline(secondAudio), secondAudio + MIC_WINDOW_MS);
    releaseRecognizer(serial);
    resetRecognizerGate();
  });

  it("does not call start while a recognizer is active", () => {
    resetRecognizerGate();
    const running = fakeRecognizer();
    running.active = true;
    const blocked = startWhenIdle(running, false);
    assert.equal(blocked.status, "already-started");
    assert.equal(blocked.serial, 0);
    assert.equal(running.starts, 0);

    const rec = fakeRecognizer();
    rec.start = () => {
      throw Object.assign(new Error("recognition has already started"), { name: "InvalidStateError" });
    };
    const failed = startWhenIdle(rec, true);
    assert.equal(alreadyStartedError({ name: "InvalidStateError", message: "failed" }), true);
    assert.equal(failed.status, "already-started");
    assert.equal(recognizerIsIdle(), false);
    releaseRecognizer(failed.serial);
    assert.equal(recognizerIsIdle(), true);

    const ready = fakeRecognizer();
    const started = startWhenIdle(ready, recognizerIsIdle());
    assert.equal(started.status, "started");
    assert.equal(ready.starts, 1);
    assert.equal(startWhenIdle(ready, false).status, "already-started");
    assert.equal(ready.starts, 1);
    releaseRecognizer(started.serial);
    resetRecognizerGate();

    assert.equal(SPEECH_BUSY_WAIT_LIMIT, 3);
    assert.equal(speechMayBlockMic(true, 0), true);
    assert.equal(speechMayBlockMic(true, 2), true);
    assert.equal(speechMayBlockMic(true, SPEECH_BUSY_WAIT_LIMIT), false);
    assert.equal(speechMayBlockMic(false, 0), false);
  });

  it("formats the master timing line from one letter", () => {
    assert.equal(
      formatMicTiming({ letterShown: 1000, micStart: 1002, audioStart: 1080, micClose: 7080 }),
      "letter 0ms · mic 2ms · audio 80ms · close 6080ms",
    );
    assert.equal(
      formatMicTiming({ letterShown: 1000, micStart: null, audioStart: null, micClose: null }),
      "letter 0ms · mic — · audio — · close —",
    );
  });

  it("opens the mic with the letter and shares one clock", () => {
    const stage = readFileSync(new URL("../../components/spelling-stage.tsx", import.meta.url), "utf8");
    assert.equal(stage.includes("MIC_WINDOW_MS"), true);
    assert.equal(stage.includes("micCountdown"), true);
    assert.equal(stage.includes("micAnswer"), true);
    assert.equal(stage.includes("onaudiostart"), true);
    assert.equal(stage.includes("requestAnimationFrame"), true);
    assert.equal(stage.includes("performance.now()"), true);
    assert.equal(stage.includes("scheduleMicRestart"), true);
    assert.equal(stage.includes("formatMicTiming"), true);
    assert.equal(stage.includes("[vkole-mic]"), true);
    assert.equal(stage.includes("timingDebug"), true);
    assert.equal(stage.includes("setClockOn(frame.showCountdown)"), true);
    assert.equal(stage.includes("startWhenIdle"), true);
    assert.equal(stage.includes("getUserMedia"), true);
    assert.equal(stage.includes("speechMayBlockMic"), true);
    assert.equal(stage.includes('noteHeard("Try again")'), true);
    assert.equal(stage.includes('outcome: "again"'), true);
    assert.equal(stage.includes("SPELLING_MIC_BEFORE_COUNT_MS"), false);
    assert.equal(stage.includes("SPELLING_MIC_AFTER_ZERO_MS"), false);
    assert.equal(stage.includes("alphabetMicWindowMs"), false);
    assert.equal(stage.includes('error === "no-speech"'), false);
    assert.equal(/setTimeout\(\(\) => \{\s*if \(live\) setPhase\("listen"\)/.test(stage), false);
    const noSpeech = stage.slice(stage.indexOf("rec.onerror"), stage.indexOf("rec.onend"));
    assert.equal(noSpeech.includes("scheduleRestart()"), true);
    assert.equal(noSpeech.includes('setPhase("prompt")'), false);
    const exercises = stage.slice(stage.indexOf("if (!canScore) return;"), stage.indexOf('phase !== "good-job"'));
    assert.equal(exercises.includes("viewRef.current.exercise === 5"), true);
    assert.equal(exercises.includes("viewRef.current.exercise !== 5"), true);
    assert.equal(stage.includes('phase === "prompt" ? null'), true);
  });
});
