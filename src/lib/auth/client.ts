import { Capacitor } from "@capacitor/core";
import { createAuthClient } from "better-auth/react";
import { runSignOut } from "../../../scripts/sign-out-plan.mjs";

// CLAUDE: true only inside the Capacitor native shell (not the web app, not
// the live preview). Used below so the native build keeps calling this
// app's own backend and keeps its sign-in across app restarts, while every
// other build keeps today's exact behavior.
const isNativeApp = Capacitor.isNativePlatform();

/**
 * Better Auth client for this React SPA (browser-side).
 *
 * Talks to this app's OWN Better Auth at same-origin `/api/auth/*`. In the live
 * preview the app is an embedded iframe with PARTITIONED cookies, so a stored
 * bearer token is sent when present. The `onRequest` hook attaches that token;
 * when deployed (cookie auth) no token is stored, so nothing changes. Parents
 * sign in with the school website email and password. Google and X are not offered.
 *
 * To sign out call `signOut()` below, NOT `authClient.signOut()`: the raw call
 * leaves the bearer token in place, and `onRequest` keeps re-attaching it, so
 * the visitor stays signed in.
 */
export const authClient = createAuthClient({
  // CLAUDE: the bundled native app's screens load from a local, fixed
  // placeholder address (see `native-app.ts`), not from this app's own
  // backend -- so unlike every other build, it must be told explicitly
  // where to send sign-in/session calls instead of relying on "wherever
  // this page was loaded from". `__APP_ORIGIN__` is the same
  // `BETTER_AUTH_URL` value `auth/server.ts` already uses, injected at
  // build time (see `vite.config.ts`).
  ...(isNativeApp && __APP_ORIGIN__ ? { baseURL: __APP_ORIGIN__ } : {}),
  fetchOptions: {
    onRequest(ctx) {
      const token = getBearerToken();
      if (token) ctx.headers.set("Authorization", `Bearer ${token}`);
      return ctx;
    },
  },
});

/**
 * True when sign-in UI should be shown — i.e. whenever `VITE_AUTH_ENABLED` is
 * not `"false"`. The shipped template sets it to `"false"`
 * (`.grok/app-env.json`), which selects the dev user (see `use-current-user`);
 * with the key removed, sign-in is real in preview (baked preview client) and
 * when deployed (injected per-app client).
 */
export const authEnabled = import.meta.env.VITE_AUTH_ENABLED !== "false";

// ── Live-preview bearer token ────────────────────────────────────────────────
// The embedded preview iframe has partitioned cookies, so we keep the session's
// bearer token in sessionStorage and attach it to every Better Auth request (and
// to server functions, via `@/lib/auth/middleware`). Empty everywhere except the
// preview after a popup sign-in, so the cookie path is untouched elsewhere.
const BEARER_KEY = "grok-auth.bearer-token";

// CLAUDE: `sessionStorage` clears when a browser tab closes, which is the
// right behavior for the live preview (a new preview session should not
// inherit an old one's sign-in). A native app isn't a "tab" though --
// quitting and reopening it should keep the parent signed in, same as any
// other app -- so the native build keeps this same token in `localStorage`
// instead, which survives an app restart.
function bearerStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return isNativeApp ? window.localStorage : window.sessionStorage;
}

/** The stored bearer token (preview or native app), or null. */
export function getBearerToken(): string | null {
  try {
    return bearerStorage()?.getItem(BEARER_KEY) ?? null;
  } catch {
    return null;
  }
}

function setBearerToken(token: string | null): void {
  try {
    const storage = bearerStorage();
    if (!storage) return;
    if (token) storage.setItem(BEARER_KEY, token);
    else storage.removeItem(BEARER_KEY);
  } catch {
    /* storage unavailable — ignore */
  }
}

/** Keep this app's session for the live preview, where the cookie is partitioned. */
export function rememberAppSession(token: string): void {
  const value = token.trim();
  if (!value) return;
  setBearerToken(value);
}

/**
 * The sandbox live preview runs this app inside an iframe on a `*.grok-sandbox.com`
 * host, where a full-page redirect to the broker can't work — so sign-in uses a
 * popup there and a normal redirect everywhere else.
 */
function inLivePreview(): boolean {
  return (
    typeof window !== "undefined" &&
    window.location.hostname.endsWith(".grok-sandbox.com")
  );
}

/**
 * Sign out of THIS app's local session, clear the preview token, then redirect.
 *
 * Use this, never `authClient.signOut()` — see the note on `authClient`.
 * Sequencing lives in `scripts/sign-out-plan.mjs` so it can be unit-tested.
 *
 * **Rejects when deployed if the server never confirms.** There the session is
 * an HttpOnly cookie only the server can clear, so redirecting anyway would
 * report a sign-out that did not happen. `<UserButton />` handles that for you;
 * a hand-rolled control must catch it and let the visitor retry. In the live
 * preview the local clear is sufficient, so it always resolves.
 */
export async function signOut(redirectTo = "/"): Promise<void> {
  await runSignOut({
    livePreview: inLivePreview(),
    hasBearer: Boolean(getBearerToken()),
    // Better Auth resolves with `{ error }` instead of rejecting, so surface a
    // failed response as a rejection for the sequence to act on.
    requestSignOut: async () => {
      const { error } = await authClient.signOut();
      if (error) throw new Error(error.message ?? "Sign-out failed");
    },
    clearToken: () => setBearerToken(null),
    redirect: () => {
      window.location.href = redirectTo;
    },
  });
}
