import { WEBSITE_PARENTS, WEBSITE_VISIT_BUTTON, WEBSITE_VISIT_LINE, androidWebViewIntent } from "@/lib/website-visit";

/**
 * One quiet line and a link. It is not a popup and it does not cover the page.
 * A computer opens a new browser tab. A phone opens the system browser.
 * An Android webview needs an intent so the page does not stay inside the app.
 */
export function WebsiteVisit() {
  return (
    <div className="mt-4">
      <p className="text-base text-ink">{WEBSITE_VISIT_LINE}</p>
      <a
        className="mt-2 inline-flex min-h-12 items-center rounded-xl border border-line bg-paper px-4 text-base font-semibold text-ink"
        href={WEBSITE_PARENTS}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => {
          const intent = androidWebViewIntent(navigator.userAgent);
          if (!intent) return;
          event.preventDefault();
          window.location.assign(intent);
        }}
      >
        {WEBSITE_VISIT_BUTTON}
      </a>
    </div>
  );
}
