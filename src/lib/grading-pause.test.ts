import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { GRADING_FAILURE_CAP, GRADING_PAUSE_MESSAGE, settleGradingCall } from "./grading-pause.ts";

describe("settleGradingCall", () => {
  it("asks the child to try again until the third grading call in a row never comes back", () => {
    assert.deepEqual(settleGradingCall("absent", null, 0), { action: "again", failures: 1 });
    assert.deepEqual(settleGradingCall("absent", null, 1), { action: "again", failures: 2 });
    assert.equal(GRADING_FAILURE_CAP, 3);
  });

  it("stops asking for another try after three grading failures", () => {
    assert.deepEqual(settleGradingCall("absent", null, 2), { action: "rest", failures: 3 });
    assert.deepEqual(settleGradingCall("absent", null, 3), { action: "rest", failures: 4 });
    assert.equal(
      GRADING_PAUSE_MESSAGE,
      "Take a break and come back later. Your level stays the same.",
    );
  });

  it("keeps a real grade so the failure count can reset, and marks an unreadable reply incorrect", () => {
    assert.deepEqual(settleGradingCall("graded", true, 2), { action: "score", correct: true });
    assert.deepEqual(settleGradingCall("graded", false, 2), { action: "score", correct: false });
    assert.deepEqual(settleGradingCall("unreadable", null, 2), { action: "score", correct: false });
  });
});

describe("parent report letter", () => {
  it("says the level and free week follow the account login", () => {
    const source = readFileSync(new URL("./academic-email.ts", import.meta.url), "utf8");
    assert.match(source, /The level and the free week follow the account's login/);
    assert.equal(source.includes("stay on the device"), false);
  });
});
