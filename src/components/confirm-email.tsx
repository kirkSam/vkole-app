import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { WebsiteVisit } from "@/components/website-visit";
import { checkEmailConfirmed, resendSchoolConfirmation } from "@/lib/school-auth";
import { noteAccount } from "@/lib/ledger";

/** Shown until the parent confirms the email. The pay wall is a different screen. */
export function ConfirmEmailLock() {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let live = true;
    void noteAccount()
      .then((account) => {
        if (live) setEmail(account.email);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  return (
    <Shell>
      <h1 className="font-display text-3xl text-ink">Check your email</h1>
      <p className="mt-4 text-lg text-ink">{email ? `We sent an email to ${email}.` : "We sent an email."}</p>
      <p className="mt-3 text-lg text-ink">Open it and tap the link inside. Then come back here.</p>
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
              setNote(result.ok ? "Not confirmed yet. Open the email and tap the link first." : result.message);
            })
            .catch(() => setNote("Could not reach the school website. Try again."))
            .finally(() => setChecking(false));
        }}
      >
        {checking ? "Checking…" : "I tapped the link — continue"}
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
        {pending ? "Sending…" : "Send the email again"}
      </button>
      <p className="mt-3 text-base text-ink">Not there? Check your spam folder. It can take a few minutes.</p>
      {note ? <p className="mt-3 text-base text-ink">{note}</p> : null}
      <WebsiteVisit />
    </Shell>
  );
}
