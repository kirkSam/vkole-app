import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { showAsSpaceXsi, studentFacingReply } from "./space-xsi.ts";

describe("showAsSpaceXsi", () => {
  it("shows each supporting-model name as Space XSI", () => {
    const samples = [
      ["Grok", "Space XSI"],
      ["I am Grok.", "I am Space XSI."],
      ["grok-4-1-fast-non-reasoning", "Space XSI"],
      ["xAI", "Space XSI"],
      ["X.AI", "Space XSI"],
      ["powered by x.AI", "powered by Space XSI"],
      ["powered by Space x.AI", "powered by Space XSI"],
      ["OpenAI", "Space XSI"],
      ["Claude", "Space XSI"],
      ["ChatGPT", "Space XSI"],
      ["GPT-4", "Space XSI"],
      ["GPT4", "Space XSI"],
      ["Ask ChatGPT, not GPT.", "Ask Space XSI, not Space XSI."],
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
    assert.equal(studentFacingReply("The Grok model says hello.", true), "The Space XSI says hello.");
    assert.equal(studentFacingReply("A chatbot named Claude.", false), "A named Space XSI.");
  });

  it("rewrites feedback and the next question the student will read", () => {
    assert.equal(
      studentFacingReply("Answer: 4\n\nExplanation: Grok and ChatGPT agree.", true),
      "Answer: 4\n\nExplanation: Space XSI and Space XSI agree.",
    );
    assert.equal(
      studentFacingReply("Read: A note from x.AI.\n\nQuestion: What is 2 + 2?", true),
      "Read: A note from Space XSI.\n\nQuestion: What is 2 + 2?",
    );
  });
});
