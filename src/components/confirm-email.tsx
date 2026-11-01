import { useState } from "react";
import { Shell } from "@/components/shell";
import { WebsiteVisit } from "@/components/website-visit";
import { CONFIRM_EMAIL_TITLE } from "@/lib/school-account";
import { checkEmailConfirmed, resendSchoolConfirmation } from "@/lib/school-auth";

/** Shown until the parent confirms the email. The pay wall is a different screen. */
export function ConfirmEmailLock() {
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [checking, setChecking] = useState(false);
  return (
    <Shell>
      <h1 className="font-display text-3xl text-ink">{CONFIRM_EMAIL_TITLE}</h1>
      <p className="mt-4 text-lg text-ink">Open the email we sent. Press the confirm button in that message.</p>
      <p className="mt-3 text-lg text-ink">Then come back here and press the button below.</p>
      <p className="mt-3 text-lg text-ink">Your free week is 168 hours. It starts when you confirm the email.</p>
      <button
        type="button"
        disabled={checking}
        className="mt-6 min-h-12 w-full rounded-xl bg-accent px-4 text-base font-semibold text-accent-ink disabled:opacity-50"
        onClick={() => {
          setChecking(true);
          setNote("");
          void checkEmailConfirmed()
            .then((result) => {
              if (result.ok && result.confirmed) {
                window.location.reload();
                return;
              }
              setNote(result.ok ? "Not confirmed yet. Open the email and press the confirm button first." : result.message);
            })
            .catch(() => setNote("Could not reach the school website. Try again."))
            .finally(() => setChecking(false));
        }}
      >
        {checking ? "Checking…" : "I confirmed — continue"}
      </button>
      <button
        type="button"
        disabled={pending}
        className="mt-3 min-h-12 w-full rounded-xl border border-line bg-paper px-4 text-base text-ink disabled:opacity-50"
        onClick={() => {
          setPending(true);
          setNote("");
          void resendSchoolConfirmation()
            .then((result) => setNote(result.message))
            .catch(() => setNote("The email could not be sent. Try again."))
            .finally(() => setPending(false));
        }}
      >
        Send the email again
      </button>
      {note ? <p className="mt-3 text-base text-ink">{note}</p> : null}
      <WebsiteVisit />
    </Shell>
  );
}
