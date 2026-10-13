import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gateStillOpen, parentGatePasses, PARENT_GATE_MS } from "./parent-gate.ts";

describe("parent gate", () => {
  it("opens only for the math answer and the word together", () => {
    assert.equal(parentGatePasses("60", "parent"), true);
    assert.equal(parentGatePasses(" 60 ", "Parent"), true);
    assert.equal(parentGatePasses("60", "mom"), false);
    assert.equal(parentGatePasses("61", "parent"), false);
    assert.equal(parentGatePasses("", ""), false);
  });

  it("forgets the pass after a few minutes", () => {
    const start = 1_000_000;
    assert.equal(gateStillOpen(start, start + PARENT_GATE_MS - 1), true);
    assert.equal(gateStillOpen(start, start + PARENT_GATE_MS), false);
    assert.equal(gateStillOpen(null, start), false);
  });
});
