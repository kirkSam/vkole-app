import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/brand";
import { subjectMeta, type SubjectId } from "@/lib/climb-rules";
import { authClient, signOut } from "@/lib/auth/client";
import { notifyParentSignedOut } from "@/lib/climbs";
import { markChoosingAccount } from "@/lib/account-choice";

export type EndedReason = "trial" | "month" | "year";
export type StoppedBecause = "cancelled" | "unpaid";

const COPY: Record<EndedReason, { title: string; detail: string }> = {
  trial: {
    title: "7 day trial finished!",
    detail: "Enroll for continued Common Core record keeping and tracking.",
  },
  month: {
    title: "Your month has ended",
    detail: "The $9.00 month is finished. Enroll again to keep the engines open and the Common Core record going.",
  },
  year: {
    title: "Your year has ended",
    detail: "The $79.00 year is finished. Enroll again to keep the engines open and the Common Core record going.",
  },
};

function detailFor(reason: EndedReason, stopped?: StoppedBecause): string {
  if (reason === "month" && stopped === "unpaid") {
    return "The renewal charge for the $9.00 month did not go through. The child’s record is kept. Enroll again to open the engines.";
  }
  if (reason === "year" && stopped === "unpaid") {
    return "The renewal charge for the $79.00 year did not go through. The child’s record is kept. Enroll again to open the engines.";
  }
  if (reason === "month" && stopped === "cancelled") {
    return "This month was cancelled. Access has ended. The child’s record is kept. Enroll again to open the engines.";
  }
  if (reason === "year" && stopped === "cancelled") {
    return "This year was cancelled. Access has ended. The child’s record is kept. Enroll again to open the engines.";
  }
  return COPY[reason].detail;
}

export function TrialFinished({
  subject,
  onSplash,
  wholeApp = false,
  reason = "trial",
  stopped,
}: {
  subject: SubjectId;
  onSplash?: () => void;
  wholeApp?: boolean;
  reason?: EndedReason;
  stopped?: StoppedBecause;
}) {
  const meta = subjectMeta(subject);
  const copy = COPY[reason];
  const [signingOut, setSigningOut] = useState(false);
  return (
    <main className="grid min-h-svh place-items-center bg-[#1c1915] px-6 py-16 text-center text-[#f4f1ea]">
      <div className="w-full max-w-md">
        <p className="text-sm font-semibold tracking-wide text-[#e6c65c]">{wholeApp ? APP_NAME : `VKOLE/${meta.code}`}</p>
        <h1 className="mt-4 font-display text-5xl leading-tight">{copy.title}</h1>
        <p className="mt-5 text-xl leading-snug">
          Continue tracking your child's progress and give your child direct access to Space x.AI Superintelligence
          with VKOLE/ZPD - Space x.AI Integrated Learning Engine.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-[#cfc6b8]">{detailFor(reason, stopped)}</p>
        <Link
          to="/enroll"
          className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#e6c65c] px-4 text-base font-semibold text-[#1c1408]"
        >
          Enroll now
        </Link>
        <button type="button" onClick={onSplash} className="mt-4 min-h-11 text-sm text-[#e6c65c]">
          Splash
        </button>
        <button
          type="button"
          disabled={signingOut}
          className="mt-2 min-h-11 text-sm text-[#e6c65c] disabled:opacity-60"
          onClick={() => {
            setSigningOut(true);
            markChoosingAccount();
            const mailed = Promise.race([
              notifyParentSignedOut().catch(() => undefined),
              new Promise<void>((resolve) => window.setTimeout(resolve, 1200)),
            ]);
            void mailed.finally(async () => {
              await Promise.race([
                authClient.signOut().catch(() => undefined),
                new Promise<void>((resolve) => window.setTimeout(resolve, 1500)),
              ]);
              try {
                await signOut("/?new=1");
              } catch {
                window.location.assign("/?new=1");
              }
            });
          }}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </main>
  );
}
