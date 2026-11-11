import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { CHIME_MS, CHIME_SHA256, CHIME_SRC, chimeAllowed, playHeldChime } from "./chime.ts";
import { SPOKEN_ANSWER_MS } from "./answer-window.ts";
import { MIC_WINDOW_MS } from "./mic-session.ts";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

function wavSeconds(path: string): number {
  const buf = readFileSync(new URL(path, import.meta.url));
  const rate = buf.readUInt32LE(24);
  const bytes = buf.readUInt32LE(40);
  return bytes / 2 / rate;
}

describe("VEKOLE listening chime", () => {
  it("plays once before listening, and never on a restart or a prompt", async () => {
    const played: string[] = [];
    const held: string[] = [];
    const io = {
      play: async (src: string) => {
        played.push(src);
      },
      holdBeep: async () => {
        held.push("hold");
      },
    };
    assert.equal(await chimeAllowed("restart", async () => true), false);
    assert.equal(await chimeAllowed("prompt", async () => true), false);
    assert.equal(await chimeAllowed("listen", async () => false), false);
    await playHeldChime(false, io);
    assert.deepEqual(played, []);
    assert.equal(await chimeAllowed("listen", async () => true), true);
    await playHeldChime(true, io);
    assert.deepEqual(played, [CHIME_SRC]);
    assert.deepEqual(held, ["hold"]);
    assert.equal(played.length, 1);
  });

  it("keeps the chime short and leaves both clocks alone", () => {
    assert.equal(SPOKEN_ANSWER_MS, 20_000);
    assert.equal(MIC_WINDOW_MS, 6_000);
    const file = readFileSync(new URL(`../../../public${CHIME_SRC}`, import.meta.url));
    assert.equal(createHash("sha256").update(file).digest("hex"), CHIME_SHA256);
    assert.equal(wavSeconds(`../../../public${CHIME_SRC}`), 0.3);
    assert.equal(CHIME_MS >= 250 && CHIME_MS <= 400, true);
    for (const path of ["../../components/sight-word-stage.tsx", "../../components/phonemic-stage.tsx"]) {
      const stage = source(path);
      const ended = stage.slice(stage.indexOf("rec.onend"));
      const handler = ended.slice(0, ended.indexOf("};"));
      assert.equal(handler.includes("chimeAllowed"), false, path);
      assert.equal(handler.includes("playHeldChime"), false, path);
      const first = stage.slice(stage.indexOf('chimeAllowed("listen")'));
      assert.equal(first.includes("playHeldChime"), true, path);
      assert.equal(first.indexOf("playHeldChime") < first.indexOf("ear.start()"), true, path);
    }
    const phonemic = source("../../components/phonemic-stage.tsx");
    const prompt = phonemic.slice(phonemic.indexOf('phase !== "prompt"'), phonemic.indexOf('phase !== "listen"'));
    assert.equal(prompt.includes("chimeAllowed"), false);
    const alphabet = source("../../components/alphabet-stage.tsx");
    assert.equal(alphabet.includes("if (gate.played)"), true);
    assert.equal(alphabet.includes('chimeAllowed("listen")'), true);
    assert.equal(alphabet.includes("MIC_WINDOW_MS"), true);
    assert.equal(alphabet.includes("SPOKEN_ANSWER_MS"), false);
  });
});
