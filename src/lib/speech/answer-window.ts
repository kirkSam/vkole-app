/**
 * Sight Words and Phonemic Awareness.
 * One 20-second total per word or prompt. Nothing restarts it.
 * Alphabet is a different clock: 6 seconds per letter.
 */
export const SPOKEN_ANSWER_MS = 20_000;

/**
 * Milliseconds left on the same clock.
 * The start stays where it was, so a listener restart still ends at 20 seconds.
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

export type ListenStart = "started" | "audio";

/** The phone uses the native listening-started event. A browser uses audio-start. */
export function cueOnListenStart(native: boolean, event: ListenStart): boolean {
  return native ? event === "started" : event === "audio";
}

/** A restart inside the open window leaves the cue up. A real stop hides it. */
export function keepListeningCue(restarting: boolean, windowOpen: boolean): boolean {
  return restarting && windowOpen;
}

