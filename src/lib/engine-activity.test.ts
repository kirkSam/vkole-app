import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { IDLE_MS } from "./academic-email.ts";
import {
  appSessionOnWebsiteUnauthorized,
  engineIdleMs,
  engineIsBusy,
  holdEngineAudio,
  holdEngineLetter,
  holdEngineMic,
  inactivityDue,
  markEngineSession,
  noteEngineActivity,
  resetEngineActivity,
} from "./engine-activity.ts";
import { SchoolCallError } from "./school-account.server.ts";
import { runWithSchoolBook } from "./school-sync.server.ts";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("engine activity keeps a sitting open", () => {
  it("treats speech, the microphone, and a fresh answer as activity, and pauses the idle clock while they last", () => {
    resetEngineActivity();
    const start = 1_000;
    assert.equal(inactivityDue(start, start + IDLE_MS, false, IDLE_MS), true);
    assert.equal(inactivityDue(start, start + IDLE_MS - 1, false, IDLE_MS), false);
    assert.equal(inactivityDue(start, start + IDLE_MS + 60_000, true, IDLE_MS), false);

    noteEngineActivity(start);
    assert.equal(engineIdleMs(start + 2500), 2500);
    const audio = holdEngineAudio();
    const nested = holdEngineAudio();
    assert.equal(engineIsBusy(), true);
    assert.equal(inactivityDue(start, start + IDLE_MS + 1, engineIsBusy(), IDLE_MS), false);
    audio();
    assert.equal(engineIsBusy(), true);
    nested();
    nested();
    assert.equal(engineIsBusy(), false);

    const mic = holdEngineMic();
    assert.equal(engineIsBusy(), true);
    mic();
    assert.equal(engineIsBusy(), false);

    const letter = holdEngineLetter();
    assert.equal(engineIsBusy(), true);
    assert.equal(inactivityDue(start, start + IDLE_MS + 60_000, engineIsBusy(), IDLE_MS), false);
    letter();
    assert.equal(engineIsBusy(), false);
    assert.equal(inactivityDue(start, start + IDLE_MS + 60_000, engineIsBusy(), IDLE_MS), true);
    const duringLetter = holdEngineLetter();
    const closedMic = holdEngineMic();
    closedMic();
    assert.equal(engineIsBusy(), true);
    assert.equal(inactivityDue(start, start + IDLE_MS + 60_000, engineIsBusy(), IDLE_MS), false);
    duringLetter();

    holdEngineMic();
    holdEngineLetter();
    markEngineSession(false);
    assert.equal(engineIsBusy(), false);
    assert.equal(appSessionOnWebsiteUnauthorized(false), "sign-in");
    markEngineSession(true);
    assert.equal(appSessionOnWebsiteUnauthorized(true), "stay");
    resetEngineActivity();
  });

  it("does not sign the app out when a clock or report call is unauthorized during an engine", async () => {
    let ended = "";
    let ran = 0;
    let pushed = 0;
    const saved = await runWithSchoolBook({
      engineActive: true,
      pull: async () => {
        throw new SchoolCallError("unauthorized", "Token expired");
      },
      run: async () => {
        ran += 1;
        return "answer-kept";
      },
      push: async () => {
        pushed += 1;
      },
      endSession: async (message) => {
        ended = message;
        return new Error("signed out");
      },
      onAccountGone: async () => {
        throw new Error("gone");
      },
    });
    assert.equal(saved, "answer-kept");
    assert.equal(ran, 1);
    assert.equal(pushed, 0);
    assert.equal(ended, "");

    const afterPush = await runWithSchoolBook({
      engineActive: true,
      pull: async () => undefined,
      run: async () => "local",
      push: async () => {
        throw new SchoolCallError("unauthorized", "Token expired");
      },
      endSession: async (message) => {
        ended = message;
        return new Error("signed out");
      },
      onAccountGone: async () => {
        throw new Error("gone");
      },
    });
    assert.equal(afterPush, "local");
    assert.equal(ended, "");
  });

  it("still returns the parent to sign-in when the website rejects the token outside an engine", async () => {
    let ran = 0;
    let ended = "";
    await assert.rejects(
      () =>
        runWithSchoolBook({
          engineActive: false,
          pull: async () => {
            throw new SchoolCallError("unauthorized", "Token expired");
          },
          run: async () => {
            ran += 1;
            return "nope";
          },
          push: async () => undefined,
          endSession: async (message) => {
            ended = message;
            return new Error("signed out");
          },
          onAccountGone: async () => {
            throw new Error("gone");
          },
        }),
      (err: unknown) => err instanceof Error && err.message === "signed out",
    );
    assert.equal(ran, 0);
    assert.equal(ended, "Token expired");
  });

  it("wires every voice engine and the sitting page to the idle clock", () => {
    const session = source("../routes/session.$id.tsx");
    const spelling = source("../components/spelling-stage.tsx");
    const phonemic = source("../components/phonemic-stage.tsx");
    const sight = source("../components/sight-word-stage.tsx");
    const middleware = source("./school-middleware.ts");
    assert.match(session, /inactivityDue\(last, Date\.now\(\), engineIsBusy\(\), IDLE_MS\)/);
    assert.match(session, /ENGINE_ACTIVITY_EVENT/);
    assert.match(session, /if \(engineIsBusy\(\)\) stamp\(\)/);
    assert.equal(session.includes("next.closed"), false);
    assert.equal(session.includes("!next.armed"), false);
    for (const stage of [spelling, phonemic, sight]) {
      assert.match(stage, /holdEngineAudio/);
      assert.match(stage, /holdEngineMic/);
      assert.match(stage, /noteEngineActivity/);
    }
    assert.match(spelling, /holdEngineLetter/);
    assert.match(spelling, /alphabetLetterShowing/);
    assert.equal(phonemic.includes("holdEngineLetter"), false);
    assert.equal(sight.includes("holdEngineLetter"), false);
    assert.match(middleware, /engineSessionActive\(\)/);
    assert.match(middleware, /appSessionOnWebsiteUnauthorized\(engineSessionActive\(\)\) === "sign-in"/);
  });

  it("does not lock a sitting when recorded seconds are high", () => {
    const session = source("../routes/session.$id.tsx");
    const home = source("../routes/index.tsx");
    const clock = source("./day-clock.ts");
    assert.equal(session.includes("midnight Pacific"), false);
    assert.equal(session.includes("The 8 hours"), false);
    assert.equal(session.includes("Student password"), false);
    assert.match(session, /inactivityDue\(last, Date\.now\(\), engineIsBusy\(\), IDLE_MS\)/);
    assert.match(session, /formatOnline\(closure\.sittingSeconds\)/);
    assert.equal(home.includes("clock of 8 hours"), false);
    assert.equal(home.includes("midnight Pacific"), false);
    assert.equal(clock.includes('status: "closed"'), false);
    assert.equal(clock.includes('status: "hold"'), false);
  });
});
