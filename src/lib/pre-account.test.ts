import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  CREATE_ACCOUNT_BUTTON_CLASS,
  PAY_MONTH_URL,
  PAY_YEAR_URL,
  SPLASH_ADVANCE_MS,
  claimSplashAdvance,
} from "./pre-account.ts";

describe("pre-account flow", () => {
  it("leaves the splash after 7 seconds or the first tap, every time", () => {
    assert.equal(SPLASH_ADVANCE_MS, 7000);
    assert.equal(claimSplashAdvance(false), true);
    assert.equal(claimSplashAdvance(true), false);
    const splash = readFileSync(new URL("../components/school-splash.tsx", import.meta.url), "utf8");
    const home = readFileSync(new URL("../routes/index.tsx", import.meta.url), "utf8");
    assert.equal(splash.includes("SPLASH_ADVANCE_MS"), true);
    assert.equal(splash.includes("claimSplashAdvance"), true);
    assert.equal(splash.includes("pointerdown"), true);
    assert.equal(home.includes('setStage("teletype")'), true);
    assert.equal(home.includes("splashAlreadyShown"), false);
    assert.equal(home.includes("markSplashShown"), false);
  });

  it("keeps Skip, Sign in, and One week free working", () => {
    const teletype = readFileSync(new URL("../components/teletype-intro.tsx", import.meta.url), "utf8");
    assert.equal(teletype.includes("One week FREE"), true);
    assert.equal(teletype.includes("beginSharedTrial()"), true);
    assert.equal(teletype.includes("onContinue()"), true);
    assert.match(teletype, /onClick=\{onContinue\}[\s\S]{0,240}Sign in/);
    assert.match(teletype, /onClick=\{onContinue\}[\s\S]{0,240}Skip/);
    const free = teletype.indexOf("One week FREE");
    assert.equal(teletype.slice(free - 500, free).includes(".finally(() => onContinue())"), true);
    assert.equal(teletype.includes("window.scrollBy"), false);
    assert.equal(teletype.includes('className="invisible"'), true);
  });

  it("points each pay button at its own card and does not open an engine", () => {
    assert.equal(PAY_YEAR_URL, "https://www.dotheimpossible.ai/parents#plan-79");
    assert.equal(PAY_MONTH_URL, "https://www.dotheimpossible.ai/parents#plan-9");
    const teletype = readFileSync(new URL("../components/teletype-intro.tsx", import.meta.url), "utf8");
    const enroll = readFileSync(new URL("../routes/enroll.tsx", import.meta.url), "utf8");
    for (const source of [teletype, enroll]) {
      assert.equal(source.includes("PAY_YEAR_URL"), true);
      assert.equal(source.includes("PAY_MONTH_URL"), true);
      assert.equal(source.includes("SCHOOL_ENGINE_URL"), false);
      assert.equal(source.includes("/vkole/m"), false);
      assert.equal(source.includes("/engine"), false);
    }
    const yearAt = teletype.indexOf("href={PAY_YEAR_URL}");
    const monthAt = teletype.indexOf("href={PAY_MONTH_URL}");
    assert.equal(yearAt > 0 && monthAt > yearAt, true);
  });

  it("makes Create account yellow with dark text and still registers the parent", () => {
    assert.equal(CREATE_ACCOUNT_BUTTON_CLASS.includes("bg-[#e6c65c]"), true);
    assert.equal(CREATE_ACCOUNT_BUTTON_CLASS.includes("text-[#1c1408]"), true);
    const login = readFileSync(new URL("../components/parent-login.tsx", import.meta.url), "utf8");
    const confirm = readFileSync(new URL("../components/confirm-email.tsx", import.meta.url), "utf8");
    assert.equal(login.includes("CREATE_ACCOUNT_BUTTON_CLASS"), true);
    assert.equal(login.includes('mode === "in" ? "Create account"'), true);
    const create = login.indexOf("await schoolSignUp");
    assert.equal(create > 0, true);
    assert.equal(login.slice(create - 80, create).includes('mode === "up"'), true);
    assert.equal(confirm.includes("We sent an email to"), true);
    assert.equal(confirm.includes("I tapped the link — continue"), true);
    assert.equal(confirm.includes("Send the email again"), true);
    assert.equal(confirm.includes("Not there? Check your spam folder. It can take a few minutes."), true);
  });
});
