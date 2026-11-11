import { Capacitor } from "@capacitor/core";
import { TextToSpeech } from "@capacitor-community/text-to-speech";
import { SpeechRecognition } from "@capgo/capacitor-speech-recognition";
import { holdEngineAudio, noteEngineActivity } from "@/lib/engine-activity";
import { PHONE_CANNOT_HEAR } from "@/lib/voice-consent";

/** Shown before the phone asks for the microphone. */
export const MIC_ASK_LINE =
  "Your child answers out loud. The microphone listens only while a word or prompt is waiting. The app does not record or save the sound.";

/** Android 12 and older, or a phone with no English on-device speech pack. */
export const MIC_PRIVATE_UNAVAILABLE =
  "This phone can't listen privately, so an adult marks each answer.";

export const MIC_DENIED_LINE = "The microphone is off. An adult can mark this answer.";

export const SPEAK_FAILED_LINE =
  "This phone could not speak aloud. Turn up the volume, or ask an adult to say it.";

export const PA_NEEDS_SOUND_LINE =
  "This engine needs sound. Turn up the volume, or ask an adult to read each prompt aloud.";

/** Listening works on Android 13+ when the English on-device speech pack is installed. */
export const ANDROID_LISTEN_MIN = 13;

export const NATIVE_LISTEN = {
  language: "en-US",
  partialResults: true,
  popup: false,
  useOnDeviceRecognition: true,
} as const;

/** Older Android, after the parent has allowed voice answers. The audio goes to Google and is not saved. */
export const GOOGLE_LISTEN = {
  language: "en-US",
  partialResults: true,
  popup: false,
  useOnDeviceRecognition: false,
} as const;

type SpeechAlternative = { transcript?: string };
type SpeechResult = ArrayLike<SpeechAlternative> & { isFinal?: boolean };
type SpeechEvent = { resultIndex?: number; results: ArrayLike<SpeechResult> };

export type SpeechListener = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  grammars: unknown;
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};

export type ListenKind = "denied" | "private";

export function listenKind(error?: string): ListenKind | null {
  if (error === "not-allowed" || error === "service-not-allowed") return "denied";
  if (error === "not-available") return "private";
  return null;
}

export function listenFailureLine(_kind: ListenKind): string {
  return PHONE_CANNOT_HEAR;
}

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function listenerReady(): boolean {
  return isNativeApp() || webRecognitionCtor() != null;
}

function webRecognitionCtor(): (new () => SpeechListener) | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & {
    SpeechRecognition?: new () => SpeechListener;
    webkitSpeechRecognition?: new () => SpeechListener;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

type MatchHandler = (matches: string[], isFinal?: boolean) => void;

export type ListenPorts = {
  onDevice: (language: string) => Promise<boolean>;
  /** Any speech service, including Google's, when on-device recognition is missing. */
  service: () => Promise<boolean>;
  permit: () => Promise<"granted" | "denied">;
  begin: (options: typeof NATIVE_LISTEN | typeof GOOGLE_LISTEN, onMatch: MatchHandler) => Promise<void>;
  halt: () => Promise<void>;
};

let listenPorts: ListenPorts | null = null;
let nativeSpeaking = false;
let cannotSpeakHook: () => void = () => {};

export function useListenPorts(next: ListenPorts | null) {
  listenPorts = next;
}

/**
 * Ask the phone for the microphone and wait for the parent's answer.
 * This does not start listening. The word's timer stays off until this returns.
 * A later word checks again. Already decided answers return without a new dialog.
 */
export async function askMicrophone(): Promise<"granted" | "denied"> {
  const ports = listenPorts;
  if (ports) return ports.permit();
  if (isNativeApp()) {
    try {
      const current = await SpeechRecognition.checkPermissions();
      if (current.speechRecognition === "granted") return "granted";
      if (current.speechRecognition === "denied") return "denied";
      const asked = await SpeechRecognition.requestPermissions();
      return asked.speechRecognition === "granted" ? "granted" : "denied";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err ?? "");
      if (/permission/i.test(message)) return "denied";
      try {
        const asked = await SpeechRecognition.requestPermissions();
        return asked.speechRecognition === "granted" ? "granted" : "denied";
      } catch {
        return "denied";
      }
    }
  }
  return webMicrophone();
}

async function webMicrophone(): Promise<"granted" | "denied"> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return webRecognitionCtor() ? "granted" : "denied";
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
    return "granted";
  } catch {
    return "denied";
  }
}

export function nativeSpeechActive(): boolean {
  return nativeSpeaking;
}

export function setCannotSpeakHook(hook: () => void) {
  cannotSpeakHook = hook;
  return () => {
    if (cannotSpeakHook === hook) cannotSpeakHook = () => {};
  };
}

function noteCannotSpeak() {
  cannotSpeakHook();
}

function matchesEvent(matches: string[], isFinal = false): SpeechEvent {
  const alternatives = matches.map((transcript) => ({ transcript }));
  const result = Object.assign(alternatives, { isFinal });
  return { resultIndex: 0, results: [result] };
}

/** Plugin error codes become the same names the engines already handle. */
export function nativeListenError(
  code: string | undefined,
): "not-allowed" | "not-available" | "no-speech" | "audio-capture" | "network" {
  switch (code) {
    case "INSUFFICIENT_PERMISSIONS":
      return "not-allowed";
    case "UNSUPPORTED_LOCALE":
    case "MODEL_DOWNLOAD_SCHEDULED":
    case "RECREATE_FAILED":
      return "not-available";
    case "AUDIO":
      return "audio-capture";
    case "NETWORK":
    case "NETWORK_TIMEOUT":
    case "SERVER":
    case "SERVER_DISCONNECTED":
      return "network";
    default:
      return "no-speech";
  }
}

function nativeErrorIsFatal(error: string): error is "not-allowed" | "not-available" {
  return error === "not-allowed" || error === "not-available";
}

class NativeListener implements SpeechListener {
  lang = "en-US";
  continuous = true;
  interimResults = true;
  maxAlternatives = 5;
  grammars: unknown = null;
  onstart: (() => void) | null = null;
  onaudiostart: (() => void) | null = null;
  onresult: ((event: SpeechEvent) => void) | null = null;
  onerror: ((event: { error?: string }) => void) | null = null;
  onend: (() => void) | null = null;
  private starting = false;
  private running = false;
  private aborted = false;
  private fatal = false;
  private lastHeard: string[] = [];

  start() {
    if (this.starting || this.running) {
      const err = new Error("InvalidStateError");
      err.name = "InvalidStateError";
      throw err;
    }
    this.starting = true;
    this.aborted = false;
    this.fatal = false;
    this.lastHeard = [];
    void this.open();
  }

  abort() {
    this.aborted = true;
    this.starting = false;
    this.running = false;
    const halt = listenPorts?.halt ?? (() => SpeechRecognition.stop());
    void halt().catch(() => undefined);
  }

  private fail(error: "not-allowed" | "not-available") {
    this.fatal = true;
    this.starting = false;
    this.running = false;
    const halt = listenPorts?.halt ?? (() => SpeechRecognition.stop());
    void halt().catch(() => undefined);
    this.onerror?.({ error });
  }

  private async open() {
    const ports = listenPorts;
    const language = this.lang || "en-US";
    try {
      const onDevice = ports
        ? await ports.onDevice(language)
        : (await SpeechRecognition.isOnDeviceRecognitionAvailable({ language })).available;
      if (this.aborted) return;
      let google = false;
      if (!onDevice) {
        google = ports ? await ports.service() : (await SpeechRecognition.available()).available;
        if (this.aborted) return;
        if (!google) {
          this.fail("not-available");
          return;
        }
      }
      const permission = ports
        ? await ports.permit()
        : (await SpeechRecognition.requestPermissions()).speechRecognition === "granted"
          ? "granted"
          : "denied";
      if (this.aborted) return;
      if (permission !== "granted") {
        this.fail("not-allowed");
        return;
      }
      const room = onDevice ? NATIVE_LISTEN : GOOGLE_LISTEN;
      const options = { ...room, language, maxResults: this.maxAlternatives || 5 };
      const onMatch = (matches: string[], isFinal = false) => {
        if (this.aborted || this.fatal) return;
        const heard = matches.map((match) => match.trim()).filter(Boolean);
        if (heard.length === 0) return;
        this.lastHeard = heard;
        this.onresult?.(matchesEvent(heard, isFinal));
      };
      if (ports) {
        await ports.begin(room, onMatch);
      } else {
        await SpeechRecognition.removeAllListeners();
        await SpeechRecognition.addListener("partialResults", (event) => {
          onMatch(event.matches ?? [], false);
        });
        await SpeechRecognition.addListener("listeningState", (event) => {
          if (this.aborted || this.fatal) return;
          if (event.status === "started" || event.state === "started") {
            this.running = true;
            this.starting = false;
            this.onstart?.();
            this.onaudiostart?.();
          }
          if (event.status === "stopped" || event.state === "stopped" || event.state === "stoppingListening") {
            if (event.state === "stoppingListening") return;
            if (event.reason === "results" && this.lastHeard.length > 0) {
              onMatch(this.lastHeard, true);
            }
            if (this.aborted || this.fatal) return;
            this.running = false;
            this.starting = false;
            this.onend?.();
          }
        });
        await SpeechRecognition.addListener("error", (event) => {
          if (this.aborted || this.fatal) return;
          const error = nativeListenError(event.code);
          if (nativeErrorIsFatal(error)) {
            this.fail(error);
            return;
          }
          this.onerror?.({ error });
        });
        await SpeechRecognition.start(options);
      }
      if (ports && !this.aborted && !this.fatal) {
        this.running = true;
        this.starting = false;
        this.onstart?.();
        this.onaudiostart?.();
      }
    } catch (err) {
      if (!this.aborted) {
        const message = err instanceof Error ? err.message : String(err ?? "");
        this.fail(/permission/i.test(message) ? "not-allowed" : "not-available");
      }
    }
  }
}

export function createListener(): SpeechListener | null {
  if (isNativeApp() || listenPorts) return new NativeListener();
  const Ctor = webRecognitionCtor();
  return Ctor ? new Ctor() : null;
}

export type SpeakOptions = {
  rate: number;
  capMs: number;
};

type SpeakPorts = {
  native: boolean;
  speak: (text: string, rate: number) => Promise<void>;
  stop: () => Promise<void>;
};

let speakPorts: SpeakPorts | null = null;

export function useSpeakPorts(next: SpeakPorts | null) {
  speakPorts = next;
}

/** Say one line. The browser uses speechSynthesis. The Android app uses the speech plugin. */
export function speakAloud(line: string, done: () => void, options: SpeakOptions): () => void {
  const native = speakPorts ? speakPorts.native : isNativeApp();
  if (!line.trim()) {
    noteEngineActivity();
    done();
    return () => {};
  }
  if (!native) return speakInBrowser(line, done, options);
  return speakOnDevice(line, done, options);
}

function speakInBrowser(line: string, done: () => void, options: SpeakOptions): () => void {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    noteEngineActivity();
    noteCannotSpeak();
    done();
    return () => {};
  }
  const release = holdEngineAudio();
  let finished = false;
  const synth = window.speechSynthesis;
  const finish = () => {
    if (finished) return;
    finished = true;
    window.clearTimeout(cap);
    try {
      synth.cancel();
    } catch {
      /* already quiet */
    }
    release();
    done();
  };
  const cap = window.setTimeout(finish, options.capMs);
  const stop = () => {
    if (finished) return;
    finished = true;
    window.clearTimeout(cap);
    try {
      synth.cancel();
    } catch {
      /* already quiet */
    }
    release();
  };
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(line);
  utter.lang = "en-US";
  utter.rate = options.rate;
  utter.onend = finish;
  utter.onerror = () => {
    noteCannotSpeak();
    finish();
  };
  synth.speak(utter);
  return stop;
}

function speakOnDevice(line: string, done: () => void, options: SpeakOptions): () => void {
  const release = holdEngineAudio();
  let finished = false;
  nativeSpeaking = true;
  const finish = (failed = false, notify = true) => {
    if (finished) return;
    finished = true;
    nativeSpeaking = false;
    clearTimeout(cap);
    const stop = speakPorts?.stop ?? (() => TextToSpeech.stop());
    void stop().catch(() => undefined);
    release();
    if (failed) noteCannotSpeak();
    if (notify) done();
  };
  const cap = setTimeout(() => finish(false), options.capMs);
  const speak = speakPorts?.speak ?? ((text: string, rate: number) => TextToSpeech.speak({ text, lang: "en-US", rate }));
  void speak(line, options.rate).then(
    () => finish(false),
    () => finish(true),
  );
  return () => finish(false, false);
}

export function stopSpeaking() {
  nativeSpeaking = false;
  if (typeof window !== "undefined") {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* already quiet */
    }
  }
  const stop = speakPorts?.stop ?? (() => TextToSpeech.stop());
  void stop().catch(() => undefined);
}
