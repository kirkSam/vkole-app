/**
 * Alphabet microphone timing for speech exercises 2, 3, 4, and 5.
 *
 * After the spoken prompt ends and recognition fires onstart:
 *   MIC_LEAD_MS with the mic open and no countdown,
 *   then MIC_COUNTDOWN_MS showing 5 down to 0,
 *   then MIC_TAIL_MS with the mic still open,
 *   then the mic closes.
 * That is one window of MIC_WINDOW_MS (about 7 seconds).
 * The Listening label is on only while the recognizer is actually open.
 * A new letter starts only after this recognizer has ended and the next prompt has finished.
 * Copy this file with the spelling stage handler. It does not import the app.
 */

/** Quiet open mic before the countdown appears. */
export const MIC_LEAD_MS = 1_000;

/** Visible countdown, from 5 down to 0. */
export const MIC_COUNTDOWN_MS = 5_000;

/** Mic stays open after the countdown reaches 0. */
export const MIC_TAIL_MS = 1_000;

/** Lead + countdown + tail. The recognizer closes at this age. */
export const MIC_WINDOW_MS = MIC_LEAD_MS + MIC_COUNTDOWN_MS + MIC_TAIL_MS;

export type MicHear = "correct" | "miss" | "wait" | "again";

export type MicCountdown = {
  showCountdown: boolean;
  seconds: number | null;
  close: boolean;
};

let openSerial = 0;
let micSerial = 0;

/** One recognizer at a time. start() while the last one has not ended is refused. */
export function recognizerIsIdle(): boolean {
  return openSerial === 0;
}

export function claimRecognizer(): number {
  micSerial += 1;
  openSerial = micSerial;
  return micSerial;
}

export function releaseRecognizer(serial: number): void {
  if (serial !== openSerial) return;
  openSerial = 0;
}

export function resetRecognizerGate(): void {
  openSerial = 0;
  micSerial = 0;
}

/** The mic starts only after the spoken prompt is finished and the previous recognizer has ended. */
export function planMicStart(input: { speechBusy: boolean; previousEnded: boolean }): "start" | "wait" {
  if (input.speechBusy || !input.previousEnded) return "wait";
  return "start";
}

/**
 * Countdown for a mic that opened at `openedAt`.
 * Before the lead ends, the number stays hidden.
 * At the lead, it shows 5. It reaches 0 when the countdown duration ends.
 * `close` is true one tail later. Passing a null open time hides the number and does not close.
 */
export function micCountdown(openedAt: number | null, now: number): MicCountdown {
  if (openedAt == null || !Number.isFinite(openedAt) || !Number.isFinite(now)) {
    return { showCountdown: false, seconds: null, close: false };
  }
  const elapsed = now - openedAt;
  if (elapsed < 0 || elapsed < MIC_LEAD_MS) {
    return { showCountdown: false, seconds: null, close: false };
  }
  if (elapsed >= MIC_WINDOW_MS) {
    return { showCountdown: false, seconds: null, close: true };
  }
  const into = elapsed - MIC_LEAD_MS;
  const seconds = into >= MIC_COUNTDOWN_MS ? 0 : Math.ceil((MIC_COUNTDOWN_MS - into) / 1000);
  return { showCountdown: true, seconds, close: false };
}

/**
 * A real answer ends this window.
 * correct advances to the next letter.
 * miss shows Try again and the next letter starts from a new prompt.
 * wait and again (a low score) leave this same window running.
 */
export function micAnswer(judgment: MicHear): "keep" | "advance" | "retry" {
  if (judgment === "correct") return "advance";
  if (judgment === "miss") return "retry";
  return "keep";
}
