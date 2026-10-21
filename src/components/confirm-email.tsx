import { useState } from "react";
import { Shell } from "@/components/shell";
import { CONFIRM_EMAIL_TITLE } from "@/lib/school-account";
import { resendSchoolConfirmation } from "@/lib/school-auth";

/** Shown until the parent confirms the email. The pay wall is a different screen. */
export function ConfirmEmailLock() {
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <Shell>
      <h1 className="font-display text-3xl text-ink">{CONFIRM_EMAIL_TITLE}</h1>
      <p className="mt-4 text-lg text-ink">Open the email we sent. Press the confirm button in that message.</p>
      <p className="mt-3 text-lg text-ink">Then come back here and sign in.</p>
      <p className="mt-3 text-lg text-ink">Your free week is 168 hours. It starts when you confirm the email.</p>
      <button
        type="button"
        disabled={pending}
        className="mt-6 min-h-12 w-full rounded-xl bg-accent px-4 text-base font-semibold text-accent-ink disabled:opacity-50"
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
    </Shell>
  );
}
