import { useState } from "react";
import { saveVoiceConsent } from "@/lib/voice-consent-api";
import {
  VOICE_ALLOW,
  VOICE_CONSENT_TEXT,
  VOICE_CONSENT_TITLE,
  VOICE_NOT_NOW,
  VOICE_SETTINGS_LABEL,
  type VoiceConsent,
} from "@/lib/voice-consent";

/** Parent only. The child screens do not render this. */
export function VoiceAnswers({
  pending,
  onChoose,
}: {
  pending: boolean;
  onChoose: (choice: "allowed" | "declined") => void;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-line bg-paper p-5" aria-label={VOICE_CONSENT_TITLE}>
      <h2 className="font-display text-2xl text-ink">{VOICE_CONSENT_TITLE}</h2>
      <p className="mt-2 text-ink">{VOICE_CONSENT_TEXT}</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={pending}
          onClick={() => onChoose("allowed")}
          className="min-h-11 flex-1 rounded-xl bg-accent px-5 font-semibold text-accent-ink disabled:opacity-50"
        >
          {VOICE_ALLOW}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => onChoose("declined")}
          className="min-h-11 flex-1 rounded-xl border border-ink bg-paper px-5 font-semibold text-ink disabled:opacity-50"
        >
          {VOICE_NOT_NOW}
        </button>
      </div>
    </section>
  );
}

/** Behind the account password. Off takes effect as soon as the save returns. */
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
  const [note, setNote] = useState("");
  const on = consent === "allowed";

  function choose(choice: "allowed" | "declined") {
    if (password.length < 8) {
      setError("Enter the password of the account that registered.");
      return;
    }
    setPending(true);
    setError("");
    setNote("");
    void saveVoiceConsent({ data: { choice, password } })
      .then((saved) => {
        onChanged(saved.voiceConsent);
        setPassword("");
        if (!saved.shared) setNote("Saved on this app. The website has not stored voice answers yet.");
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Voice answers could not be saved.");
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
      {note ? <p className="mt-2 text-sm text-ink">{note}</p> : null}
    </section>
  );
}
