import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  ALPHABET_REPORT_LABEL,
  ALPHABET_REPORT_MAX_TOKENS,
  ALPHABET_REPORT_MODEL,
  reportSentences,
  savedAlphabetReport,
  alphabetReportLines,
  alphabetStatsFromEvents,
  templateAlphabetReport,
  writeAlphabetReport,
  type AlphabetSessionStats,
} from "./report.ts";

const LABEL = "Report written by Space XSI (Grok)";
const sessionFile = fileURLToPath(new URL("../../../routes/session.$id.tsx", import.meta.url));
const homeFile = fileURLToPath(new URL("../../../routes/index.tsx", import.meta.url));
const emailFile = fileURLToPath(new URL("../../academic-email.ts", import.meta.url));
const climbsFile = fileURLToPath(new URL("../../climbs.ts", import.meta.url));
const reportFile = fileURLToPath(new URL("./report.ts", import.meta.url));

const stats: AlphabetSessionStats = {
  practiced: ["A", "B", "C"],
  mastered: ["A", "B"],
  practice: ["C"],
  correct: 2,
  missed: 1,
  silent: 1,
};

const grokText = "This sitting practiced A, B, and C. A and B were mastered. C still needs practice. Keep the practice short and kind.";

describe("spelling parent report", () => {
  it("uses the label Report written by Space XSI (Grok) on the screen, in the email, and in the tests", () => {
    assert.equal(ALPHABET_REPORT_LABEL, LABEL);
    assert.equal(LABEL, "Report written by Space XSI (Grok)");
    const session = readFileSync(sessionFile, "utf8");
    const home = readFileSync(homeFile, "utf8");
    const email = readFileSync(emailFile, "utf8");
    assert.equal(session.includes("{ALPHABET_REPORT_LABEL}"), true);
    assert.equal(home.includes("{ALPHABET_REPORT_LABEL}"), true);
    assert.equal(email.includes("ALPHABET_REPORT_LABEL"), true);
    assert.equal(email.includes('input.subject === "sp"'), true);
    assert.equal(session.includes("showAsSpaceXsi(ALPHABET_REPORT_LABEL)"), false);
    assert.equal(home.includes("showAsSpaceXsi(ALPHABET_REPORT_LABEL)"), false);
    assert.deepEqual(alphabetReportLines(grokText), [LABEL, grokText]);
    assert.deepEqual(alphabetReportLines("  "), []);
    assert.equal(email.includes("alphabetReportLines"), true);
    assert.equal(email.includes("${alphabetReport}"), true);
  });

  it("builds letter stats from this sitting only, and writes a 3 to 5 sentence template", () => {
    const built = alphabetStatsFromEvents([
      { detail: JSON.stringify({ letter: "A", outcome: "correct" }), correct: true },
      { detail: JSON.stringify({ letter: "B", outcome: "timeout" }), correct: false },
      { detail: JSON.stringify({ letter: "B", outcome: "miss" }), correct: false },
      { detail: JSON.stringify({ letter: "A", outcome: "correct" }), correct: true },
      { detail: JSON.stringify({ letter: "C", outcome: "correct" }), correct: true },
      { detail: JSON.stringify({ question: "other family" }), correct: false },
    ]);
    assert.deepEqual(built.practiced, ["A", "B", "C"]);
    assert.deepEqual(built.mastered, ["A", "C"]);
    assert.deepEqual(built.practice, ["B"]);
    assert.equal(built.correct, 3);
    assert.equal(built.missed, 1);
    assert.equal(built.silent, 1);
    const text = templateAlphabetReport(built);
    const count = reportSentences(text).length;
    assert.ok(count >= 3 && count <= 5);
    assert.equal(text.includes("A, B, and C"), true);
    assert.equal(text.includes("A and C"), true);
    assert.equal(text.includes("B"), true);
    assert.equal(text.includes("@"), false);
    const quiet = reportSentences(templateAlphabetReport({ practiced: [], mastered: [], practice: [], correct: 0, missed: 0, silent: 0 }));
    assert.ok(quiet.length >= 3 && quiet.length <= 5);
    assert.equal(savedAlphabetReport("  Already written.  "), "Already written.");
    assert.equal(savedAlphabetReport("   "), "");
  });

  it("calls Grok once with only this student's letter stats, and never logs the key", async () => {
    const key = "test-key-do-not-log";
    const previous = process.env.XAI_API_KEY;
    process.env.XAI_API_KEY = key;
    process.env.OTHER_FAMILY_NAME = "Bea Other";
    const logs: string[] = [];
    const originals = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
    };
    const record = (...args: unknown[]) => {
      logs.push(args.map((item) => String(item)).join(" "));
    };
    console.log = record;
    console.info = record;
    console.warn = record;
    console.error = record;
    console.debug = record;
    const calls: { url: string; init: { headers: Record<string, string>; body: string } }[] = [];
    try {
      const written = await writeAlphabetReport({ ...stats, practiced: ["A", "B", "C", "Bea Other"] }, async (url, init) => {
        calls.push({ url, init });
        return new Response(JSON.stringify({ choices: [{ message: { content: grokText } }] }), { status: 200 });
      });
      assert.equal(written.source, "grok");
      assert.equal(written.text, grokText);
      assert.equal(calls.length, 1);
      const call = calls[0];
      assert.ok(call);
      assert.equal(call.url, "https://api.x.ai/v1/chat/completions");
      assert.equal(call.init.headers.Authorization, `Bearer ${key}`);
      const body = JSON.parse(call.init.body) as {
        model: string;
        max_tokens: number;
        messages: { role: string; content: string }[];
      };
      assert.equal(body.model, ALPHABET_REPORT_MODEL);
      assert.equal(body.model, "grok-4-1-fast-non-reasoning");
      assert.equal(body.max_tokens, ALPHABET_REPORT_MAX_TOKENS);
      assert.ok(body.max_tokens <= 200);
      assert.equal(body.messages.length, 2);
      const user = body.messages.find((message) => message.role === "user")?.content ?? "";
      const payload = JSON.parse(user) as AlphabetSessionStats;
      assert.deepEqual(payload, { practiced: ["A", "B", "C"], mastered: ["A", "B"], practice: ["C"], correct: 2, missed: 1, silent: 1 });
      const packed = JSON.stringify(body);
      assert.equal(packed.includes("Bea"), false);
      assert.equal(packed.includes("Other"), false);
      assert.equal(packed.includes("@"), false);
      assert.equal(packed.toLowerCase().includes("audio"), false);
      assert.equal(packed.includes(key), false);
      assert.equal(logs.join("\n").includes(key), false);
      const source = readFileSync(reportFile, "utf8");
      assert.equal(source.includes(LABEL), true);
      assert.equal(source.includes("console."), false);
      const climbs = readFileSync(climbsFile, "utf8");
      const savedAt = climbs.indexOf("savedAlphabetReport");
      const writeAt = climbs.indexOf("await writeAlphabetReport");
      assert.ok(savedAt > 0);
      assert.ok(writeAt > savedAt);
      assert.equal(climbs.includes("if (saved)"), true);
    } finally {
      console.log = originals.log;
      console.info = originals.info;
      console.warn = originals.warn;
      console.error = originals.error;
      console.debug = originals.debug;
      if (previous == null) delete process.env.XAI_API_KEY;
      else process.env.XAI_API_KEY = previous;
      delete process.env.OTHER_FAMILY_NAME;
    }
  });

  it("uses the template when the key is missing, the call fails, or the reply is unusable", async () => {
    const previous = process.env.XAI_API_KEY;
    delete process.env.XAI_API_KEY;
    let calls = 0;
    const missing = await writeAlphabetReport(stats, async () => {
      calls += 1;
      return new Response("{}", { status: 200 });
    });
    assert.equal(calls, 0);
    assert.equal(missing.source, "template");
    assert.ok(reportSentences(missing.text).length >= 3);
    process.env.XAI_API_KEY = "test-key-do-not-log";
    const failed = await writeAlphabetReport(stats, async () => new Response("no", { status: 503 }));
    assert.equal(failed.source, "template");
    const thrown = await writeAlphabetReport(stats, async () => {
      throw new Error("network");
    });
    assert.equal(thrown.source, "template");
    assert.equal(thrown.text.includes("test-key-do-not-log"), false);
    const leaked = await writeAlphabetReport(stats, async () => {
      return new Response(JSON.stringify({ choices: [{ message: { content: "The key is test-key-do-not-log. Then more. And more." } }] }), {
        status: 200,
      });
    });
    assert.equal(leaked.source, "template");
    const short = await writeAlphabetReport(stats, async () => {
      return new Response(JSON.stringify({ choices: [{ message: { content: "Only one sentence." } }] }), { status: 200 });
    });
    assert.equal(short.source, "template");
    if (previous == null) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = previous;
  });
});
