import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { showAsSpaceXsi, studentFacingReply } from "./space-xsi.ts";

describe("showAsSpaceXsi", () => {
  it("rewrites only a model naming itself", () => {
    assert.equal(showAsSpaceXsi("I am Grok, and the answer is 4."), "I am VKOLE/ZPD, and the answer is 4.");
    assert.equal(showAsSpaceXsi("As ChatGPT, I would say 4."), "As VKOLE/ZPD, I would say 4.");
    assert.equal(showAsSpaceXsi("I'm Grok."), "I'm VKOLE/ZPD.");
    assert.equal(showAsSpaceXsi("I am VKOLE/ZPD."), "I am VKOLE/ZPD.");
  });

  it("leaves lesson words and people's names unchanged", () => {
    assert.equal(showAsSpaceXsi("Use a model to show 3 x 4"), "Use a model to show 3 x 4");
    assert.equal(showAsSpaceXsi("Claude Monet painted water lilies"), "Claude Monet painted water lilies");
    assert.equal(showAsSpaceXsi("Claudette read about Egypt and a model of government."), "Claudette read about Egypt and a model of government.");
    assert.equal(showAsSpaceXsi("The Grok model says hello."), "The Grok model says hello.");
  });
});

describe("studentFacingReply", () => {
  it("keeps a lesson sentence and a painter's name, and still rewrites a model naming itself", () => {
    assert.equal(studentFacingReply("Use a model to show 3 x 4", true), "Use a model to show 3 x 4");
    assert.equal(studentFacingReply("Claude Monet painted water lilies", false), "Claude Monet painted water lilies");
    assert.equal(studentFacingReply("I am Grok, and the answer is 4.", true), "I am VKOLE/ZPD, and the answer is 4.");
    assert.equal(studentFacingReply("A chatbot named Claude.", false), "A chatbot named Claude.");
    assert.equal(
      studentFacingReply("Answer: 4\n\nExplanation: Use a model to show 3 x 4.", true),
      "Answer: 4\n\nExplanation: Use a model to show 3 x 4.",
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
