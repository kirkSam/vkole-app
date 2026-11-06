/** Parent decision for spoken answers. One answer covers the app and the website. */

export const VOICE_CONSENT_VERSION = "v1";

export const VOICE_CONSENT_TITLE = "Voice answers";

export const VOICE_CONSENT_TEXT =
  "Some VKOLE engines let your child answer out loud. When your child answers, the microphone listens for a few seconds, turns the answer into text, and then stops. We do not record or save your child's voice. On newer Android phones, this happens on the phone. In a web browser and on older Android phones, Google's speech service turns the answer into text. You can turn voice answers off at any time. If voice answers are off, an adult marks each answer.";

export const VOICE_ALLOW = "Allow voice answers";

export const VOICE_NOT_NOW = "Not now";

export const PARENT_NEEDS_VOICE =
  "A parent needs to turn on voice answers. Until then, an adult marks each answer.";

export const PHONE_CANNOT_HEAR =
  "This phone cannot hear the student. Android 13 or newer lets the app hear the student. An adult evaluates and marks each answer.";

export const LISTENING_BEST = "Listening works best on Android 13 or newer.";

export const VOICE_SETTINGS_LABEL = "Voice answers: On / Off";

export type VoiceConsent = "allowed" | "declined" | "not-asked";

export type VoiceConsentRecord = {
  voiceConsent: VoiceConsent;
  voiceConsentAt: string | null;
  voiceConsentVersion: string | null;
};

export function mayListen(record: { voiceConsent?: VoiceConsent | null } | null | undefined): boolean {
  return record?.voiceConsent === "allowed";
}

/** Not now is a decline. The date, time, and wording version are stored with that answer. */
export function recordVoiceConsent(choice: "allowed" | "declined", now: Date): VoiceConsentRecord {
  return {
    voiceConsent: choice,
    voiceConsentAt: now.toISOString(),
    voiceConsentVersion: VOICE_CONSENT_VERSION,
  };
}

export function parseVoiceConsent(value: unknown): VoiceConsent | undefined {
  if (value === "allowed" || value === "declined" || value === "not-asked") return value;
  return undefined;
}

/**
 * The website wins when it sends an answer. A missing field keeps the answer
 * already stored here, so an older website does not wipe a decision.
 */
export function keepVoiceConsent(
  stored: Partial<VoiceConsentRecord> | null | undefined,
  incoming: Partial<VoiceConsentRecord> | null | undefined,
): VoiceConsentRecord {
  const sent = parseVoiceConsent(incoming?.voiceConsent);
  if (sent) {
    return {
      voiceConsent: sent,
      voiceConsentAt: typeof incoming?.voiceConsentAt === "string" ? incoming.voiceConsentAt : null,
      voiceConsentVersion: sent === "not-asked" ? null : incoming?.voiceConsentVersion ?? null,
    };
  }
  const kept = parseVoiceConsent(stored?.voiceConsent);
  if (kept) {
    return {
      voiceConsent: kept,
      voiceConsentAt: typeof stored?.voiceConsentAt === "string" ? stored.voiceConsentAt : null,
      voiceConsentVersion: stored?.voiceConsentVersion ?? null,
    };
  }
  return { voiceConsent: "not-asked", voiceConsentAt: null, voiceConsentVersion: null };
}
