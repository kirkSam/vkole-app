import { useState } from "react";
import { readVoiceConsent, saveVoiceConsent } from "@/lib/voice-consent-api";
import { schoolPassword } from "@/lib/school-account";
import {
  VOICE_ALLOW,
  VOICE_CONSENT_TEXT,
  VOICE_CONSENT_TITLE,
  VOICE_CONSENT_VERSION,
  VOICE_NOT_ASKED,
  VOICE_NOT_NOW,
  VOICE_SETTINGS_LABEL,
  publishVoiceConsent,
  voiceAnswersAllowed,
  type VoiceConsent,
} from "@/lib/voice-consent";

/** Parent only. The child screens do not render this. */
export function VoiceAnswers({
  pending,
  needsPassword,
  onChoose,
}: {
  pending: boolean;
  needsPassword: boolean;
  onChoose: (choice: "allowed" | "declined", password: string) => void;
}) {
  const [password, setPassword] = useState("");

  return (
    <section className="mt-6 rounded-2xl border border-line bg-paper p-5" aria-label={VOICE_CONSENT_TITLE}>
      <h2 className="font-display text-2xl text-ink">{VOICE_CONSENT_TITLE}</h2>
      <p className="mt-2 text-ink">{VOICE_CONSENT_TEXT}</p>
      {needsPassword ? (
        <label className="mt-4 block text-sm text-muted">
          Account password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink"
          />
        </label>
      ) : null}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={pending}
          onClick={() => onChoose("allowed", password)}
          className="min-h-11 flex-1 rounded-xl bg-accent px-5 font-semibold text-accent-ink disabled:opacity-50"
        >
          {VOICE_ALLOW}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => onChoose("declined", password)}
          className="min-h-11 flex-1 rounded-xl border border-ink bg-paper px-5 font-semibold text-ink disabled:opacity-50"
        >
          {VOICE_NOT_NOW}
        </button>
      </div>
    </section>
  );
}

/** Behind the account password. Off takes effect as soon as the parent chooses it. */
export function VoiceAnswerSetting({
  consent,
  onChanged,
}: {
  consent: VoiceConsent;
  onChanged: (consent: VoiceConsent) => void;
}) {
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const on = voiceAnswersAllowed(consent);

  function choose(choice: "allowed" | "declined") {
    const typed = schoolPassword(password);
    if (typed.length < 8) {
      setError("Enter the password of the account that registered.");
      return;
    }
    if (choice === "declined") {
      publishVoiceConsent({ status: "declined", decidedAt: new Date().toISOString(), wordingVersion: VOICE_CONSENT_VERSION });
    }
    setPending(true);
    setError("");
    void saveVoiceConsent({ data: { choice, password: typed } })
      .then((saved) => {
        publishVoiceConsent(saved);
        onChanged(saved);
        setPassword("");
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Voice answers could not be saved.");
        void readVoiceConsent()
          .then((again) => publishVoiceConsent(again))
          .catch(() => publishVoiceConsent(VOICE_NOT_ASKED));
      })
      .finally(() => setPending(false));
  }

  return (
    <section className="mt-6 rounded-2xl border border-line bg-paper p-5" aria-label={VOICE_SETTINGS_LABEL}>
      <h2 className="font-display text-2xl text-ink">{VOICE_SETTINGS_LABEL}</h2>
      <p className="mt-2 text-ink">Voice answers: {on ? "On" : "Off"}</p>
      <label className="mt-3 block text-sm text-muted">
        Account password
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || on}
          onClick={() => choose("allowed")}
          className="min-h-11 rounded-xl bg-accent px-4 font-semibold text-accent-ink disabled:opacity-50"
        >
          On
        </button>
        <button
          type="button"
          disabled={pending || !on}
          onClick={() => choose("declined")}
          className="min-h-11 rounded-xl border border-ink bg-paper px-4 font-semibold text-ink disabled:opacity-50"
        >
          Off
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-ink">{error}</p> : null}
    </section>
  );
}
