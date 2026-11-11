import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { SPOKEN_ANSWER_MS, answerClockAt, answerWindowLeft, cueOnListenStart, keepListeningCue, listenerRestartAllowed, quietRestart } from "./answer-window.ts";

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
    assert.equal(listenerRestartAllowed(15_000), true);
    assert.equal(listenerRestartAllowed(0), false);
    const shownLate = 1_000;
    const endedAt = shownLate + 5_000;
    const plan = quietRestart(shownLate, endedAt);
    assert.equal(plan.restart, true);
    assert.equal(plan.allowForSilence, 15_000);
    assert.equal(plan.stopsAt, shownLate + SPOKEN_ANSWER_MS);
    assert.equal(quietRestart(shownLate, shownLate + SPOKEN_ANSWER_MS).restart, false);
    assert.equal(quietRestart(shownLate, shownLate + SPOKEN_ANSWER_MS).stopsAt, shownLate + SPOKEN_ANSWER_MS);
    assert.equal(cueOnListenStart(true, "started"), true);
    assert.equal(cueOnListenStart(true, "audio"), false);
    assert.equal(cueOnListenStart(false, "audio"), true);
    assert.equal(cueOnListenStart(false, "started"), false);
    assert.equal(keepListeningCue(true, true), true);
    assert.equal(keepListeningCue(false, true), false);
    assert.equal(keepListeningCue(true, false), false);
  });

  it("starts the clock after a chime, and when the word is shown if no chime plays", () => {
    const shown = 1_000;
    const mic = shown + 300;
    assert.equal(answerClockAt(true, shown, mic), mic);
    assert.equal(answerWindowLeft(answerClockAt(true, shown, mic), mic), SPOKEN_ANSWER_MS);
    assert.equal(answerClockAt(false, shown, mic), shown);
    assert.equal(answerWindowLeft(answerClockAt(false, shown, mic), shown), SPOKEN_ANSWER_MS);
    assert.equal(answerWindowLeft(shown, mic), SPOKEN_ANSWER_MS - 300);
    assert.equal(answerClockAt(true, shown, mic) + 6_000, mic + 6_000);
    assert.equal(answerClockAt(false, shown, mic) + 6_000, shown + 6_000);
    for (const path of ["../../components/sight-word-stage.tsx", "../../components/phonemic-stage.tsx"]) {
      const stage = source(path);
      const after = stage.slice(stage.indexOf("await playHeldChime"));
      const reset = after.indexOf("if (allowed)");
      const start = after.indexOf("ear.start()");
      assert.equal(reset >= 0 && reset < start, true, path);
      assert.equal(after.includes("shownAt.current = performance.now()"), true, path);
      assert.equal(stage.includes("if (shownAt.current == null) shownAt.current = performance.now()"), true, path);
      const ended = stage.slice(stage.indexOf("rec.onend"));
      const handler = ended.slice(0, ended.indexOf("};"));
      assert.equal(handler.includes("shownAt.current = "), false, path);
    }
    const alphabet = source("../../components/alphabet-stage.tsx");
    assert.equal(alphabet.includes("if (allowed) onChimed()"), true);
    assert.equal((alphabet.match(/letterAt = performance\.now\(\)/g) ?? []).length >= 4, true);
  });

  it("keeps alphabet at 6 seconds and the cue as Sam approved", () => {
    const alphabet = source("../../components/alphabet-stage.tsx");
    const session = source("./mic-session.ts");
    const cue = source("../../components/listening-cue.tsx");
    const css = source("../../styles.css");
    assert.equal(alphabet.includes("answerWindowLeft"), false);
    assert.equal(alphabet.includes("SPOKEN_ANSWER_MS"), false);
    assert.equal(alphabet.includes("MIC_WINDOW_MS"), true);
    assert.equal(session.includes("MIC_WINDOW_MS = 6_000"), true);
    assert.equal(cue.includes("Listening\\u2026"), true);
    assert.equal(cue.includes("<Mic"), true);
    assert.equal(cue.includes("size={28}"), true);
    assert.equal(cue.includes('color="#2c5e4a"'), true);
    assert.equal(cue.includes('aria-hidden="true"'), true);
    assert.equal(cue.includes('role="status"'), true);
    assert.equal(cue.includes('aria-live="polite"'), true);
    assert.equal(css.includes("listening-pulse 1.2s ease-in-out infinite"), true);
    assert.equal(css.includes("scale(1.08)"), true);
    assert.equal(css.includes("opacity: 0.7"), true);
    assert.equal(css.includes("font-size: 1.2rem"), true);
    assert.equal(css.includes("prefers-reduced-motion: reduce"), true);
    for (const path of ["../../components/sight-word-stage.tsx", "../../components/phonemic-stage.tsx"]) {
      const stage = source(path);
      assert.equal(stage.includes("if (shownAt.current == null) shownAt.current = performance.now()"), true, path);
      assert.equal((stage.match(/shownAt\.current = null/g) ?? []).length, 1, path);
    }
  });

  it("restarts an early end without moving the 20-second clock", () => {
    for (const path of ["../../components/sight-word-stage.tsx", "../../components/phonemic-stage.tsx"]) {
      const stage = source(path);
      assert.equal(stage.includes("answerWindowLeft"), true, path);
      assert.equal(stage.includes("quietRestart"), true, path);
      assert.equal(stage.includes("allowForSilence"), true, path);
      assert.equal(stage.includes("askMicrophone"), true, path);
      assert.equal(stage.includes("MIC_DENIED_LINE"), true, path);
      assert.equal(stage.includes("ListeningCue"), true, path);
      assert.equal(stage.includes("cueOnListenStart"), true, path);
      const ended = stage.slice(stage.indexOf("rec.onend"));
      const handler = ended.slice(0, ended.indexOf("};"));
      assert.equal(handler.includes("quietRestart"), true, path);
      assert.equal(handler.includes("ear.start()"), true, path);
      assert.equal(handler.includes("shownAt.current = "), false, path);
    }
    const alphabet = source("../../components/alphabet-stage.tsx");
    assert.equal(alphabet.includes("askMicrophone"), true);
    assert.equal(alphabet.includes("MIC_DENIED_LINE"), true);
    assert.equal(alphabet.includes("listenerRestartAllowed"), true);
    assert.equal(alphabet.includes("ListeningCue"), true);
    assert.equal(alphabet.includes("armSilence"), true);
  });
});
