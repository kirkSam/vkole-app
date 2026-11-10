import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  LISTENING_BEST,
  PARENT_NEEDS_VOICE,
  PHONE_CANNOT_HEAR,
  VOICE_ALLOW,
  VOICE_CONSENT_TEXT,
  VOICE_CONSENT_TITLE,
  VOICE_CONSENT_VERSION,
  VOICE_NOT_ASKED,
  VOICE_NOT_NOW,
  VOICE_SETTINGS_LABEL,
  parseWebsiteVoiceConsent,
  voiceAnswersAllowed,
} from "./voice-consent.ts";
import { clearSignInPassword, holdSignInPassword, peekSignInPassword } from "./voice-password.ts";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const allowed = {
  status: "allowed" as const,
  decidedAt: "2026-11-06T18:00:00.000Z",
  wordingVersion: "v2" as const,
};

describe("parent voice consent", () => {
  it("does not listen unless the website allowed wording v2, and a turn-off stops that at once", () => {
    assert.equal(voiceAnswersAllowed(null), false);
    assert.equal(voiceAnswersAllowed(VOICE_NOT_ASKED), false);
    assert.equal(voiceAnswersAllowed({ ...allowed, status: "declined" }), false);
    assert.equal(voiceAnswersAllowed(allowed), true);
    assert.equal(voiceAnswersAllowed({ ...allowed, wordingVersion: "v1" as never }), false);
    assert.equal(voiceAnswersAllowed({ ...allowed, decidedAt: null }), false);
    assert.equal(parseWebsiteVoiceConsent({ status: "allowed" }).status, "not_asked");
    assert.equal(parseWebsiteVoiceConsent("allowed").status, "not_asked");
    const off = parseWebsiteVoiceConsent({
      status: "declined",
      decidedAt: "2026-11-06T18:05:00.000Z",
      wordingVersion: VOICE_CONSENT_VERSION,
    });
    assert.equal(off.status, "declined");
    assert.equal(off.decidedAt, "2026-11-06T18:05:00.000Z");
    assert.equal(off.wordingVersion, "v2");
    assert.equal(voiceAnswersAllowed(off), false);
  });

  it("does not keep a phone-only yes when the website omits the answer", () => {
    assert.equal(parseWebsiteVoiceConsent(undefined).status, "not_asked");
    assert.deepEqual(parseWebsiteVoiceConsent({}), VOICE_NOT_ASKED);
    assert.deepEqual(parseWebsiteVoiceConsent(allowed), allowed);
    const home = source("../routes/index.tsx");
    const mirror = source("./school-mirror.server.ts");
    assert.equal(home.includes("Saved on this app"), false);
    assert.equal(mirror.includes("saveVoiceConsentRow"), false);
    assert.equal(source("./voice-consent-api.ts").includes("saveVoiceConsentRow"), false);
  });

  it("uses the sign-in password once, then clears it, and asks when that copy is gone", () => {
    clearSignInPassword();
    assert.equal(peekSignInPassword(), "");
    holdSignInPassword("correct-horse");
    assert.equal(peekSignInPassword(), "correct-horse");
    clearSignInPassword();
    assert.equal(peekSignInPassword(), "");
    const password = source("./voice-password.ts");
    const login = source("../components/parent-login.tsx");
    const home = source("../routes/index.tsx");
    const consent = source("../components/voice-answers.tsx");
    assert.equal(password.includes("localStorage"), false);
    assert.equal(password.includes("sessionStorage"), false);
    assert.equal(login.includes("holdSignInPassword"), true);
    assert.equal(login.includes("peekSignInPassword"), true);
    assert.equal(login.includes("readVoiceConsent"), true);
    assert.equal(login.includes("VoiceAnswers"), true);
    assert.equal(login.includes("window.location.assign(ENGINE_PICKER_ROUTE)"), true);
    assert.equal(login.includes("vkole-voice-password"), false);
    const readAt = login.indexOf("readVoiceConsent");
    const assignAt = login.indexOf("window.location.assign(ENGINE_PICKER_ROUTE)");
    assert.equal(readAt > 0 && readAt < assignAt, true);
    assert.equal(home.includes("clearSignInPassword"), true);
    assert.equal(home.includes("peekSignInPassword"), true);
    assert.equal(home.includes("peekSignInPassword().length < 8"), true);
    assert.equal(consent.includes('type="password"'), true);
    assert.equal(source("../lib/auth/client.ts").includes("clearSignInPassword"), true);
  });

  it("shows the consent question only to the parent, and the child card never asks it", () => {
    assert.equal(VOICE_CONSENT_TITLE, "Voice answers");
    assert.equal(VOICE_ALLOW, "Allow voice answers");
    assert.equal(VOICE_NOT_NOW, "Not now");
    assert.equal(VOICE_SETTINGS_LABEL, "Voice answers: On / Off");
    assert.equal(VOICE_CONSENT_VERSION, "v2");
    assert.equal(PARENT_NEEDS_VOICE, "A parent needs to turn on voice answers. Until then, an adult marks each answer.");
    assert.equal(PHONE_CANNOT_HEAR, "This phone cannot hear the student. Android 13 or newer lets the app hear the student. An adult evaluates and marks each answer.");
    assert.equal(LISTENING_BEST, "Listening works best on Android 13 or newer.");
    assert.equal(
      VOICE_CONSENT_TEXT,
      "Some VKOLE engines let your child answer out loud. When your child answers, the microphone listens for a few seconds, turns the answer into text, and then stops. VKOLE does not record or save your child's voice. On newer Android phones, this happens on the phone. In a web browser and on older Android phones, Google's speech service turns the answer into text. Google's privacy policy covers that step, and Google may keep the audio if your Google account saves voice activity. You can turn voice answers off at any time. If voice answers are off, an adult marks each answer.",
    );
    const home = source("../routes/index.tsx");
    const session = source("../routes/session.$id.tsx");
    const consent = source("../components/voice-answers.tsx");
    const post = source("./school-account.server.ts");
    assert.equal(home.includes("VoiceAnswers"), true);
    assert.equal(home.includes("LISTENING_BEST"), true);
    assert.equal(consent.includes("VOICE_CONSENT_TEXT"), true);
    assert.equal(session.includes("Allow voice answers"), false);
    assert.equal(session.includes(VOICE_CONSENT_TEXT), false);
    assert.equal(session.includes("voiceAllowed"), true);
    assert.equal(session.includes("subscribeVoiceConsent"), true);
    assert.equal(session.includes("voiceAllowedNow"), true);
    assert.equal(session.includes("visibilitychange"), true);
    assert.equal(session.includes("setInterval(pull, 1000)"), false);
    assert.equal(session.includes("clearSignInPassword"), true);
    for (const path of ["../components/sight-word-stage.tsx", "../components/phonemic-stage.tsx", "../components/alphabet-stage.tsx"]) {
      const stage = source(path);
      assert.equal(stage.includes("Allow voice answers"), false, path);
      assert.equal(stage.includes(VOICE_CONSENT_TEXT), false, path);
      assert.equal(stage.includes("PARENT_NEEDS_VOICE"), true, path);
      assert.equal(stage.includes("voiceAllowedNow().then"), true, path);
      const gate = stage.indexOf("voiceAllowedNow");
      const call = stage.indexOf("createListener()");
      assert.equal(gate > 0 && call > gate, true, path);
    }
    assert.equal(post.includes('voiceConsent: "/api/account/voice-consent"'), true);
    assert.equal(post.includes("status, password:"), true);
    assert.equal(post.includes("voiceConsentAt"), false);
  });
});
