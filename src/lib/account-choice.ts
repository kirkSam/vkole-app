/** While this cookie is set, the preview sign-in does not replace a parent the tester chose. */
export const CHOOSE_ACCOUNT_COOKIE = "vkole_choose_account";

export function markChoosingAccount(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${CHOOSE_ACCOUNT_COOKIE}=1; Path=/; Max-Age=2592000; SameSite=Lax`;
}

export function requestHoldsAccountChoice(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  return cookieHeader.split(";").some((part) => part.trim().startsWith(`${CHOOSE_ACCOUNT_COOKIE}=`));
}
