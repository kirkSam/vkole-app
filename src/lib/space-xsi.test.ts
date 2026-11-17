import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { showAsSpaceXsi, studentFacingReply } from "./space-xsi.ts";

describe("showAsSpaceXsi", () => {
  it("shows each supporting-model name as VKOLE/ZPD", () => {
    const samples = [
      ["Grok", "VKOLE/ZPD"],
      ["I am Grok.", "I am VKOLE/ZPD."],
      ["grok-4-1-fast-non-reasoning", "VKOLE/ZPD"],
      ["xAI", "VKOLE/ZPD"],
      ["X.AI", "VKOLE/ZPD"],
      ["powered by x.AI", "powered by VKOLE/ZPD"],
      ["powered by Space x.AI", "powered by VKOLE/ZPD"],
      ["OpenAI", "VKOLE/ZPD"],
      ["Claude", "VKOLE/ZPD"],
      ["ChatGPT", "VKOLE/ZPD"],
      ["GPT-4", "VKOLE/ZPD"],
      ["GPT4", "VKOLE/ZPD"],
      ["Ask ChatGPT, not GPT.", "Ask VKOLE/ZPD, not VKOLE/ZPD."],
    ] as const;
    for (const [before, after] of samples) {
      assert.equal(showAsSpaceXsi(before), after);
      assert.equal(showAsSpaceXsi(after), after);
    }
  });

  it("leaves ordinary words that only share letters", () => {
    const text = "Claudette read about Egypt and a model of government.";
    assert.equal(showAsSpaceXsi(text), text);
  });
});

describe("studentFacingReply", () => {
  it("rewrites the model name and still hides chatbot and model", () => {
    assert.equal(studentFacingReply("The Grok model says hello.", true), "The VKOLE/ZPD says hello.");
    assert.equal(studentFacingReply("A chatbot named Claude.", false), "A named VKOLE/ZPD.");
  });

  it("rewrites feedback and the next question the student will read", () => {
    assert.equal(
      studentFacingReply("Answer: 4\n\nExplanation: Grok and ChatGPT agree.", true),
      "Answer: 4\n\nExplanation: VKOLE/ZPD and VKOLE/ZPD agree.",
    );
    assert.equal(
      studentFacingReply("Read: A note from x.AI.\n\nQuestion: What is 2 + 2?", true),
      "Read: A note from VKOLE/ZPD.\n\nQuestion: What is 2 + 2?",
    );
  });
});

describe("retired names", () => {
  it("does not use the retired vendor names", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
    const banned = new RegExp(
      ["Space ", "XAI"].join("") + "|" + ["Space ", "XSI"].join("") + "|super-" + "intelligence",
      "i",
    );
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === "node_modules" || name === ".git") continue;
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
          walk(path);
          continue;
        }
        if (!/\.(ts|tsx|mjs|html|md)$/.test(name)) continue;
        if (banned.test(readFileSync(path, "utf8"))) hits.push(path.slice(root.length + 1));
      }
    };
    for (const dir of ["src", "scripts", "docs"]) walk(join(root, dir));
    if (banned.test(readFileSync(join(root, "README.md"), "utf8"))) hits.push("README.md");
    assert.deepEqual(hits, []);
  });
});
