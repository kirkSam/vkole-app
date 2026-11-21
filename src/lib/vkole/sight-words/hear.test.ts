import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { VEKOLE_SETTINGS } from "@kirkpatrick/vekole-engine";
import { anySightAlternativeMatches } from "@kirkpatrick/vekole-engine/server";
import { sightAlternatives } from "./alternatives.ts";
import { matchSightHearing } from "./hear.server.ts";

describe("sight hearing", () => {
  it("accepts a Southern form from a later alternative on the current list", () => {
    assert.equal(matchSightHearing("again", "D-1", ["hello", "nope", "agin"]), true);
    assert.equal(matchSightHearing("any", "D-1", ["inny"]), true);
    assert.equal(matchSightHearing("an", "D-1", ["un"]), true);
    assert.equal(matchSightHearing("an", "D-1", ["xx", "and", "an"]), true);
  });

  it("rejects a different word, including ran for run", () => {
    assert.equal(matchSightHearing("run", "D-PP", ["ran"]), false);
    assert.equal(matchSightHearing("to", "D-PP", ["go"]), false);
    assert.equal(anySightAlternativeMatches("an", ["in"], ["an", "in", "and", "on"]), false);
    assert.equal(matchSightHearing("to", "D-PP", ["two"]), true);
    assert.equal(matchSightHearing("two", "D-PP", ["too"]), true);
  });

  it("keeps five alternatives and does not import the dictionary into the screen", () => {
    assert.equal(VEKOLE_SETTINGS.recognitionAlternatives, 5);
    const heard = sightAlternatives(
      [{ transcript: " one " }, { transcript: "" }, { transcript: "two" }, { transcript: "three" }, { transcript: "four" }, { transcript: "five" }, { transcript: "six" }],
      VEKOLE_SETTINGS.recognitionAlternatives,
    );
    assert.deepEqual(heard, ["one", "two", "three", "four", "five"]);
    const stage = readFileSync(new URL("../../../components/sight-word-stage.tsx", import.meta.url), "utf8");
    assert.equal(stage.includes("hearSightWord"), true);
    assert.equal(stage.includes("recognitionAlternatives"), true);
    assert.equal(stage.includes("@kirkpatrick/vekole-engine/server"), false);
    assert.equal(stage.includes("cmudict"), false);
    const hear = readFileSync(new URL("./hear.ts", import.meta.url), "utf8");
    assert.equal(hear.includes("@kirkpatrick/vekole-engine/server"), false);
    const server = readFileSync(new URL("./hear.server.ts", import.meta.url), "utf8");
    assert.equal(server.includes("server-only"), true);
    assert.equal(server.includes("@kirkpatrick/vekole-engine/server"), true);
  });

  it("biases Android 13+ on-device recognition toward the expected word", () => {
    execFileSync(process.execPath, ["scripts/patch-speech-bias.mjs"], { cwd: fileURLToPath(new URL("../../../../", import.meta.url)) });
    const java = readFileSync(
      new URL("../../../../node_modules/@capgo/capacitor-speech-recognition/android/src/main/java/app/capgo/speechrecognition/SpeechRecognitionPlugin.java", import.meta.url),
      "utf8",
    );
    assert.equal(java.includes("VEKOLE biasing strings"), true);
    assert.equal(java.includes("android.speech.extra.BIASING_STRINGS"), true);
    assert.equal(java.includes("Build.VERSION.SDK_INT >= 33"), true);
    const listener = readFileSync(new URL("../../speech/listener.ts", import.meta.url), "utf8");
    assert.equal(listener.includes("biasingStrings"), true);
    assert.equal(listener.includes("recognitionAlternatives"), true);
    assert.equal(listener.includes("|| 5"), false);
    const stage = readFileSync(new URL("../../../components/sight-word-stage.tsx", import.meta.url), "utf8");
    assert.equal(stage.includes("biasingStrings = [word]"), true);
  });
});
