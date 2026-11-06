/**
 * The password the parent just typed to sign in.
 * It stays in this module only. It is not written to the account,
 * and it is not written to session or local storage.
 * A reload or an app restart clears it. The voice-answer screen then asks.
 */
let held = "";

export function holdSignInPassword(password: string): void {
  held = password;
}

export function peekSignInPassword(): string {
  return held;
}

export function clearSignInPassword(): void {
  held = "";
}
