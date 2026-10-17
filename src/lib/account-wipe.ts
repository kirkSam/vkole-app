/**
 * One-time device wipe. The school website is the account book. This app
 * still had copies: a preview bearer token, screen notes about the child
 * and the bill, and sign-in cookies. Harmless device settings stay.
 *
 * The version lives in localStorage and, separately, in sessionStorage.
 * localStorage is shared by every tab. sessionStorage is not, and that is
 * where the preview token sits, so each tab has to forget it once.
 */
import { expiredCookie, matchingStaleKeys, SIGN_IN_COOKIES } from "./account-purge.ts";

/** Bump to run the wipe again. Absent or different means it has not run. */
export const ACCOUNT_WIPE_VERSION = "1";

/** localStorage and sessionStorage copy of the version. Not an account key. */
export const ACCOUNT_WIPE_STORAGE_KEY = "app-data-version";

/** Cookie copy. The server can see this on the next request. HttpOnly. */
export const ACCOUNT_WIPE_COOKIE = "app-data-version";

/**
 * Device preferences that are not an account, a child, progress, or a token.
 * `vkole-sw-mic` remembers that this tab may use the microphone for sight words.
 */
export const KEPT_DEVICE_KEYS = ["vkole-sw-mic"] as const;

export function versionIsCurrent(value: string | null | undefined): boolean {
  return value === ACCOUNT_WIPE_VERSION;
}

export function accountDataKeys(keys: Iterable<string>): string[] {
  return matchingStaleKeys(keys).filter(
    (key) => !(KEPT_DEVICE_KEYS as readonly string[]).includes(key),
  );
}

type KeyStore = {
  length: number;
  key(index: number): string | null;
  removeItem(key: string): void;
};

type FlagStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function keysOf(store: KeyStore): string[] {
  const keys: string[] = [];
  for (let i = 0; i < store.length; i += 1) {
    const key = store.key(i);
    if (key) keys.push(key);
  }
  return keys;
}

export function wipeFlagPending(store: FlagStore | null): boolean {
  if (!store) return false;
  try {
    return !versionIsCurrent(store.getItem(ACCOUNT_WIPE_STORAGE_KEY));
  } catch {
    return false;
  }
}

export function markWipeFlag(store: FlagStore | null): void {
  if (!store) return;
  try {
    store.setItem(ACCOUNT_WIPE_STORAGE_KEY, ACCOUNT_WIPE_VERSION);
  } catch {
    /* storage unavailable */
  }
}

/** Drop account, child, progress, and token keys. Returns the keys removed. */
export function wipeAccountKeys(store: KeyStore | null): string[] {
  if (!store) return [];
  let stale: string[] = [];
  try {
    stale = accountDataKeys(keysOf(store));
  } catch {
    return [];
  }
  for (const key of stale) {
    try {
      store.removeItem(key);
    } catch {
      /* storage unavailable */
    }
  }
  return stale;
}

function storageOf(read: () => Storage): Storage | null {
  try {
    return read();
  } catch {
    return null;
  }
}

/** Expire sign-in cookies this page is allowed to write. HttpOnly ones need the server. */
export function clearReadableSignInCookies(): void {
  if (typeof document === "undefined") return;
  try {
    for (const cookie of SIGN_IN_COOKIES) {
      if (cookie.httpOnly) continue;
      document.cookie = expiredCookie(cookie.name);
    }
  } catch {
    /* document unavailable */
  }
}

/**
 * Forget this browser's copied account data once.
 * Call it before anything reads the preview bearer.
 */
export function applyBrowserAccountWipe(): void {
  if (typeof window === "undefined") return;
  const local = storageOf(() => window.localStorage);
  const session = storageOf(() => window.sessionStorage);
  if (wipeFlagPending(local)) {
    wipeAccountKeys(local);
    markWipeFlag(local);
  }
  if (wipeFlagPending(session)) {
    wipeAccountKeys(session);
    clearReadableSignInCookies();
    markWipeFlag(session);
  }
}
