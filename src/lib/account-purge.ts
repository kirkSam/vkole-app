/**
 * Client-safe account cleanup. No secret, no database, no network call.
 * The school website is the account book. This module only forgets the
 * copies this app and this device still keep.
 */
import { SCHOOL_ACCOUNT_GONE_MESSAGE } from "./school-account.ts";

export { SCHOOL_ACCOUNT_GONE_MESSAGE };

/** Body field the purge route requires so a stray POST cannot wipe rows. */
export const PURGE_CONFIRM = "delete-all-accounts";

/**
 * Set after the website says the signed-in account is gone, so the next
 * page shows sign-in instead of calling the website again with the old cookie.
 */
export const ACCOUNT_GONE_FLAG = "vkole-account-gone";

/**
 * Set when the website rejects the account token. The sign-in screen shows
 * the website's sentence, then the flag is removed.
 */
export const SIGN_IN_AGAIN_NOTE = "vkole-sign-in-again";

/** Invisible marker so a token rejection can send the parent back to sign-in. */
export const SIGN_IN_AGAIN_MARK = "\u2060\u2060\u2060";

export function signInAgainError(website: string): string {
  const text = website.trim() || "Sign in again.";
  return `${text}${SIGN_IN_AGAIN_MARK}`;
}

export function websiteErrorOnScreen(message: string): string {
  return message.split(SIGN_IN_AGAIN_MARK).join("").trim();
}

/** Device keys that hold a sign-in or a cached level/session hint. */
export const STALE_STORAGE_PREFIXES = ["vkole-", "grok-auth."] as const;

/**
 * Cookies that keep a parent signed in on this origin.
 * HttpOnly session cookies can only be expired by the server.
 */
export const SIGN_IN_COOKIES: { name: string; httpOnly: boolean }[] = [
  { name: "__Host-grok-auth.session_token", httpOnly: true },
  { name: "__Host-grok-auth.session_data", httpOnly: true },
  { name: "__Host-grok-auth.account_data", httpOnly: true },
  { name: "__Host-grok-auth.dont_remember", httpOnly: true },
  { name: "__Host-grok_gate_session", httpOnly: false },
  { name: "vkole_choose_account", httpOnly: false },
];

export function matchingStaleKeys(keys: Iterable<string>): string[] {
  return [...keys].filter((key) =>
    STALE_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix)),
  );
}

export function expiredCookie(name: string): string {
  // `__Host-` cookies are only cleared by a Secure cookie with Path=/.
  const secure = name.startsWith("__Host-") ? "; Secure" : "";
  return `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

type KeyStore = {
  length: number;
  key(index: number): string | null;
  removeItem(key: string): void;
};

function keysOf(store: KeyStore): string[] {
  const keys: string[] = [];
  for (let i = 0; i < store.length; i += 1) {
    const key = store.key(i);
    if (key) keys.push(key);
  }
  return keys;
}

/** Drop cached sign-in and level keys from one storage bucket. Returns the keys removed. */
export function clearKeyStore(store: KeyStore | null): string[] {
  if (!store) return [];
  const stale = matchingStaleKeys(keysOf(store));
  for (const key of stale) store.removeItem(key);
  return stale;
}

/**
 * Forget device copies of the sign-in. Does not call the server and does not
 * redirect. HttpOnly cookies stay until the server expires them.
 */
export function clearStaleDeviceSignIn(): void {
  if (typeof window === "undefined") return;
  try {
    clearKeyStore(window.localStorage);
  } catch {
    /* storage unavailable */
  }
  try {
    clearKeyStore(window.sessionStorage);
  } catch {
    /* storage unavailable */
  }
  try {
    for (const cookie of SIGN_IN_COOKIES) {
      if (cookie.httpOnly) continue;
      document.cookie = expiredCookie(cookie.name);
    }
  } catch {
    /* document unavailable */
  }
}

function errorText(err: unknown, depth = 0): string {
  if (!err || depth > 3) return "";
  if (typeof err === "string") return err;
  if (typeof err !== "object") return "";
  const row = err as { message?: unknown; cause?: unknown; data?: unknown };
  return `${row.message ?? ""} ${errorText(row.cause, depth + 1)} ${errorText(row.data, depth + 1)}`;
}

export function isAccountGoneError(err: unknown): boolean {
  return errorText(err).includes(SCHOOL_ACCOUNT_GONE_MESSAGE);
}

export function isSignInAgainError(err: unknown): boolean {
  return errorText(err).includes(SIGN_IN_AGAIN_MARK);
}

/** Ask Better Auth to drop the HttpOnly cookie, then stay on this page. */
export async function clearStaleSignIn(): Promise<void> {
  clearStaleDeviceSignIn();
  if (typeof window === "undefined") return;
  try {
    const { authClient } = await import("./auth/client");
    await authClient.signOut();
  } catch {
    /* The cached keys are already gone. The form can stay. */
  }
}

/**
 * The signed-in account is gone on the website. Drop device copies, remember
 * that for this tab, and leave for a fresh sign-in.
 */
/**
 * The website token was rejected or has expired. Drop it, keep the website's
 * sentence for the sign-in screen, and leave the signed-in app.
 */
export async function leaveForSignIn(message: string): Promise<void> {
  clearStaleDeviceSignIn();
  if (typeof window === "undefined") return;
  const note = websiteErrorOnScreen(message);
  try {
    if (note) window.sessionStorage.setItem(SIGN_IN_AGAIN_NOTE, note);
  } catch {
    /* storage unavailable */
  }
  try {
    const { signOut } = await import("./auth/client");
    await signOut("/login");
  } catch {
    window.location.assign("/login");
  }
}

export async function leaveStaleSignIn(): Promise<void> {
  clearStaleDeviceSignIn();
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(ACCOUNT_GONE_FLAG, "1");
  } catch {
    /* storage unavailable */
  }
  try {
    const { signOut } = await import("./auth/client");
    await signOut("/?new=1");
  } catch {
    window.location.assign("/?new=1");
  }
}
