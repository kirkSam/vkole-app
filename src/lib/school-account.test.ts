import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLOCK_LIMIT_SECONDS,
  SCHOOL_OFFLINE_MESSAGE,
  SCHOOL_WAIT_MESSAGE,
  clockToWrite,
  failureKind,
  parseSchoolProfile,
  resetCode,
  schoolWriteBody,
} from "./school-account.ts";
import {
  SchoolCallError,
  readSchoolAccount,
  registerSchoolAccount,
  requestSchoolReset,
  signInSchoolAccount,
  writeSchoolAccount,
} from "./school-account.server.ts";

const SECRET = "unit-test-secret-do-not-ship";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("school profile", () => {
  it("maps the website account onto the app fields", () => {
    const parsed = parseSchoolProfile({
      ok: true,
      id: "Parent@Example.com",
      profile: {
        access: "open",
        student: { name: "Ada" },
        level: { m: { grade: 3, step: 1 }, ela: 4, other: 9 },
        freeWeekStart: "2026-10-01T00:00:00.000Z",
        clockSeconds: 120,
        seen: ["one", { key: "m:1:0:0", text: "1 + 1 = ?" }],
        subscription: { plan: "year" },
      },
    });
    assert.equal(parsed?.id, "parent@example.com");
    assert.equal(parsed?.profile.access, "open");
    assert.equal(parsed?.profile.studentName, "Ada");
    assert.deepEqual(parsed?.profile.level.m, { grade: 3, step: 1 });
    assert.deepEqual(parsed?.profile.level.ela, { grade: 4, step: 0 });
    assert.equal(parsed?.profile.level.ss, undefined);
    assert.equal(parsed?.profile.freeWeekStart, "2026-10-01T00:00:00.000Z");
    assert.equal(parsed?.profile.clockSeconds, 120);
    assert.equal(parsed?.profile.plan, "year");
    assert.equal(parsed?.profile.seen[1]?.key, "m:1:0:0");
  });

  it("stays closed when access is missing and there is no paid plan", () => {
    const parsed = parseSchoolProfile({ ok: true, id: "a@b.co", profile: {} });
    assert.equal(parsed?.profile.access, "closed");
    assert.equal(parsed?.profile.plan, null);
    assert.equal(parseSchoolProfile({ ok: false, id: "a@b.co" }), null);
  });
});

describe("clock and seen writes", () => {
  it("never decreases the clock and keeps it between 0 and 9000", () => {
    assert.equal(clockToWrite(10, 50), 50);
    assert.equal(clockToWrite(80, 50), 80);
    assert.equal(clockToWrite(-5, -1), 0);
    assert.equal(clockToWrite(CLOCK_LIMIT_SECONDS + 1, 10), CLOCK_LIMIT_SECONDS);
    assert.equal(clockToWrite(Number.NaN, 12.9), 12);
  });

  it("sends the higher clock and unique seen questions", () => {
    const body = schoolWriteBody("a@b.co", { m: { grade: 2, step: 0 } }, 100, 40, [
      { key: "m:1:0:0", text: "stem" },
      { key: "m:1:0:0", text: "other" },
      { key: "", text: "blank" },
    ]);
    assert.equal(body.clockSeconds, 100);
    assert.deepEqual(body.seen, [{ key: "m:1:0:0", text: "stem" }]);
  });
});

describe("website errors", () => {
  it("names a lockout, a missing account, and an unreachable site", () => {
    assert.equal(failureKind(429, {}), "wait");
    assert.equal(failureKind(400, { message: "too many tries" }), "wait");
    assert.equal(failureKind(404, { error: "not found" }), "unknown");
    assert.equal(failureKind(401, { message: "password" }), "password");
    assert.equal(failureKind(409, { message: "already exists" }), "exists");
    assert.equal(failureKind(500, {}), "offline");
    assert.equal(failureKind(0, {}), "offline");
  });

  it("accepts only a 6-digit reset code", () => {
    const coded = resetCode({ ok: true, code: "123456", expiresAt: "2026-10-15T18:00:00.000Z" });
    assert.equal(coded?.code, "123456");
    assert.equal(coded?.expiresAt, "2026-10-15T18:00:00.000Z");
    assert.equal(resetCode({ ok: true, code: "12345" }), null);
    assert.equal(resetCode({ ok: false, code: "123456" }), null);
  });
});

describe("server calls", () => {
  it("posts with the secret and without an Origin header", async () => {
    const seen: { url: string; init: RequestInit | undefined } = { url: "", init: undefined };
    const account = await signInSchoolAccount(
      { email: "Ada@School.test", password: "long-enough" },
      {
        secret: SECRET,
        fetch: async (input, init) => {
          seen.url = input;
          seen.init = init;
          return jsonResponse(200, {
            ok: true,
            id: "ada@school.test",
            profile: { access: "open", studentName: "Ada" },
          });
        },
      },
    );
    assert.equal(account.id, "ada@school.test");
    assert.equal(seen.url, "https://www.dotheimpossible.ai/api/vkole/sign-in");
    const headers = new Headers(seen.init?.headers);
    assert.equal(headers.get("x-vkole-secret"), SECRET);
    assert.equal(headers.get("origin"), null);
    assert.equal(seen.init?.method, "POST");
    assert.equal(seen.init?.referrerPolicy, "no-referrer");
    assert.equal(JSON.parse(String(seen.init?.body)).email, "ada@school.test");
  });

  it("does not call the website when the secret is missing", async () => {
    let called = false;
    await assert.rejects(
      () =>
        signInSchoolAccount(
          { email: "a@b.co", password: "long-enough" },
          {
            secret: "   ",
            fetch: async () => {
              called = true;
              return jsonResponse(200, {});
            },
          },
        ),
      (err: unknown) =>
        err instanceof SchoolCallError &&
        err.reason === "offline" &&
        err.message === SCHOOL_OFFLINE_MESSAGE &&
        !err.message.includes(SECRET),
    );
    assert.equal(called, false);
  });

  it("turns a lockout and a dropped connection into stable messages", async () => {
    await assert.rejects(
      () =>
        registerSchoolAccount(
          { email: "a@b.co", password: "long-enough", name: "Ada" },
          { secret: SECRET, fetch: async () => jsonResponse(429, { error: SECRET }) },
        ),
      (err: unknown) =>
        err instanceof SchoolCallError &&
        err.reason === "wait" &&
        err.message === SCHOOL_WAIT_MESSAGE &&
        !err.message.includes(SECRET),
    );
    await assert.rejects(
      () =>
        readSchoolAccount("a@b.co", {
          secret: SECRET,
          fetch: async () => {
            throw new Error(`connect ${SECRET}`);
          },
        }),
      (err: unknown) => err instanceof SchoolCallError && err.reason === "offline" && !err.message.includes(SECRET),
    );
  });

  it("writes the account and reads a reset code without putting the secret in the result", async () => {
    await writeSchoolAccount(
      { id: "a@b.co", level: { m: { grade: 2, step: 1 } }, clockSeconds: 40, seen: [{ key: "k", text: "t" }] },
      {
        secret: SECRET,
        fetch: async (_input, init) => {
          const headers = new Headers(init?.headers);
          assert.equal(headers.get("origin"), null);
          assert.equal(headers.get("x-vkole-secret"), SECRET);
          const body = JSON.parse(String(init?.body));
          assert.equal(body.email, "a@b.co");
          assert.equal(body.clockSeconds, 40);
          return jsonResponse(200, { ok: true });
        },
      },
    );
    const reset = await requestSchoolReset("A@B.co", {
      secret: SECRET,
      fetch: async (input) => {
        assert.equal(input, "https://www.dotheimpossible.ai/api/vkole/password-reset");
        return jsonResponse(200, { ok: true, code: "654321", expiresAt: "2026-10-15T18:00:00.000Z" });
      },
    });
    assert.equal(reset.code, "654321");
    assert.equal(JSON.stringify(reset).includes(SECRET), false);
  });
});
