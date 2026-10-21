export const WEBSITE_HOME = "https://www.dotheimpossible.ai";

export const WEBSITE_VISIT_LINE = "Your account works on our website too, with the same progress.";

export const WEBSITE_VISIT_BUTTON = "Visit dotheimpossible.ai";

const PHONE = /Android|iPhone|iPad|iPod/i;

/** A phone, a tablet, or an installed home-screen app leaves this screen for the system browser. */
export function visitUsesSystemBrowser(userAgent: string, standalone = false): boolean {
  return standalone || PHONE.test(userAgent);
}

/**
 * An Android webview keeps target="_blank" inside the app.
 * The intent opens the system browser instead.
 */
export function androidWebViewIntent(userAgent: string): string | null {
  if (!/Android/i.test(userAgent) || !/; wv\)/.test(userAgent)) return null;
  return `intent://www.dotheimpossible.ai#Intent;scheme=https;action=android.intent.action.VIEW;end`;
}
