import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ENGINE_PICKER_ROUTE } from "@/lib/engine-picker";

/**
 * CLAUDE: new route, added as part of the app owning its own parent
 * registration/confirmation. A parent's confirmation-email link points here
 * (`callbackURL` in schoolSignUp's call to Better Auth's own sign-up, in
 * school-auth.ts) -- this app's own page, not the school website's. By the
 * time this page loads, Better Auth has already verified the email and
 * signed the parent in (`autoSignInAfterVerification: true` in
 * auth/server.ts). Reuses the existing `/?open=1` mechanism (already built
 * for the "re-enter the app" flow) to skip the splash/teletype screens and
 * land directly on the learning engines, matching "confirmed, then sent on
 * to the engines."
 */
export const Route = createFileRoute("/confirmed")({ component: Confirmed });

function Confirmed() {
  useEffect(() => {
    const id = window.setTimeout(() => window.location.assign(ENGINE_PICKER_ROUTE), 2500);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-[#05070d] px-6 text-center text-[#f4f1ea]">
      <h1 className="font-display text-2xl font-semibold">Email confirmed</h1>
      <p className="max-w-md text-[#cfc6b8]">
        Your email is confirmed and your free week has started. Opening the learning engines now.
      </p>
      <a
        href={ENGINE_PICKER_ROUTE}
        className="mt-2 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#e6c65c] px-6 text-base font-semibold text-[#1c1408]"
      >
        Open the engines
      </a>
    </main>
  );
}
