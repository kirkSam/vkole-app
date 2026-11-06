/**
 * The password the parent just typed to sign in.
 * It is not written to the account.
 * Sign-in reloads the page, so this one value crosses that load in
 * sessionStorage and is removed as soon as the next page reads it.
 * After that it lives only in memory. The first voice-answer save clears it.
 * A restart that does not still have this page's copy must ask again.
 */
const BRIDGE_KEY = "vkole-voice-password";
const BRIDGE_MAX_MS = 10 * 60 * 1000;

let held = "";

function bridge(): Storage | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage;
}

export function holdSignInPassword(password: string): void {
  held = password;
  try {
    bridge()?.setItem(BRIDGE_KEY, JSON.stringify({ password, at: Date.now() }));
  } catch {
    /* The memory copy still covers this page. */
  }
}

/** Read the sign-in password. The reload bridge is deleted on this read. */
export function peekSignInPassword(): string {
  if (!held) {
    try {
      const store = bridge();
      const raw = store?.getItem(BRIDGE_KEY) ?? "";
      store?.removeItem(BRIDGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { password?: unknown; at?: unknown };
        const password = typeof parsed.password === "string" ? parsed.password : "";
        const at = typeof parsed.at === "number" ? parsed.at : 0;
        if (password && Date.now() - at <= BRIDGE_MAX_MS) held = password;
      }
    } catch {
      held = "";
    }
  }
  return held;
}

export function clearSignInPassword(): void {
  held = "";
  try {
    bridge()?.removeItem(BRIDGE_KEY);
  } catch {
    /* already gone */
  }
}
