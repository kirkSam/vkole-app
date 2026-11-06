/** Parent decision for spoken answers. One answer covers the app and the website. */

export const VOICE_CONSENT_VERSION = "v2" as const;

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

export type VoiceConsentStatus = "allowed" | "declined" | "not_asked";

/** The website object. A phone-only copy is not a yes. */
export type VoiceConsent = {
  status: VoiceConsentStatus;
  decidedAt: string | null;
  wordingVersion: typeof VOICE_CONSENT_VERSION | null;
};

export const VOICE_NOT_ASKED: VoiceConsent = {
  status: "not_asked",
  decidedAt: null,
  wordingVersion: null,
};

const listeners = new Set<(value: VoiceConsent) => void>();

/** Tell an open engine at once. This is not stored on the phone. */
export function publishVoiceConsent(value: VoiceConsent): void {
  for (const listener of listeners) listener(value);
}

export function subscribeVoiceConsent(listener: (value: VoiceConsent) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The microphone opens only for a complete allowed decision at wording v2.
 * A saved listen flag, a v1 row, or a missing date does not.
 */
export function voiceAnswersAllowed(consent: VoiceConsent | null | undefined): boolean {
  if (!consent || consent.status !== "allowed") return false;
  if (consent.wordingVersion !== VOICE_CONSENT_VERSION) return false;
  if (typeof consent.decidedAt !== "string" || Number.isNaN(Date.parse(consent.decidedAt))) return false;
  return true;
}

/** Missing, v1, or an incomplete object is not asked. The website's object wins. */
export function parseWebsiteVoiceConsent(value: unknown): VoiceConsent {
  if (!value || typeof value !== "object") return VOICE_NOT_ASKED;
  const row = value as { status?: unknown; decidedAt?: unknown; wordingVersion?: unknown };
  const status = row.status === "allowed" || row.status === "declined" ? row.status : null;
  const decidedAt = typeof row.decidedAt === "string" && !Number.isNaN(Date.parse(row.decidedAt))
    ? new Date(row.decidedAt).toISOString()
    : null;
  if (!status || !decidedAt || row.wordingVersion !== VOICE_CONSENT_VERSION) return VOICE_NOT_ASKED;
  return { status, decidedAt, wordingVersion: VOICE_CONSENT_VERSION };
}
