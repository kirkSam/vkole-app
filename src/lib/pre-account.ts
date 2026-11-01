import { WEBSITE_PARENTS } from "@/lib/website-visit";

/** Same wait as the school site splash before it leaves the picture. */
export const SPLASH_ADVANCE_MS = 7000;

/**
 * The live Parents page (Pricing & Pay) has no id on the $9 or $79 card.
 * Those two prices share one card under #pay. The website should add these ids.
 */
export const PAY_MONTH_ANCHOR = "plan-9";
export const PAY_YEAR_ANCHOR = "plan-79";

export const PAY_MONTH_URL = `${WEBSITE_PARENTS}#${PAY_MONTH_ANCHOR}`;
export const PAY_YEAR_URL = `${WEBSITE_PARENTS}#${PAY_YEAR_ANCHOR}`;

/** Yellow fill, dark text. Used for Create account on the sign-in page. */
export const CREATE_ACCOUNT_BUTTON_CLASS =
  "min-h-11 w-full rounded-xl bg-[#e6c65c] px-4 text-base font-semibold text-[#1c1408]";

/** The 7 second timer and the first tap share this. The second call does not advance. */
export function claimSplashAdvance(alreadyClaimed: boolean): boolean {
  return !alreadyClaimed;
}
