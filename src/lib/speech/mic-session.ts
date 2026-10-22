/**
 * Alphabet microphone timing for speech exercises 2, 3, 4, and 5.
 *
 * The spoken prompt finishes before this window. The letter visual and
 * recognition.start() happen in that same turn, at the prompt's onend.
 * The 6 second countdown and the mic close share one start and one deadline,
 * measured with performance.now() from onaudiostart. A restart for no-speech,
 * aborted, or network stays inside that deadline and does not move it.
 * Copy this file with the spelling stage handler. It does not import the app.
 */

/** How long the microphone stays open after audio actually starts. */
export const MIC_WINDOW_MS = 6_000;

/** The visible countdown is this same window. It reaches 0 when the mic closes. */
export const SPELLING_COUNTDOWN_MS = MIC_WINDOW_MS;

export type MicHear = "correct" | "miss" | "wait" | "again";

export type MicCountdown = {
  showCountdown: boolean;
  seconds: number | null;
  close: boolean;
};

export type MicTimingMark = {
  letterShown: number;
  micStart: number | null;
  audioStart: number | null;
  micClose: number | null;
};

let openSerial = 0;
let micSerial = 0;

/** One recognizer at a time. start() while the last one has not ended is refused. */
export function recognizerIsIdle(): boolean {
  return openSerial === 0;
}

export function recognizerSerial(): number {
  return openSerial;
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

/** A sticky speechSynthesis.speaking flag may delay the mic only this many times. */
export const SPEECH_BUSY_WAIT_LIMIT = 3;

/** True while speech may still be finishing. After the limit, the mic may open. */
export function speechMayBlockMic(speechBusy: boolean, waits: number): boolean {
  const count = Number.isFinite(waits) && waits > 0 ? waits : 0;
  return speechBusy && count < SPEECH_BUSY_WAIT_LIMIT;
}

/** Chrome throws this when start() is called on a recognizer that is already running. */
export function alreadyStartedError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = "name" in err ? String((err as { name?: unknown }).name ?? "") : "";
  const message = "message" in err ? String((err as { message?: unknown }).message ?? "") : "";
  return name === "InvalidStateError" || /already started/i.test(message) || message === "InvalidStateError";
}

export type RecognizerStart = {
  status: "started" | "already-started" | "retry";
  serial: number;
};

/**
 * Start only when `idle` is true.
 * InvalidStateError means this recognizer is already running: do not start again.
 * Any other throw releases the claim so a later try can start.
 */
export function startWhenIdle(rec: { start: () => void }, idle: boolean): RecognizerStart {
  if (!idle) return { status: "already-started", serial: 0 };
  const serial = claimRecognizer();
  try {
    rec.start();
    return { status: "started", serial };
  } catch (err) {
    if (alreadyStartedError(err)) return { status: "already-started", serial };
    releaseRecognizer(serial);
    return { status: "retry", serial: 0 };
  }
}

/** The moment the mic must close. Keyed to audio start, not to when the letter was drawn. */
export function micDeadline(audioAt: number): number {
  return audioAt + MIC_WINDOW_MS;
}

/**
 * Countdown for audio that started at `audioAt`.
 * Hidden until audio flows. Shows 6 at that instant and 0 at the deadline.
 * `close` is true on that same instant, so the number and the mic end together.
 */
export function micCountdown(audioAt: number | null, now: number): MicCountdown {
  if (audioAt == null || !Number.isFinite(audioAt) || !Number.isFinite(now)) {
    return { showCountdown: false, seconds: null, close: false };
  }
  const elapsed = now - audioAt;
  if (elapsed < 0) return { showCountdown: false, seconds: null, close: false };
  if (elapsed >= MIC_WINDOW_MS) return { showCountdown: true, seconds: 0, close: true };
  return {
    showCountdown: true,
    seconds: Math.ceil((MIC_WINDOW_MS - elapsed) / 1000),
    close: false,
  };
}

/** A restart may run only before the deadline. No audio yet means the window has not opened. */
export function micRestartAllowed(audioAt: number | null, now: number): boolean {
  if (!Number.isFinite(now)) return false;
  if (audioAt == null) return true;
  return now < micDeadline(audioAt);
}

/**
 * When the next start() may run. Null means the deadline would be missed, so the caller must not start.
 * The returned time never moves the deadline.
 */
export function scheduleMicRestart(audioAt: number | null, now: number, delayMs: number): number | null {
  if (!micRestartAllowed(audioAt, now)) return null;
  const wait = Number.isFinite(delayMs) && delayMs > 0 ? delayMs : 0;
  const at = now + wait;
  if (audioAt != null && at >= micDeadline(audioAt)) return null;
  return at;
}

/** Master readout. Times are milliseconds after the letter was shown. */
export function formatMicTiming(mark: MicTimingMark): string {
  const rel = (at: number | null) => (at == null || !Number.isFinite(at) ? "—" : `${Math.round(at - mark.letterShown)}ms`);
  return `letter 0ms · mic ${rel(mark.micStart)} · audio ${rel(mark.audioStart)} · close ${rel(mark.micClose)}`;
}

/**
 * correct advances to the next letter.
 * miss shows Try again and the next letter starts from a new prompt.
 * again is a finished low score: ask again from a new prompt. It is not a miss.
 * wait, including a live low score, leaves this same window running.
 */
export function micAnswer(judgment: MicHear): "keep" | "advance" | "retry" | "reask" {
  if (judgment === "correct") return "advance";
  if (judgment === "miss") return "retry";
  if (judgment === "again") return "reask";
  return "keep";
}
