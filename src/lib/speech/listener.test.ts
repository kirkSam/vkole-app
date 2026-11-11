import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  ANDROID_LISTEN_MIN,
  GOOGLE_LISTEN,
  MIC_ASK_LINE,
  NATIVE_LISTEN,
  PA_NEEDS_SOUND_LINE,
  SPEAK_FAILED_LINE,
  createListener,
  listenFailureLine,
  nativeListenError,
  setCannotSpeakHook,
  speakAloud,
  useListenPorts,
  useSpeakPorts,
  type ListenPorts,
} from "./listener.ts";
import { PHONE_CANNOT_HEAR } from "../voice-consent.ts";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("shared listening helper", () => {
  it("picks the on-device listener in the app and does not call Google when that is missing", async () => {
    const began: unknown[] = [];
    const ports: ListenPorts = {
      onDevice: async () => false,
      service: async () => false,
      permit: async () => "granted",
      begin: async (options) => {
        began.push(options);
      },
      halt: async () => {},
    };
    useListenPorts(ports);
    const errors: string[] = [];
    const heard: string[] = [];
    const listener = createListener();
    assert.ok(listener);
    listener.onerror = (event) => {
      if (event.error) errors.push(event.error);
    };
    listener.onresult = () => heard.push("heard");
    listener.start();
    await flush();
    assert.deepEqual(errors, ["not-available"]);
    assert.deepEqual(began, []);
    assert.equal(listenFailureLine("private"), PHONE_CANNOT_HEAR);
    assert.equal(listenFailureLine("denied"), PHONE_CANNOT_HEAR);
    assert.equal(ANDROID_LISTEN_MIN, 13);
    useListenPorts(null);
  });

  it("uses Google's speech service only when the phone cannot listen on the device", async () => {
    const began: unknown[] = [];
    const ports: ListenPorts = {
      onDevice: async () => false,
      service: async () => true,
      permit: async () => "granted",
      begin: async (options) => {
        began.push(options);
      },
      halt: async () => {},
    };
    useListenPorts(ports);
    const listener = createListener();
    assert.ok(listener);
    listener.start();
    await flush();
    assert.deepEqual(began, [GOOGLE_LISTEN]);
    assert.equal(GOOGLE_LISTEN.useOnDeviceRecognition, false);
    useListenPorts(null);
  });

  it("asks for permission and starts on-device listening only after a yes", async () => {
    const began: unknown[] = [];
    let matches: (lines: string[], isFinal?: boolean) => void = () => {};
    const ports: ListenPorts = {
      onDevice: async () => true,
      service: async () => true,
      permit: async () => "denied",
      begin: async (options, onMatch) => {
        began.push(options);
        matches = onMatch;
      },
      halt: async () => {},
    };
    useListenPorts(ports);
    const errors: string[] = [];
    const listener = createListener();
    assert.ok(listener);
    listener.onerror = (event) => {
      if (event.error) errors.push(event.error);
    };
    listener.start();
    await flush();
    assert.deepEqual(errors, ["not-allowed"]);
    assert.deepEqual(began, []);
    assert.equal(listenFailureLine("denied"), PHONE_CANNOT_HEAR);

    ports.permit = async () => "granted";
    const heard: string[] = [];
    const finals: boolean[] = [];
    const open = createListener();
    assert.ok(open);
    open.onresult = (event) => {
      heard.push(event.results[0]?.[0]?.transcript ?? "");
      finals.push(Boolean(event.results[0]?.isFinal));
    };
    open.start();
    await flush();
    assert.deepEqual(began, [NATIVE_LISTEN]);
    assert.equal(NATIVE_LISTEN.useOnDeviceRecognition, true);
    assert.equal(NATIVE_LISTEN.popup, false);
    matches(["cat"]);
    assert.deepEqual(heard, ["cat"]);
    assert.deepEqual(finals, [false]);
    matches(["nope"], true);
    assert.deepEqual(heard, ["cat", "nope"]);
    assert.deepEqual(finals, [false, true]);
    open.abort();
    matches(["dog"]);
    assert.deepEqual(heard, ["cat", "nope"]);
    useListenPorts(null);
  });

  it("passes a muted beep and the silence left on every start", async () => {
    const began: Array<{ muteRecognizerBeep?: boolean; allowForSilence?: number }> = [];
    const ports: ListenPorts = {
      onDevice: async () => true,
      service: async () => true,
      permit: async () => "granted",
      begin: async (options) => {
        began.push(options);
      },
      halt: async () => {},
    };
    useListenPorts(ports);
    const first = createListener();
    assert.ok(first);
    first.allowForSilence = 20_000;
    first.start();
    await flush();
    first.abort();
    const second = createListener();
    assert.ok(second);
    second.allowForSilence = 15_000;
    second.start();
    await flush();
    second.abort();
    assert.equal(began.length, 2);
    assert.equal(began[0]?.muteRecognizerBeep, true);
    assert.equal(began[0]?.allowForSilence, 20_000);
    assert.equal(began[1]?.muteRecognizerBeep, true);
    assert.equal(began[1]?.allowForSilence, 15_000);
    assert.equal(NATIVE_LISTEN.muteRecognizerBeep, true);
    assert.equal(GOOGLE_LISTEN.muteRecognizerBeep, true);
    assert.equal(NATIVE_LISTEN.allowForSilence, 20_000);
    assert.equal(GOOGLE_LISTEN.allowForSilence, 20_000);
    useListenPorts(null);
  });

  it("keeps silence as no-speech, and a finished native result is final", () => {
    assert.equal(nativeListenError("NO_MATCH"), "no-speech");
    assert.equal(nativeListenError("SPEECH_TIMEOUT"), "no-speech");
    assert.equal(nativeListenError("INSUFFICIENT_PERMISSIONS"), "not-allowed");
    assert.equal(nativeListenError("UNSUPPORTED_LOCALE"), "not-available");
    assert.equal(nativeListenError("MODEL_DOWNLOAD_SCHEDULED"), "not-available");
    assert.equal(nativeListenError("AUDIO"), "audio-capture");
    assert.equal(nativeListenError(undefined), "no-speech");
    const helper = source("./listener.ts");
    assert.equal(helper.includes('event.reason === "results"'), true);
    assert.equal(helper.includes("nativeListenError(event.code)"), true);
  });

  it("does not skip speaking silently when the phone cannot speak", async () => {
    let failed = 0;
    setCannotSpeakHook(() => {
      failed += 1;
    });
    useSpeakPorts({
      native: true,
      speak: async () => {
        throw new Error("no voice");
      },
      stop: async () => {},
    });
    let done = 0;
    speakAloud("sun", () => {
      done += 1;
    }, { rate: 0.9, capMs: 20000 });
    await flush();
    assert.equal(failed, 1);
    assert.equal(done, 1);
    useSpeakPorts(null);
    setCannotSpeakHook(() => {});
  });

  it("uses the same words on the cards and pins the plugins", () => {
    const pkg = source("../../../package.json");
    assert.equal(MIC_ASK_LINE, "Your child answers out loud. The microphone listens only while a word or prompt is waiting. The app does not record or save the sound.");
    assert.equal(PA_NEEDS_SOUND_LINE, "This engine needs sound. Turn up the volume, or ask an adult to read each prompt aloud.");
    assert.equal(SPEAK_FAILED_LINE, "This phone could not speak aloud. Turn up the volume, or ask an adult to say it.");
    assert.equal(pkg.includes('"@capgo/capacitor-speech-recognition": "8.4.6"'), true);
    assert.equal(pkg.includes('"@capacitor-community/text-to-speech": "8.0.2"'), true);
    assert.equal(pkg.includes("@capgo/capacitor-speech-recognition\": \"^"), false);
    assert.equal(pkg.includes("@capacitor-community/text-to-speech\": \"^"), false);
    const helper = source("./listener.ts");
    assert.equal(helper.includes("useOnDeviceRecognition: true"), true);
    assert.equal(helper.includes("popup: false"), true);
    assert.equal(helper.includes("muteRecognizerBeep: true"), true);
    assert.equal(helper.includes("allowForSilence"), true);
    for (const path of ["../../components/sight-word-stage.tsx", "../../components/phonemic-stage.tsx", "../../components/alphabet-stage.tsx"]) {
      const stage = source(path);
      assert.equal(stage.includes("PARENT_NEEDS_VOICE"), true, path);
      assert.equal(stage.includes("PHONE_CANNOT_HEAR"), true, path);
      assert.equal(stage.includes("LISTENING_BEST"), true, path);
      assert.equal(stage.includes("voiceAllowed"), true, path);
      assert.equal(stage.includes("Allow voice answers"), false, path);
      assert.equal(stage.includes("webkitSpeechRecognition"), false, path);
      assert.equal(stage.includes("createListener"), true, path);
      assert.equal(stage.includes("rec?.abort()"), true, path);
    }
    assert.equal(source("../../components/phonemic-stage.tsx").includes("PA_NEEDS_SOUND_LINE"), true);
    assert.equal(source("../../components/phonemic-stage.tsx").includes("speakLine(item.say"), true);
    assert.equal(source("../../components/phonemic-stage.tsx").includes("capMs: 20000"), true);
    assert.equal(source("../../components/phonemic-stage.tsx").includes("PA_MAX_SHOW_MS"), true);
    assert.equal(source("../../components/sight-word-stage.tsx").includes("SPEAK_FAILED_LINE"), true);
    assert.equal(source("../../components/sight-word-stage.tsx").includes("speakWord(word"), true);
    assert.equal(source("../../components/sight-word-stage.tsx").includes("capMs: 8000"), true);
    assert.equal(source("../../components/sight-word-stage.tsx").includes("SIGHT_WORD_MAX_SHOW_MS"), true);
    assert.equal(source("../../components/alphabet-stage.tsx").includes("SPEAK_FAILED_LINE"), true);
    assert.equal(source("../../components/alphabet-stage.tsx").includes("speakLine(view.say"), true);
    assert.equal(source("../../components/alphabet-stage.tsx").includes("speakLine(songFrame.letter"), true);
    const manifest = source("../../../android/app/src/main/AndroidManifest.xml");
    assert.equal(manifest.includes("android.permission.RECORD_AUDIO"), true);
  });
});
