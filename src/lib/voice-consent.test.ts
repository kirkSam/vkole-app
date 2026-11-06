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
  VOICE_NOT_NOW,
  VOICE_SETTINGS_LABEL,
  keepVoiceConsent,
  mayListen,
  recordVoiceConsent,
} from "./voice-consent.ts";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("parent voice consent", () => {
  it("does not listen unless the parent allowed it, and a turn-off stops that at once", () => {
    assert.equal(mayListen(null), false);
    assert.equal(mayListen({ voiceConsent: "not-asked" }), false);
    assert.equal(mayListen({ voiceConsent: "declined" }), false);
    const on = recordVoiceConsent("allowed", new Date("2026-11-06T18:00:00.000Z"));
    assert.equal(mayListen(on), true);
    assert.equal(on.voiceConsentAt, "2026-11-06T18:00:00.000Z");
    assert.equal(on.voiceConsentVersion, VOICE_CONSENT_VERSION);
    const off = recordVoiceConsent("declined", new Date("2026-11-06T18:05:00.000Z"));
    assert.equal(mayListen(off), false);
    assert.equal(off.voiceConsentAt, "2026-11-06T18:05:00.000Z");
    assert.equal(off.voiceConsentVersion, "v1");
    assert.equal(mayListen(keepVoiceConsent(on, { voiceConsent: "declined", voiceConsentAt: off.voiceConsentAt, voiceConsentVersion: "v1" })), false);
  });

  it("keeps a stored answer when the website omits the field, and lets an explicit website answer win", () => {
    const stored = recordVoiceConsent("allowed", new Date("2026-11-06T18:00:00.000Z"));
    assert.deepEqual(keepVoiceConsent(stored, {}), stored);
    assert.equal(keepVoiceConsent(undefined, {}).voiceConsent, "not-asked");
    const website = recordVoiceConsent("declined", new Date("2026-11-06T19:00:00.000Z"));
    assert.deepEqual(keepVoiceConsent(stored, website), website);
  });

  it("shows the consent question only to the parent, and the child card never asks it", () => {
    assert.equal(VOICE_CONSENT_TITLE, "Voice answers");
    assert.equal(VOICE_ALLOW, "Allow voice answers");
    assert.equal(VOICE_NOT_NOW, "Not now");
    assert.equal(VOICE_SETTINGS_LABEL, "Voice answers: On / Off");
    assert.equal(PARENT_NEEDS_VOICE, "A parent needs to turn on voice answers. Until then, an adult marks each answer.");
    assert.equal(PHONE_CANNOT_HEAR, "This phone cannot hear the student. Android 13 or newer lets the app hear the student. An adult evaluates and marks each answer.");
    assert.equal(LISTENING_BEST, "Listening works best on Android 13 or newer.");
    assert.equal(VOICE_CONSENT_TEXT.includes("We do not record or save your child's voice."), true);
    const home = source("../routes/index.tsx");
    const session = source("../routes/session.$id.tsx");
    const consent = source("../components/voice-answers.tsx");
    assert.equal(home.includes("VoiceAnswers"), true);
    assert.equal(home.includes("LISTENING_BEST"), true);
    assert.equal(consent.includes("VOICE_CONSENT_TEXT"), true);
    assert.equal(session.includes("Allow voice answers"), false);
    assert.equal(session.includes(VOICE_CONSENT_TEXT), false);
    assert.equal(session.includes("voiceAllowed"), true);
    for (const path of ["../components/sight-word-stage.tsx", "../components/phonemic-stage.tsx", "../components/alphabet-stage.tsx"]) {
      const stage = source(path);
      assert.equal(stage.includes("Allow voice answers"), false, path);
      assert.equal(stage.includes(VOICE_CONSENT_TEXT), false, path);
      assert.equal(stage.includes("PARENT_NEEDS_VOICE"), true, path);
    }
    const api = source("./voice-consent-api.ts");
    assert.equal(api.includes("accountPasswordMatches"), true);
    assert.equal(api.includes("/api/account/voice-consent") || source("./school-account.server.ts").includes("/api/account/voice-consent"), true);
    assert.equal(source("./school-account.server.ts").includes('voiceConsent: "/api/account/voice-consent"'), true);
  });
});
