import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { GROK_MODEL, GROK_REASONING_EFFORT } from "./grok-model.ts";

test("both Grok calls use the one current low-cost model", () => {
  assert.equal(GROK_MODEL, "grok-4.3");
  assert.equal(GROK_REASONING_EFFORT, "none");
  const cycle = readFileSync(new URL("./vkole-cycle.ts", import.meta.url), "utf8");
  const report = readFileSync(new URL("./vkole/alphabet/report.ts", import.meta.url), "utf8");
  for (const source of [cycle, report]) {
    assert.equal(source.includes("grok-4-1-fast-non-reasoning"), false);
    assert.equal(source.includes("GROK_MODEL"), true);
    assert.equal(source.includes("GROK_REASONING_EFFORT"), true);
  }
});
