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
 * Android can end a session during silence. A quiet restart is allowed
 * while this same clock still has time. The clock itself never moves.
 */
export function listenerRestartAllowed(leftMs: number): boolean {
  return Number.isFinite(leftMs) && leftMs > 0;
}

/** Start again after an early end. `stopsAt` is the original deadline. */
export function quietRestart(shownAt: number, endedAt: number, windowMs = SPOKEN_ANSWER_MS): {
  restart: boolean;
  allowForSilence: number;
  stopsAt: number;
} {
  const allowForSilence = answerWindowLeft(shownAt, endedAt, windowMs);
  const stopsAt = Number.isFinite(shownAt) && Number.isFinite(windowMs) ? shownAt + windowMs : endedAt;
  return { restart: listenerRestartAllowed(allowForSilence), allowForSilence, stopsAt };
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

