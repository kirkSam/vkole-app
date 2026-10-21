import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { APP_NAME, SCHOOL_EMAIL, SCHOOL_SITE } from "@/lib/brand";
import { markZpdReturn } from "@/lib/zpd-info";
import { SUBJECTS, engineNavLabel, enginePickLabel, type SubjectId } from "@/lib/climb-rules";
import { PASTEL_NAV } from "@/lib/pastel-nav";
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
          className="inline-flex min-h-11 items-center px-2 text-sm text-muted underline-offset-4 hover:underline disabled:opacity-60"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      ) : null}
    </div>
  );
}

export function Shell({ children, onSplash }: { children: ReactNode; onSplash?: () => void }) {
  return (
    <div className="app-shell mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-col items-stretch gap-3 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
        {onSplash ? (
          <button
            type="button"
            onClick={onSplash}
            className="vkole-nav text-left font-display text-lg leading-tight tracking-wide text-ink sm:text-xl"
          >
            {APP_NAME}
          </button>
        ) : (
          <Link
            to="/"
            className="vkole-nav text-left font-display text-lg leading-tight tracking-wide text-ink sm:text-xl"
          >
            {APP_NAME}
          </Link>
        )}
        <ParentAccount />
      </header>
      <EngineNav />
      <div className="flex-1">{children}</div>
      <SchoolFooter />
    </div>
  );
}

function EngineNav() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const parentScreen = !path.startsWith("/session");
  return (
    <nav className={PASTEL_NAV ? "pastel-nav mb-5 flex flex-wrap gap-2" : "mb-5 flex flex-wrap gap-2"} aria-label="VKOLE engines">
      {SUBJECTS.map((subject) => (
        <a
          key={subject.id}
          href={`/#engine-${subject.id}`}
          data-engine={subject.id}
          className="vkole-nav text-left font-display text-base leading-tight tracking-wide text-ink"
        >
          {engineNavLabel(subject.id)}
        </a>
      ))}
      <Link
        to="/zpd"
        data-engine="zpd"
        onClick={(event) => {
          if (
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey ||
            event.button !== 0
          ) {
            return;
          }
          try {
            markZpdReturn(window.location.pathname, sessionStorage);
          } catch {
            /* storage may be unavailable */
          }
        }}
        className="vkole-nav vkole-nav-zpd text-left font-display text-base tracking-wide text-ink"
      >
        <span>Vygotsky ZPD</span>
        <small>Zone of Proximal Development</small>
      </Link>
      {parentScreen ? (
        <Link to="/practice" data-engine="practice" className="vkole-nav text-left font-display text-base tracking-wide text-ink">
          Free Math Practice
        </Link>
      ) : null}
    </nav>
  );
}

export function EnginePicks() {
  return (
    <div className={PASTEL_NAV ? "office-engine-picks pastel-nav" : "office-engine-picks"} role="group" aria-label="Engine picks">
      {SUBJECTS.map((subject) => (
        <a key={subject.id} href={`/#engine-${subject.id}`} data-engine={subject.id} className="office-engine-pick">
          {enginePickLabel(subject.id)}
        </a>
      ))}
    </div>
  );
}

export function EngineRail({ current }: { current: SubjectId }) {
  return (
    <nav className={PASTEL_NAV ? "engine-rail pastel-nav" : "engine-rail"} aria-label="Engines">
      {SUBJECTS.map((subject) => (
        <a
          key={subject.id}
          href={`/#engine-${subject.id}`}
          data-engine={subject.id}
          className={subject.id === current ? "is-current" : undefined}
          aria-current={subject.id === current ? "true" : undefined}
        >
          {enginePickLabel(subject.id)}
        </a>
      ))}
    </nav>
  );
}

function SchoolFooter() {
  return (
    <footer className="school-footer">
      <div className="school-footer-inner">
        <blockquote>
          <p>
            “What is in the zone of proximal development today will be the actual developmental
            level tomorrow.”
          </p>
          <footer>Lev Vygotsky, Mind in Society, 1978</footer>
        </blockquote>
        <p className="school-footer-name">ADOL with {APP_NAME}</p>
        <p className="school-footer-line">
          An online academy for homeschool parents and parents guiding after-school study. Each
          child has a private office. Assignments stay within reach, and just far enough to require
          a stretch.
        </p>
        <nav className="school-footer-links" aria-label="School">
          <a href={SCHOOL_SITE}>Home</a>
          <a href={`${SCHOOL_SITE}/parents`}>Parents</a>
          <a href={`${SCHOOL_SITE}/contact`}>Contact</a>
          <a href={`${SCHOOL_SITE}/privacy`}>Privacy</a>
          <a href={`${SCHOOL_SITE}/terms`}>Terms</a>
        </nav>
        <p className="school-footer-meta">
          <a href={`mailto:${SCHOOL_EMAIL}`}>{SCHOOL_EMAIL}</a>
          <span>© 2026 ADOL with {APP_NAME}</span>
        </p>
      </div>
    </footer>
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
