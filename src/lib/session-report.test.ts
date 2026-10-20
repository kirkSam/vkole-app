import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fromCrossJSON } from "seroval";
import { academicLetter, trialState } from "./academic-email.ts";
import { LEVEL_KEYS } from "./school-account.ts";
import { postSessionEndReport } from "./session-report.server.ts";
import { reportLine, sessionEndReport, type SessionEndReport } from "./session-report.ts";

function sample(subject: SessionEndReport["subject"], engine: string): SessionEndReport {
  return sessionEndReport({
    name: "Ada",
    email: "ada@family.test",
    engine,
    subject,
    startedAt: 1,
    untimed: true,
    startingGrade: 1,
    grade: 2,
    code: "LK",
    label: "M",
    reached: 3,
    missed: 1,
    trialEndsAt: 2,
    lines: [{ correct: true, engine, question: "M" }],
    sheet: [],
  });
}

describe("session-end report subject", () => {
  it("keeps the engine display name and sets subject to the engine id", () => {
    const names: Record<SessionEndReport["subject"], string> = {
      m: "VKOLE/M",
      ela: "VKOLE/ELA",
      ss: "VKOLE/SS",
      gen: "VKOLE/gen",
      sg: "VKOLE/Singapore",
      sw: "VKOLE/SW",
      pa: "VKOLE/PA",
      mg: "VKOLE/Math Game",
      sp: "VKOLE/Spelling",
    };
    assert.deepEqual(LEVEL_KEYS, ["m", "ela", "ss", "gen", "sg", "sw", "pa", "mg", "sp"]);
    for (const subject of LEVEL_KEYS) {
      const report = sample(subject, names[subject]);
      assert.equal(report.subject, subject);
      assert.equal(report.engine, names[subject]);
    }
  });

  it("posts subject beside the engine display name and does not use the live network", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const previous = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("live network is not allowed in this test");
    };
    try {
      const result = await postSessionEndReport(sample("sp", "VKOLE/Spelling"), {
        token: "unit-token",
        fetch: async (url, init) => {
          calls.push({ url: String(url), init: init ?? {} });
          return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
        },
      });
      assert.equal(result.ok, true);
    } finally {
      globalThis.fetch = previous;
    }
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0]?.url,
      "https://www.dotheimpossible.ai/_serverFn/7a5f5706d9c2ad4456772f2370c95bbcb23cc10a1619e116b45a364dca15a195",
    );
    const headers = new Headers(calls[0]?.init.headers);
    assert.equal(headers.get("x-tsr-serverfn"), "true");
    assert.equal(headers.get("origin"), "https://www.dotheimpossible.ai");
    assert.equal(calls[0]?.init.method, "POST");
    const wire = JSON.parse(String(calls[0]?.init.body)) as { t: unknown };
    const decoded = fromCrossJSON<{ data: SessionEndReport & { token: string } }>(wire.t as never, {});
    assert.equal(decoded.data.subject, "sp");
    assert.equal(decoded.data.engine, "VKOLE/Spelling");
    assert.equal(decoded.data.token, "unit-token");
    assert.equal(decoded.data.email, "ada@family.test");
  });

  it("keeps the progress-letter engine name and does not use the engine id as the email subject", () => {
    const letter = academicLetter({
      firstName: "Ada",
      age: 7,
      subject: "sp",
      level: 1,
      standardCode: "LK",
      standardLabel: "M",
      asked: 1,
      rightCount: 1,
      parentEmail: "ada@family.test",
      trial: trialState("2026-10-01T00:00:00.000Z"),
      events: [],
    });
    assert.match(letter.subject, /progress report for Ada/);
    assert.equal(letter.subject, "VKOLE/ZPD - Space XSI Integrated Learning Engine progress report for Ada");
    assert.match(letter.body, /Engine: VKOLE\/Spelling/);
    assert.equal(letter.body.includes("Engine: sp"), false);
  });

  it("reads a stored work line without dropping its engine name", () => {
    const line = reportLine({
      at: "2026-10-01T00:00:00.000Z",
      detail: JSON.stringify({ engine: "VKOLE/M", correct: true, question: "1 + 1" }),
      levelAfter: 1,
      correct: true,
    });
    assert.equal(line.engine, "VKOLE/M");
    assert.equal(line.question, "1 + 1");
  });

  it("asks for the website mail from the sitting close with climb.subject", () => {
    const source = readFileSync(new URL("./climbs.ts", import.meta.url), "utf8");
    assert.match(source, /subject: climb\.subject/);
    assert.match(source, /engine: `VKOLE\/\$\{subjectMeta\(climb\.subject\)\.code\}`/);
    assert.match(source, /postSessionEndReport/);
  });
});
