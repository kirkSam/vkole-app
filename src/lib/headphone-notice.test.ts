import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { HEADPHONE_NOTICE } from "./headphone-notice.ts";

const VERBATIM =
  'The VKOLE Online Learning Engines work well without headphones and a microphone, but the verbal and auditory VKOLE Learning Engines are BEST used with headphones and a microphone. The Learning Engines themselves gradually learn and adjust to accents and less developed pronunciation, so have your student repeat the response into the microphone. Parents also have "Override", "Correct", and "Miss" buttons for the teacher/parent to facilitate this iterative learning process.';

describe("headphone notice", () => {
  it("matches the notice exactly on the parent home and above Alphabet", () => {
    assert.equal(HEADPHONE_NOTICE, VERBATIM);
    const source = readFileSync(new URL("./headphone-notice.ts", import.meta.url), "utf8");
    const card = readFileSync(new URL("../components/headphone-notice.tsx", import.meta.url), "utf8");
    const home = readFileSync(new URL("../routes/index.tsx", import.meta.url), "utf8");
    const session = readFileSync(new URL("../routes/session.$id.tsx", import.meta.url), "utf8");
    assert.equal(source.includes(VERBATIM), true);
    assert.equal(card.includes("{HEADPHONE_NOTICE}"), true);
    assert.equal(card.includes("rounded-2xl border border-line bg-surface p-4 text-sm text-ink"), true);
    assert.equal(home.includes("<HeadphoneNotice />"), true);
    assert.match(session, /climb\.subject === "sp" \? <HeadphoneNotice \/> : null/);
  });
});