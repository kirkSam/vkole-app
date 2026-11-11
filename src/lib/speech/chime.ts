import { registerPlugin } from "@capacitor/core";
import { isNativeApp } from "@/lib/speech/listener";

/** Sam picks one. The app plays the bell until he chooses. */
export const CHIME_CHOICES = [
  { id: "bell", src: "/chimes/vekole-bell.wav", note: "One soft A, fading in and out." },
  { id: "third", src: "/chimes/vekole-third.wav", note: "A quiet major third, C then E." },
  { id: "drop", src: "/chimes/vekole-drop.wav", note: "One tone that falls a little." },
] as const;

export const CHIME_SRC = CHIME_CHOICES[0].src;

/** About 0.3 seconds. The backup timer is a little longer so a stuck file cannot hold the mic. */
export const CHIME_MS = 320;

/** How long the music stream stays quiet after the recognizer is asked to start. */
export const BEEP_HOLD_MS = 800;

export type ChimeMoment = "listen" | "restart" | "prompt";

type BeepMutePlugin = {
  canMute: () => Promise<{ ok?: boolean }>;
  hold: () => Promise<{ ok?: boolean }>;
  release: () => Promise<void>;
};

const BeepMute = registerPlugin<BeepMutePlugin>("BeepMute");

export type ChimeDeps = {
  canMuteBeep: () => Promise<boolean>;
  play: (src: string) => Promise<void>;
  holdBeep: () => Promise<void>;
};

let deps: ChimeDeps | null = null;
let releaseTimer = 0;

export function useChimeDeps(next: ChimeDeps | null) {
  deps = next;
}

/** Once, when listening starts. Not on a quiet restart, and not while a prompt is spoken. */
export async function chimeAllowed(moment: ChimeMoment, canMute: () => Promise<boolean> = liveCanMute): Promise<boolean> {
  if (moment !== "listen") return false;
  return canMute();
}

/** Play the chime, then hold the beep channel. A skipped chime holds nothing. */
export async function playHeldChime(allowed: boolean, io: Pick<ChimeDeps, "play" | "holdBeep"> = liveIo()): Promise<void> {
  if (!allowed) return;
  await io.play(CHIME_SRC);
  await io.holdBeep();
}

export function releaseBeepMuteSoon(release: () => Promise<void> = liveRelease, waitMs = BEEP_HOLD_MS) {
  if (releaseTimer) window.clearTimeout(releaseTimer);
  releaseTimer = window.setTimeout(() => {
    releaseTimer = 0;
    void release();
  }, waitMs);
}

export function releaseBeepMute(release: () => Promise<void> = liveRelease) {
  if (releaseTimer) window.clearTimeout(releaseTimer);
  releaseTimer = 0;
  void release();
}

async function liveCanMute(): Promise<boolean> {
  if (!isNativeApp()) return true;
  try {
    const result = await BeepMute.canMute();
    return result.ok === true;
  } catch {
    return false;
  }
}

function liveIo(): Pick<ChimeDeps, "play" | "holdBeep"> {
  return deps ?? { play: playChimeFile, holdBeep: liveHold };
}

async function liveHold(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await BeepMute.hold();
  } catch {
    /* The chime already finished. Listening still starts. */
  }
}

async function liveRelease(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await BeepMute.release();
  } catch {
    /* Already restored. */
  }
}

function playChimeFile(src: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof Audio === "undefined") {
      resolve();
      return;
    }
    const audio = new Audio(src);
    audio.volume = 0.7;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    audio.addEventListener("ended", finish);
    audio.addEventListener("error", finish);
    window.setTimeout(finish, CHIME_MS + 150);
    void audio.play().catch(finish);
  });
}
