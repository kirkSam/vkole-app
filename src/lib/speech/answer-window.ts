/** One clock from the moment the word is shown until the app speaks it. */
export const SPOKEN_ANSWER_MS = 20_000;

/**
 * Milliseconds left in the same window.
 * A listener restart does not move the start, so three restarts still end at 20 seconds.
 */
export function answerWindowLeft(shownAt: number, now: number, windowMs = SPOKEN_ANSWER_MS): number {
  if (!Number.isFinite(shownAt) || !Number.isFinite(now) || !Number.isFinite(windowMs) || windowMs <= 0) return 0;
  return Math.max(0, shownAt + windowMs - now);
}

/**
 * Android plays a beep each time the listener starts.
 * Starting again inside the window would beep again, so the listener starts once.
 */
export function listenerRestartAllowed(): boolean {
  return false;
}
