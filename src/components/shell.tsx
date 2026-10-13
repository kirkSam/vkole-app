import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/brand";
import { authClient, authEnabled, signOut } from "@/lib/auth/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { notifyParentSignedOut } from "@/lib/climbs";
import { markChoosingAccount } from "@/lib/account-choice";

function leaveForNewAccount() {
  window.location.assign("/?new=1");
}

function ParentAccount() {
  const user = useCurrentUser();
  const [signingOut, setSigningOut] = useState(false);
  if (!user) return null;
  const label = user.displayName ?? user.primaryEmail ?? "Parent";
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-sm font-medium text-accent-ink">
        {label.charAt(0).toUpperCase()}
      </span>
      <span className="max-w-36 truncate text-sm text-ink">{label}</span>
      {authEnabled ? (
        <button
          type="button"
          disabled={signingOut}
          onClick={() => {
            setSigningOut(true);
            markChoosingAccount();
            const mailed = Promise.race([
              notifyParentSignedOut()
                .then((letter) => {
                  try {
                    sessionStorage.setItem("vkole-parent-logout", JSON.stringify(letter));
                  } catch {
                    /* storage may be unavailable */
                  }
                })
                .catch(() => undefined),
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
                leaveForNewAccount();
              }
            });
          }}
          className="text-sm text-muted underline-offset-4 hover:underline disabled:opacity-60"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      ) : null}
    </div>
  );
}

export function Shell({ children, onSplash }: { children: ReactNode; onSplash?: () => void }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex items-center justify-between gap-3 border-b border-line pb-4">
        {onSplash ? (
          <button type="button" onClick={onSplash} className="text-left font-display text-lg leading-tight tracking-wide text-ink sm:text-xl">
            {APP_NAME}
          </button>
        ) : (
          <Link to="/" className="text-left font-display text-lg leading-tight tracking-wide text-ink sm:text-xl">
            {APP_NAME}
          </Link>
        )}
        <ParentAccount />
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <Shell>
      <p className="font-display text-lg leading-tight text-ink">{APP_NAME}</p>
      <div className="mt-4 h-40 animate-pulse rounded-2xl bg-line" />
    </Shell>
  );
}
