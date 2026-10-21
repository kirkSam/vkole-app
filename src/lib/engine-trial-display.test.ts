import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { schoolAccessDecision } from "./school-account.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Phrases the engines list and the student session header used to show. */
const COUNTDOWN = ["days left", "days left in your free trial", "7 days free", "7 day trial finished"];

describe("engines view trial text", () => {
  it("does not render the free-trial days countdown", () => {
    const engines = readFileSync(join(root, "routes", "index.tsx"), "utf8");
    const session = readFileSync(join(root, "routes", "session.$id.tsx"), "utf8");
    for (const phrase of COUNTDOWN) {
      assert.equal(engines.toLowerCase().includes(phrase), false, `engines view still has ${phrase}`);
      assert.equal(session.toLowerCase().includes(phrase), false, `session header still has ${phrase}`);
    }
    assert.equal(engines.includes("daysLeft"), false);
    assert.equal(session.includes("climb.daysLeft"), false);
    assert.equal(engines.includes('found.status === "blocked"'), true);
    assert.equal(engines.includes("setTrialOver(result.fullAccess || result.confirmEmail ? false : result.blocked)"), true);
  });

  it("still blocks a finished free week and still returns days left from the account decision", () => {
    const now = Date.parse("2026-10-17T19:00:00.000Z");
    const during = schoolAccessDecision({
      email: "parent@example.com",
      access: "open",
      freeWeekStart: "2026-10-15T19:00:00.000Z",
      now,
    });
    assert.equal(during.blocked, false);
    assert.equal(during.expired, false);
    assert.equal(during.showTrialPage, false);
    assert.equal(during.fullAccess, false);
    assert.equal(during.daysLeft, 5);

    const finished = schoolAccessDecision({
      email: "parent@example.com",
      access: "closed",
      freeWeekStart: "1970-01-01T00:00:00.000Z",
      now,
    });
    assert.equal(finished.blocked, true);
    assert.equal(finished.expired, true);
    assert.equal(finished.showTrialPage, true);
    assert.equal(finished.fullAccess, false);
    assert.equal(finished.daysLeft, 0);
  });
});
