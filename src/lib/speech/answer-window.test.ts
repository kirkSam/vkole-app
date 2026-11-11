import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { SPOKEN_ANSWER_MS, answerWindowLeft, listenerRestartAllowed } from "./answer-window.ts";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("one 20-second answer window", () => {
  it("keeps one 20-second total when the listener would restart", () => {
    const shown = 5_000;
    assert.equal(SPOKEN_ANSWER_MS, 20_000);
    assert.equal(answerWindowLeft(shown, shown), 20_000);
    assert.equal(answerWindowLeft(shown, shown + 6_000), 14_000);
    assert.equal(answerWindowLeft(shown, shown + 12_000), 8_000);
    assert.equal(answerWindowLeft(shown, shown + 18_000), 2_000);
    assert.equal(answerWindowLeft(shown, shown + 20_000), 0);
    assert.equal(answerWindowLeft(shown, shown + 26_000), 0);
    const restartAt = [shown + 6_000, shown + 12_000, shown + 18_000];
    for (const now of restartAt) {
      assert.equal(answerWindowLeft(shown, now) < SPOKEN_ANSWER_MS, true);
      assert.equal(shown + SPOKEN_ANSWER_MS, 25_000);
    }
    assert.equal(listenerRestartAllowed(), false);
  });

  it("starts the listener once in each spoken engine", () => {
    for (const path of ["../../components/sight-word-stage.tsx", "../../components/phonemic-stage.tsx"]) {
      const stage = source(path);
      assert.equal(stage.includes("answerWindowLeft"), true, path);
      assert.equal(stage.includes("askMicrophone"), true, path);
      assert.equal(stage.includes("MIC_DENIED_LINE"), true, path);
      assert.equal(stage.includes("ListeningCue"), true, path);
      const ended = stage.slice(stage.indexOf("rec.onend"));
      const handler = ended.slice(0, ended.indexOf("};"));
      assert.equal(handler.includes(".start("), false, path);
    }
    const alphabet = source("../../components/alphabet-stage.tsx");
    assert.equal(alphabet.includes("askMicrophone"), true);
    assert.equal(alphabet.includes("MIC_DENIED_LINE"), true);
    assert.equal(alphabet.includes("listenerRestartAllowed"), true);
    assert.equal(alphabet.includes("ListeningCue"), true);
  });
});
