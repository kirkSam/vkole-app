/**
 * Engine work that does not look like a tap: speech, the microphone,
 * a song, an answer, or a move to the next prompt.
 * The sitting's idle clock listens for ENGINE_ACTIVITY_EVENT.
 * While audio is playing or the microphone is open, the sitting stays up.
 */

export const ENGINE_ACTIVITY_EVENT = "vkole-engine-activity";

let lastActivity = 0;
let audioDepth = 0;
let micDepth = 0;
let sessionActive = false;

function emit(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ENGINE_ACTIVITY_EVENT));
}

export function noteEngineActivity(now = Date.now()): void {
  lastActivity = now;
  emit();
}

export function engineIdleMs(now = Date.now()): number {
  if (!lastActivity) return Number.POSITIVE_INFINITY;
  return Math.max(0, now - lastActivity);
}

export function engineAudioPlaying(on: boolean): void {
  audioDepth = Math.max(0, audioDepth + (on ? 1 : -1));
  if (on) noteEngineActivity();
}

export function engineMicListening(on: boolean): void {
  micDepth = Math.max(0, micDepth + (on ? 1 : -1));
  if (on) noteEngineActivity();
}

/** Speech or a song. Release once, from the end or from cleanup. */
export function holdEngineAudio(): () => void {
  engineAudioPlaying(true);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    noteEngineActivity();
    engineAudioPlaying(false);
  };
}

/** The microphone is open for an answer. Release once, when that wait ends. */
export function holdEngineMic(): () => void {
  engineMicListening(true);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    noteEngineActivity();
    engineMicListening(false);
  };
}

export function engineIsBusy(): boolean {
  return audioDepth > 0 || micDepth > 0;
}

/** True while the engine page is on screen. A website 401 must not sign that sitting out. */
export function markEngineSession(active: boolean): void {
  sessionActive = active;
  if (active) noteEngineActivity();
  else {
    audioDepth = 0;
    micDepth = 0;
  }
}

export function engineSessionActive(): boolean {
  return sessionActive;
}

/**
 * A busy engine is not idle, even when the last tap is older than the limit.
 * `busy` is the microphone or audio, not a guess about the child.
 */
export function inactivityDue(last: number, now: number, busy: boolean, idleMs: number): boolean {
  if (busy) return false;
  if (!Number.isFinite(last) || !Number.isFinite(now) || !Number.isFinite(idleMs)) return false;
  return now - last >= idleMs;
}

/** Outside an engine, a rejected website token still returns the parent to sign-in. */
export function appSessionOnWebsiteUnauthorized(engineActive: boolean): "stay" | "sign-in" {
  return engineActive ? "stay" : "sign-in";
}

export function resetEngineActivity(): void {
  lastActivity = 0;
  audioDepth = 0;
  micDepth = 0;
  sessionActive = false;
}
