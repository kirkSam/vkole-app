import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { SUBJECTS } from "./climb-rules.ts";
import {
  WEBSITE_PARENTS,
  WEBSITE_VISIT_BUTTON,
  WEBSITE_VISIT_LINE,
  androidWebViewIntent,
  visitUsesSystemBrowser,
} from "./website-visit.ts";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("website visit", () => {
  it("uses the plain sentence, the button, and the parents pricing pay page", () => {
    assert.equal(WEBSITE_VISIT_LINE, "Your account works on our website too, with the same progress.");
    assert.equal(WEBSITE_VISIT_BUTTON, "Visit dotheimpossible.ai");
    assert.equal(WEBSITE_PARENTS, "https://www.dotheimpossible.ai/parents");
    const visit = source("./website-visit.ts");
    assert.equal(visit.includes("https://www.dotheimpossible.ai/parents"), true);
    assert.equal(visit.includes('export const WEBSITE_HOME'), false);
    const view = source("../components/website-visit.tsx");
    assert.equal(view.includes("WEBSITE_VISIT_LINE"), true);
    assert.equal(view.includes("WEBSITE_VISIT_BUTTON"), true);
    assert.equal(view.includes("WEBSITE_PARENTS"), true);
    assert.equal(view.includes('href={WEBSITE_PARENTS}'), true);
    assert.equal(view.includes("https://www.dotheimpossible.ai\""), false);
    const shell = source("../components/shell.tsx");
    assert.equal(shell.includes("href={WEBSITE_PARENTS}"), true);
    assert.equal(shell.includes('href={`${SCHOOL_SITE}/parents`}'), false);
    assert.equal(view.includes('target="_blank"'), true);
    assert.equal(view.includes('rel="noopener noreferrer"'), true);
    assert.equal(view.includes("role=\"dialog\""), false);
    assert.equal(view.includes("window.alert"), false);
  });

  it("opens a new tab on a computer and the system browser on a phone or installed app", () => {
    assert.equal(visitUsesSystemBrowser("Mozilla/5.0 (Macintosh) Chrome/120.0.0.0"), false);
    assert.equal(visitUsesSystemBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"), true);
    assert.equal(visitUsesSystemBrowser("Mozilla/5.0 (Linux; Android 14; Pixel 8)"), true);
    assert.equal(visitUsesSystemBrowser("Mozilla/5.0 (Macintosh) Chrome/120.0.0.0", true), true);
    assert.equal(androidWebViewIntent("Mozilla/5.0 (Linux; Android 14; Pixel 8)"), null);
    assert.equal(
      androidWebViewIntent("Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36"),
      "intent://www.dotheimpossible.ai/parents#Intent;scheme=https;action=android.intent.action.VIEW;end",
    );
    assert.equal(androidWebViewIntent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"), null);
  });

  it("shows the line after Finish, on the parent home, and on the confirm screen", () => {
    const session = source("../routes/session.$id.tsx");
    const home = source("../routes/index.tsx");
    const confirm = source("../components/confirm-email.tsx");
    assert.equal(session.includes('closure.reason === "finished" ? <WebsiteVisit /> : null'), true);
    assert.equal(session.includes('finishRef.current("finished")'), true);
    assert.equal(home.includes("<WebsiteVisit />"), true);
    assert.equal(home.includes("This email is saved:"), true);
    assert.equal(confirm.includes("<WebsiteVisit />"), true);
    assert.equal(confirm.includes("Check your email to start your free week") || confirm.includes("CONFIRM_EMAIL_TITLE"), true);
    assert.deepEqual(
      SUBJECTS.map((subject) => subject.id),
      ["m", "ela", "ss", "gen", "sg", "sw", "sp", "pa"],
    );
  });

  it("stays off the exercise screens", () => {
    const session = source("../routes/session.$id.tsx");
    const exercise = session.split("{closure ? (")[0] ?? "";
    assert.equal(exercise.includes("<WebsiteVisit"), false);
    for (const path of [
      "../components/phonemic-stage.tsx",
      "../components/sight-word-stage.tsx",
      "../components/spelling-stage.tsx",
      "../components/shell.tsx",
    ]) {
      assert.equal(source(path).includes("WebsiteVisit"), false, path);
      assert.equal(source(path).includes(WEBSITE_VISIT_LINE), false, path);
    }
  });
});
