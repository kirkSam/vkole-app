import { createServerFn } from "@tanstack/react-start";

/**
 * Page load. Clears stored accounts once, and signs this browser out once.
 * Later loads see the version flag and leave a new sign-in alone.
 */
export const applyLoadAccountWipe = createServerFn({ method: "GET" }).handler(async () => {
  const { ensureStoredAccountsWiped, signOutIfWipeCookieStale } = await import("./account-wipe.server.ts");
  await ensureStoredAccountsWiped();
  await signOutIfWipeCookieStale();
  return { ok: true as const };
});
