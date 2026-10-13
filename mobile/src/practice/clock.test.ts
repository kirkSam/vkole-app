import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DAY_LIMIT_SECONDS, IDLE_STOP_SECONDS } from "../../../src/lib/day-clock-math.ts";
import { displayClock, freshClock, noteActivity } from "./clock.ts";

const morning = Date.parse("2026-10-13T17:00:00.000Z");

describe("device practice clock", () => {
  it("starts at two and a half hours and counts a short active gap", () => {
    const started = noteActivity(freshClock(morning), morning);
    const later = noteActivity(started, morning + 30_000);
    assert.equal(later.usedSeconds, 30);
    assert.equal(displayClock(later, morning + 30_000).remaining, DAY_LIMIT_SECONDS - 30);
  });

  it("does not count five quiet minutes", () => {
    const started = noteActivity(freshClock(morning), morning);
    const quiet = morning + IDLE_STOP_SECONDS * 1000;
    const face = displayClock(started, quiet);
    assert.equal(face.idleStopped, true);
    assert.equal(face.used, 0);
    const resumed = noteActivity(started, quiet);
    assert.equal(resumed.usedSeconds, 0);
    assert.equal(resumed.armed, true);
  });

  it("closes at the daily limit and opens again on the next Pacific day", () => {
    const almost = {
      ...freshClock(morning),
      usedSeconds: DAY_LIMIT_SECONDS - 5,
      lastActivityAt: morning,
      armed: true,
    };
    const closed = noteActivity(almost, morning + 10_000);
    assert.equal(closed.armed, false);
    assert.equal(closed.usedSeconds, DAY_LIMIT_SECONDS);
    const nextDay = Date.parse("2026-10-14T07:00:00.000Z");
    assert.equal(displayClock(closed, nextDay).closed, false);
    assert.equal(displayClock(closed, nextDay).remaining, DAY_LIMIT_SECONDS);
  });
});
