import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { mergeLocalSeen, practicePromptFromDetail, practicePromptText } from "./next-sheet.ts";
import {
  CLOCK_LIMIT_SECONDS,
  SCHOOL_OFFLINE_MESSAGE,
  SCHOOL_WAIT_MESSAGE,
  WEBSITE_ERRORS_NOT_EXTRA,
  accountTokenExpired,
  clockToWrite,
  decideStudent,
  DEFAULT_WEBSITE_MASTER_EMAIL,
  clearsLocalProgress,
  failureKind,
  isFreshSchoolProfile,
  keptLevels,
  profileKeepingProgress,
  isWebsiteMasterEmail,
  officeOffer,
  parseSchoolProfile,
  schoolAccessDecision,
  schoolFailureMessage,
  schoolPassword,
  schoolWriteBody,
  websiteMasterEmail,
} from "./school-account.ts";
import {
  SchoolCallError,
  confirmSchoolReset,
  readSchoolAccount,
  registerSchoolAccount,
  requestSchoolReset,
  saveSchoolStudent,
  signInSchoolAccount,
  studentCheck,
  writeSchoolAccount,
} from "./school-account.server.ts";

const SECRET = "unit-test-secret-do-not-ship";
const TOKEN = "account-token";
const EXPIRES = "2026-10-19T04:00:00.000Z";

function session(email: string, family: Record<string, unknown> = {}, token = TOKEN) {
  return { token, expiresAt: EXPIRES, family: { email, ...family } };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("school profile", () => {
  it("maps the website account onto the app fields", () => {
    const parsed = parseSchoolProfile({
      family: {
        email: "Parent@Example.com",
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
    assert.equal(parsed?.profile.officePurchased, false);
    assert.equal(parsed?.profile.officeSlug, null);
  });

  it("reads a purchased office and treats missing or unsafe fields as not purchased", () => {
    const open = parseSchoolProfile({
      family: {
        email: "ada@school.test", officePurchased: true, officeSlug: "ada-l" },
    });
    assert.equal(open?.profile.officePurchased, true);
    assert.equal(open?.profile.officeSlug, "ada-l");
    assert.deepEqual(officeOffer(true, "ada-l"), {
      kind: "office",
      href: "https://www.dotheimpossible.ai/s/ada-l/",
    });
    const missing = parseSchoolProfile({
      family: {
        email: "a@b.co",} });
    assert.equal(missing?.profile.officePurchased, false);
    assert.equal(missing?.profile.officeSlug, null);
    assert.deepEqual(officeOffer(false, null), {
      kind: "package",
      href: "https://www.dotheimpossible.ai/pay/checkout?item=first-month",
    });
    const unsafe = parseSchoolProfile({
      family: {
        email: "a@b.co", officePurchased: true, officeSlug: "../admin" },
    });
    assert.equal(unsafe?.profile.officePurchased, true);
    assert.equal(unsafe?.profile.officeSlug, null);
    assert.equal(officeOffer(true, unsafe?.profile.officeSlug ?? null).kind, "package");
    assert.equal(officeOffer(false, "ada-l").kind, "package");
    const word = parseSchoolProfile({
      family: {
        email: "a@b.co", officePurchased: "true", officeSlug: null },
    });
    assert.equal(word?.profile.officePurchased, false);
  });

  it("stays closed when access is missing and there is no paid plan", () => {
    const parsed = parseSchoolProfile({
      family: {
        email: "a@b.co",} });
    assert.equal(parsed?.profile.access, "closed");
    assert.equal(parsed?.profile.plan, null);
    assert.equal(parseSchoolProfile({ ok: false, id: "a@b.co" }), null);
    assert.equal(parseSchoolProfile({ ok: true, id: "a@b.co", profile: { access: "open" } }), null);
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

  it("sends the higher clock and the displayed prompt, not the pool variant id", () => {
    const body = schoolWriteBody({ m: { grade: 2, step: 0 }, sp: { grade: 1, step: 0, band: "LK", index: 0 } }, 100, 40, [
      { key: "m:1:0:0", text: "What is 2 + 2?" },
      { key: "m:1:0:1", text: "What is 2 + 2?" },
      { key: "m:1:0:2", text: "" },
      { key: "", text: "m:2:0:0" },
      { key: "sw:PP:1", text: "the" },
    ]);
    assert.equal(body.clock.seconds, 100);
    assert.deepEqual(body.seenQuestions, [{ prompt: "What is 2 + 2?" }, { prompt: "the" }]);
    assert.equal("seen" in body, false);
    assert.equal(JSON.stringify(body).includes("m:1:0:0"), false);
    assert.equal(JSON.stringify(body).includes("m:2:0:0"), false);
    assert.equal(body.levels.sp?.band, "cvc");
    assert.equal(body.levels.sp?.word, "a");
    assert.equal(body.levels.sp?.grade, 1);
    assert.equal("student" in body, false);
    assert.equal("id" in body, false);
    const enrolled = schoolWriteBody({ m: { grade: 2, step: 0 } }, 0, 0, [], { name: "Ada", age: 8, startingGrade: 2 });
    assert.deepEqual(enrolled.student, { name: "Ada", age: 8, startingGrade: 2 });
    const many = Array.from({ length: 401 }, (_, index) => ({ key: `m:1:0:${index}`, text: `Prompt ${index}` }));
    assert.equal(schoolWriteBody({}, 0, 0, many).seenQuestions.length, 400);
  });

  it("keeps website practice-sheet text for sight words, phonemic lines, math game, and alphabet letters", () => {
    assert.equal(practicePromptText("sw", { word: "the", question: "sw:PP:0" }), "the");
    assert.equal(practicePromptText("pa", { say: "How many words do you hear? The cat sat." }), "How many words do you hear? The cat sat.");
    assert.equal(practicePromptText("mg", { prompt: "3 + 4 = ?" }), "3 + 4 = ?");
    assert.equal(
      practicePromptText("sp", { letter: "b", question: "What letter comes next?" }),
      "B",
    );
    assert.equal(practicePromptFromDetail("sp", JSON.stringify({ question: "Your turn! What is the first letter of the alphabet?", letter: "A" })), "A");
    assert.equal(practicePromptFromDetail("sw", JSON.stringify({ word: "said", question: "said" })), "said");
    const firstSync = mergeLocalSeen(
      [{ at: "2026-10-01T00:00:00.000Z", key: "m:1:0:0", text: "" }],
      [
        { at: "2026-10-02T00:00:00.000Z", subject: "sw", detail: JSON.stringify({ word: "the" }) },
        { at: "2026-10-03T00:00:00.000Z", subject: "pa", detail: JSON.stringify({ question: "Say the first sound in sun." }) },
        { at: "2026-10-04T00:00:00.000Z", subject: "mg", detail: JSON.stringify({ prompt: "2 + 2 = ?" }) },
        { at: "2026-10-05T00:00:00.000Z", subject: "sp", detail: JSON.stringify({ question: "What letter comes next?", letter: "C" }) },
        { at: "2026-10-05T00:00:00.000Z", subject: "sp", detail: JSON.stringify({ question: "What letter comes next?", letter: "C" }) },
      ],
    );
    assert.deepEqual(
      firstSync.map((item) => item.text),
      ["C", "2 + 2 = ?", "Say the first sound in sun.", "the"],
    );
    const capped = mergeLocalSeen(
      [],
      Array.from({ length: 401 }, (_, index) => ({
        at: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
        subject: "mg",
        detail: JSON.stringify({ prompt: `Item ${index}` }),
      })),
    );
    assert.equal(capped.length, 400);
    assert.equal(capped[0]?.text, "Item 400");
  });
});

describe("website errors", () => {
  it("names a lockout, a missing account, and an unreachable site", () => {
    assert.equal(failureKind(429, {}), "wait");
    assert.equal(failureKind(400, { message: "too many tries" }), "wait");
    assert.equal(failureKind(404, { error: "not found" }), "unknown");
    assert.equal(failureKind(410, { error: "account gone" }), "gone");
    assert.equal(failureKind(404, { code: "account_deleted" }), "gone");
    assert.equal(failureKind(410, { error: "the account was removed" }), "gone");
    assert.equal(failureKind(403, { error: "subscription removed" }), "rejected");
    assert.equal(failureKind(403, { error: "free week deleted" }), "rejected");
    assert.equal(failureKind(402, { message: "trial ended" }), "rejected");
    assert.equal(failureKind(401, { message: "password" }), "password");
    assert.equal(failureKind(409, { message: "already exists" }), "exists");
    assert.equal(failureKind(500, {}), "offline");
    assert.equal(failureKind(0, {}), "offline");
  });

  it("treats a past token as finished and keeps a future one", () => {
    assert.equal(accountTokenExpired("2020-01-01T00:00:00.000Z", Date.parse("2026-10-18T00:00:00.000Z")), true);
    assert.equal(accountTokenExpired("2026-10-19T00:00:00.000Z", Date.parse("2026-10-18T00:00:00.000Z")), false);
    assert.equal(accountTokenExpired("not-a-date"), true);
  });
});

const freshProfile = {
  access: "open" as const,
  studentName: "",
  level: {},
  freeWeekStart: null,
  clockSeconds: 0,
  seen: [],
  plan: null,
  officePurchased: false,
  officeSlug: null,
};

describe("student check", () => {
  it("treats a blank website student as new, including a name that matches the parent", () => {
    const parsed = parseSchoolProfile({
      family: {
        email: "Parent@Example.com",
        parentName: "Ada",
        student: { name: "" },
        level: null,
      },
    });
    assert.equal(parsed?.profile.studentName, "");
    assert.equal(isFreshSchoolProfile(parsed!.profile), true);
    assert.equal(decideStudent(parsed?.profile.studentName, "Ada"), "new");
    assert.equal(decideStudent(undefined, "Ada"), "new");
    assert.equal(decideStudent(null, "Ada"), "new");
    assert.equal(decideStudent("  ", "Ada"), "new");
  });

  it("returns extra only when the saved first name is different, ignoring case", () => {
    assert.equal(decideStudent("Ada", "ada"), "same");
    assert.equal(decideStudent("Ada", " ADA "), "same");
    assert.equal(decideStudent("Ada", "Bea"), "extra");
    const enrolled = parseSchoolProfile({
      family: {
        email: "parent@example.com", student: { name: "Ada" }, level: null, parentName: "Bea" },
    });
    assert.equal(isFreshSchoolProfile(enrolled!.profile), false);
    assert.equal(decideStudent(enrolled?.profile.studentName, "Bea"), "extra");
    assert.equal(decideStudent(enrolled?.profile.studentName, "ada"), "same");
  });

  it("returns new for an empty website student even when a reader could still see local rows", async () => {
    assert.equal(await studentCheck("parent@example.com", "Bea", async () => freshProfile), "new");
    assert.equal(
      await studentCheck("parent@example.com", "ada", async () => ({
        ...freshProfile,
        studentName: "Ada",
        level: { m: { grade: 3, step: 0 } },
      })),
      "same",
    );
    assert.equal(
      await studentCheck("parent@example.com", "Bea", async () => ({
        ...freshProfile,
        studentName: "Ada",
        level: { m: { grade: 3, step: 0 } },
      })),
      "extra",
    );
  });

  it("shows a failed read instead of status extra, including the save and duplicate-email sentences", async () => {
    for (const message of WEBSITE_ERRORS_NOT_EXTRA) {
      await assert.rejects(
        () =>
          studentCheck("parent@example.com", "Ada", async () => {
            throw new SchoolCallError("exists", message);
          }),
        (err: unknown) => err instanceof Error && err.message === message,
      );
    }
    await assert.rejects(
      () =>
        readSchoolAccount("parent@example.com", {
          token: TOKEN,
          fetch: async (input, init) => {
            assert.equal(input, "https://www.dotheimpossible.ai/api/account/family");
            assert.equal(init?.method, "GET");
            assert.equal(init?.body, undefined);
            const headers = new Headers(init?.headers);
            assert.equal(headers.get("authorization"), `Bearer ${TOKEN}`);
            assert.equal(headers.get("x-vkole-secret"), null);
            return jsonResponse(400, { error: "That level could not be saved." });
          },
        }),
      (err: unknown) =>
        err instanceof SchoolCallError && err.message === "That level could not be saved." && err.reason !== "offline",
    );
    await assert.rejects(
      () =>
        studentCheck("parent@example.com", "Ada", (id) =>
          readSchoolAccount(id, {
            token: TOKEN,
            fetch: async () => jsonResponse(409, { error: "An account already exists for that email. Sign in with it." }),
          }),
        ),
      (err: unknown) => err instanceof Error && err.message === "An account already exists for that email. Sign in with it.",
    );
  });
});

describe("server calls", () => {
  it("posts sign-in without a shared secret, cookies, or an Origin header", async () => {
    const seen: { url: string; init: RequestInit | undefined } = { url: "", init: undefined };
    const account = await signInSchoolAccount(
      { email: "Ada@School.test", password: "long-enough" },
      {
        fetch: async (input, init) => {
          seen.url = input;
          seen.init = init;
          return jsonResponse(200, session("ada@school.test", { access: "open", studentName: "Ada" }));
        },
      },
    );
    assert.equal(account.id, "ada@school.test");
    assert.equal(account.token, TOKEN);
    assert.equal(account.expiresAt, EXPIRES);
    assert.equal(account.profile.studentName, "Ada");
    assert.equal(seen.url, "https://www.dotheimpossible.ai/api/account/sign-in");
    const headers = new Headers(seen.init?.headers);
    assert.equal(headers.get("x-vkole-secret"), null);
    assert.equal(headers.get("cookie"), null);
    assert.equal(headers.get("authorization"), null);
    assert.equal(headers.get("origin"), null);
    assert.equal(seen.init?.method, "POST");
    assert.equal(seen.init?.credentials, "omit");
    assert.equal(seen.init?.referrerPolicy, "no-referrer");
    assert.equal(JSON.parse(String(seen.init?.body)).email, "ada@school.test");
    assert.equal(String(seen.url).includes("/api/vkole/"), false);
  });

  it("calls the website when no shared secret is configured", async () => {
    let called = false;
    const account = await signInSchoolAccount(
      { email: "a@b.co", password: "long-enough" },
      {
        fetch: async (_input, init) => {
          called = true;
          const headers = new Headers(init?.headers);
          assert.equal(headers.get("x-vkole-secret"), null);
          assert.equal(headers.has("x-vkole-secret"), false);
          return jsonResponse(200, session("a@b.co", { access: "closed" }));
        },
      },
    );
    assert.equal(called, true);
    assert.equal(account.id, "a@b.co");
    assert.equal(JSON.stringify(account).includes(SECRET), false);
  });

  it("turns a lockout and a dropped connection into stable messages", async () => {
    await assert.rejects(
      () =>
        registerSchoolAccount(
          { email: "a@b.co", password: "long-enough", name: "Ada" },
          { fetch: async () => jsonResponse(429, { error: SECRET }) },
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
          token: TOKEN,
          fetch: async () => {
            throw new Error(`connect ${SECRET}`);
          },
        }),
      (err: unknown) => err instanceof SchoolCallError && err.reason === "offline" && !err.message.includes(SECRET),
    );
  });

  it("saves phonemic progress on level pa with the bearer token and no adult flag", async () => {
    await writeSchoolAccount(
      "a@b.co",
      schoolWriteBody(
        { pa: { grade: 1, step: 0, band: "PS", index: 1, word: "ps-sun", streak: 1, missStreak: 0 } },
        0,
        0,
        [],
      ),
      {
        token: TOKEN,
        fetch: async (input, init) => {
          assert.equal(String(input), "https://www.dotheimpossible.ai/api/account/family");
          assert.equal(init?.method, "POST");
          const headers = new Headers(init?.headers);
          assert.equal(headers.get("authorization"), `Bearer ${TOKEN}`);
          assert.equal(headers.get("x-vkole-secret"), null);
          assert.equal(headers.get("cookie"), null);
          const body = JSON.parse(String(init?.body));
          assert.equal(body.levels.pa.band, "PS");
          assert.equal(body.levels.pa.index, 1);
          assert.equal(body.levels.pa.word, "ps-sun");
          assert.equal(body.levels.pa.streak, 1);
          assert.equal(body.levels.pa.missStreak, 0);
          assert.equal(body.levels.pa.adult, undefined);
          assert.equal(body.levels.pa.approved, undefined);
          assert.equal(JSON.stringify(body).includes("adult"), false);
          return jsonResponse(200, session("a@b.co", { levels: body.levels }));
        },
      },
    );
  });

  it("saves spelling on level sp and asks the website to send the reset code", async () => {
    const paths: string[] = [];
    await writeSchoolAccount(
      "a@b.co",
      schoolWriteBody(
        { m: { grade: 2, step: 1 }, sp: { grade: 1, step: 0, band: "LK", index: 2, word: "lk-next-c" }, mg: { grade: 3, step: 0 } },
        40,
        0,
        [{ key: "k", text: "t" }],
      ),
      {
        token: TOKEN,
        fetch: async (input, init) => {
          paths.push(String(input));
          assert.equal(init?.method, "POST");
          const headers = new Headers(init?.headers);
          assert.equal(headers.get("origin"), null);
          assert.equal(headers.get("x-vkole-secret"), null);
          assert.equal(headers.get("cookie"), null);
          assert.equal(headers.get("authorization"), `Bearer ${TOKEN}`);
          const body = JSON.parse(String(init?.body));
          assert.equal(body.email, undefined);
          assert.equal(body.clock.seconds, 40);
          assert.equal(body.levels.sp.band, "cvc");
          assert.equal(body.levels.sp.word, "c");
          assert.equal(body.levels.sp.grade, 1);
          assert.equal(body.levels.mg.grade, 3);
          assert.deepEqual(body.seenQuestions, [{ prompt: "t" }]);
          assert.equal(body.seen, undefined);
          assert.equal(JSON.stringify(body).includes("m:1:0:0"), false);
          assert.equal(String(input).includes("/api/vkole/"), false);
          assert.equal(String(input).includes("resend"), false);
          assert.equal(String(input).includes("gmail"), false);
          return jsonResponse(200, session("a@b.co", { levels: body.levels, clock: body.clock, seenQuestions: body.seenQuestions }));
        },
      },
    );
    const reset = await requestSchoolReset("A@B.co", {
      fetch: async (input, init) => {
        paths.push(String(input));
        assert.equal(init?.method, "POST");
        assert.deepEqual(JSON.parse(String(init?.body)), { email: "a@b.co" });
        assert.equal(new Headers(init?.headers).get("x-vkole-secret"), null);
        return jsonResponse(200, { message: "Code sent" });
      },
    });
    assert.equal(reset.message, "Code sent");
    assert.equal(paths[0], "https://www.dotheimpossible.ai/api/account/family");
    assert.equal(paths[1], "https://www.dotheimpossible.ai/api/account/forgot-password/send-code");
    assert.equal(paths.some((path) => path.includes("/api/vkole/password-reset")), false);
    assert.equal(JSON.stringify(reset).includes(SECRET), false);
  });

  it("confirms a password reset with the website sentence when the code is refused", async () => {
    let body: unknown = null;
    await confirmSchoolReset(
      { email: "Ada@School.test", code: " 123456 ", newPassword: "long-enough" },
      {
        fetch: async (input, init) => {
          assert.equal(input, "https://www.dotheimpossible.ai/api/account/forgot-password/confirm");
          assert.equal(String(input).includes("/api/vkole/password-reset"), false);
          const headers = new Headers(init?.headers);
          assert.equal(headers.get("x-vkole-secret"), null);
          assert.equal(headers.get("origin"), null);
          body = JSON.parse(String(init?.body));
          return jsonResponse(200, { message: "Password updated" });
        },
      },
    );
    assert.deepEqual(body, { email: "ada@school.test", code: "123456", newPassword: "long-enough" });
    await assert.rejects(
      () =>
        confirmSchoolReset(
          { email: "a@b.co", code: "000000", newPassword: "long-enough" },
          {
            fetch: async () => jsonResponse(400, { error: "That code has expired." }),
          },
        ),
      (err: unknown) => err instanceof SchoolCallError && err.message === "That code has expired.",
    );
  });

  it("signs in a website account after trimming spaces, and retries the typed spelling when lowercase is unknown", async () => {
    const calls: string[] = [];
    const account = await signInSchoolAccount(
      { email: "  Sam@Family.test ", password: "long-enough" },
      {
        fetch: async (input, init) => {
          assert.equal(input, "https://www.dotheimpossible.ai/api/account/sign-in");
          const email = JSON.parse(String(init?.body)).email as string;
          calls.push(email);
          if (email === "sam@family.test") return jsonResponse(404, { error: "No account for this email" });
          return jsonResponse(200, session("sam@family.test", { access: "open", studentName: "Sam" }));
        },
      },
    );
    assert.deepEqual(calls, ["sam@family.test", "Sam@Family.test"]);
    assert.equal(account.id, "sam@family.test");
    assert.equal(account.profile.studentName, "Sam");
  });

  it("treats a token rejection as sign-in again and shows the website sentence", async () => {
    assert.equal(failureKind(401, { error: "Unauthorized" }), "unauthorized");
    assert.equal(failureKind(401, { error: "Invalid email or password" }), "password");
    assert.equal(failureKind(403, { error: "Forbidden secret" }), "rejected");
    let called = false;
    await assert.rejects(
      () =>
        readSchoolAccount("ada@school.test", {
          token: TOKEN,
          expiresAt: "2020-01-01T00:00:00.000Z",
          now: Date.parse("2026-10-18T00:00:00.000Z"),
          fetch: async () => {
            called = true;
            return jsonResponse(200, session("ada@school.test"));
          },
        }),
      (err: unknown) => err instanceof SchoolCallError && err.reason === "unauthorized" && err.message === "Sign in again.",
    );
    assert.equal(called, false);
    await assert.rejects(
      () =>
        readSchoolAccount("ada@school.test", {
          token: "expired-token",
          fetch: async (_input, init) => {
            assert.equal(new Headers(init?.headers).get("authorization"), "Bearer expired-token");
            return jsonResponse(401, { error: "Token expired" });
          },
        }),
      (err: unknown) => err instanceof SchoolCallError && err.reason === "unauthorized" && err.message === "Token expired",
    );
  });

  it("does not open the dotted operator session for an ordinary parent sign-in", async () => {
    await assert.rejects(
      () =>
        signInSchoolAccount(
          { email: "kirksamalpha@gmail.com", password: "long-enough" },
          {
            fetch: async () =>
              jsonResponse(200, session("kirk.sam.alpha@gmail.com", { access: "open", studentName: "Sam" })),
          },
        ),
      (err: unknown) => err instanceof SchoolCallError && err.reason === "rejected",
    );
  });

  it("keeps a new account on the email that was typed", async () => {
    const account = await registerSchoolAccount(
      { email: "kirksamalpha@gmail.com", password: "long-enough", name: "Kirk" },
      {
        fetch: async (_input, init) => {
          const body = JSON.parse(String(init?.body)) as { studentName?: string; name?: string };
          assert.equal(body.studentName, undefined);
          assert.equal(body.name, undefined);
          return jsonResponse(200, session("kirksamalpha@gmail.com", { access: "open", studentName: "" }));
        },
      },
    );
    assert.equal(account.id, "kirksamalpha@gmail.com");
    await assert.rejects(
      () =>
        registerSchoolAccount(
          { email: "kirksamalpha@gmail.com", password: "long-enough", name: "Kirk" },
          {
            fetch: async () => jsonResponse(200, session("kirk.sam.alpha@gmail.com", { access: "open" })),
          },
        ),
      (err: unknown) => err instanceof SchoolCallError && err.reason === "rejected",
    );
  });

  it("registers, then saves the child name with that same token", async () => {
    const email = "ada@family.test";
    const calls: { path: string; method: string; authorization: string | null; body: unknown }[] = [];
    const fetchImpl = async (input: string, init?: RequestInit) => {
      const path = String(input);
      const headers = new Headers(init?.headers);
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ path, method: String(init?.method), authorization: headers.get("authorization"), body });
      assert.equal(headers.get("x-vkole-secret"), null);
      assert.equal(headers.get("cookie"), null);
      if (path.endsWith("/api/account/register")) {
        return jsonResponse(200, session(email, { access: "closed", studentName: "", student: { name: "" } }, "register-token"));
      }
      assert.equal(headers.get("authorization"), "Bearer register-token");
      if (body && typeof body === "object" && "student" in body) {
        return jsonResponse(200, {
          family: {
            email,
            access: "closed",
            studentName: "Ada",
            student: { name: "Ada", age: 8, startingGrade: 2 },
          },
        });
      }
      return jsonResponse(400, { error: "Enter a starting grade from 1 to 12." });
    };
    const account = await registerSchoolAccount(
      { email, password: "long-enough", name: "Parent" },
      { fetch: fetchImpl },
    );
    assert.equal(account.token, "register-token");
    assert.equal(account.expiresAt, EXPIRES);
    const saved = await saveSchoolStudent(
      account.id,
      { name: "Ada", startingGrade: 2, age: 8 },
      { token: account.token, expiresAt: account.expiresAt, fetch: fetchImpl },
    );
    assert.equal(saved.studentName, "Ada");
    assert.equal(isFreshSchoolProfile(saved), false);
    assert.equal(calls[0]?.path, "https://www.dotheimpossible.ai/api/account/register");
    assert.equal(calls[1]?.path, "https://www.dotheimpossible.ai/api/account/family");
    assert.equal(calls[1]?.method, "PATCH");
    assert.equal(calls[1]?.authorization, "Bearer register-token");
    assert.deepEqual(calls[1]?.body, { student: { name: "Ada", startingGrade: 2, age: 8 } });
    await assert.rejects(
      () =>
        saveSchoolStudent(
          account.id,
          { name: "Ada", startingGrade: 2 },
          {
            token: account.token,
            expiresAt: account.expiresAt,
            fetch: async () => jsonResponse(400, { error: "Enter a starting grade from 1 to 12." }),
          },
        ),
      (err: unknown) => err instanceof SchoolCallError && err.message === "Enter a starting grade from 1 to 12.",
    );
  });

  it("registers on the website, then signs in with the same email and password", async () => {
    const typedPassword = `unit-test-pass\r\n`;
    const stored = new Map<string, string>();
    const calls: { path: string; email: string; samePassword: boolean }[] = [];
    const fetchImpl = async (input: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { email?: string; password?: string };
      const path = String(input);
      const email = String(body.email ?? "");
      const password = String(body.password ?? "");
      calls.push({
        path,
        email,
        samePassword: password === schoolPassword(typedPassword) && !password.includes("\n"),
      });
      if (path.endsWith("/api/account/register")) {
        stored.set(email, password);
        return jsonResponse(
          200,
          session(email, { access: "closed", studentName: "", freeWeekStart: "1970-01-01T00:00:00.000Z" }),
        );
      }
      const saved = stored.get(email);
      if (saved == null || saved !== password) {
        return jsonResponse(401, { error: "Invalid email or password" });
      }
      return jsonResponse(
        200,
        session(email, { access: "closed", studentName: "", freeWeekStart: "1970-01-01T00:00:00.000Z" }),
      );
    };
    const registered = await registerSchoolAccount(
      { email: "  KirkSamAlpha@DotHeimpossible.ai ", password: typedPassword, name: "Parent" },
      { fetch: fetchImpl },
    );
    const signedIn = await signInSchoolAccount(
      { email: "KirkSamAlpha@DotHeimpossible.ai", password: typedPassword },
      { fetch: fetchImpl },
    );
    assert.equal(registered.id, DEFAULT_WEBSITE_MASTER_EMAIL);
    assert.equal(signedIn.id, registered.id);
    assert.equal(calls.length, 2);
    assert.equal(calls[0]?.path.endsWith("/api/account/register"), true);
    assert.equal(calls[1]?.path.endsWith("/api/account/sign-in"), true);
    assert.equal(calls[0]?.email, DEFAULT_WEBSITE_MASTER_EMAIL);
    assert.equal(calls[1]?.email, calls[0]?.email);
    assert.equal(calls.every((call) => call.samePassword), true);
    assert.equal(registered.profile.access, "open");
    assert.equal(signedIn.profile.access, "open");
    const decision = schoolAccessDecision({
      email: signedIn.id,
      access: "closed",
      freeWeekStart: "1970-01-01T00:00:00.000Z",
      now: Date.parse("2026-10-17T19:00:00.000Z"),
    });
    assert.equal(decision.fullAccess, true);
    assert.equal(decision.showTrialPage, false);
    assert.equal(decision.blocked, false);
    assert.equal(decision.expired, false);
    assert.equal(decision.endsAt, null);
  });

  it("keeps a website sentence instead of calling every sign-in failure a mismatch", async () => {
    assert.equal(
      schoolFailureMessage(true, "unknown", "No account for that email yet. Create one at /engine."),
      "No account for that email yet. Create one at /engine.",
    );
    assert.equal(schoolFailureMessage(true, "password", ""), "Email or password did not match.");
    assert.equal(
      schoolFailureMessage(true, "rejected", "The password needs at least 8 characters."),
      "The password needs at least 8 characters.",
    );
    const missing = "No account for that email yet. Create one at /engine.";
    await assert.rejects(
      () =>
        signInSchoolAccount(
          { email: "parent@example.com", password: "long-enough" },
          { fetch: async () => jsonResponse(404, { error: missing }) },
        ),
      (err: unknown) => err instanceof SchoolCallError && err.reason === "unknown" && err.message === missing,
    );
  });

  it("shows the website account errors as they were sent", async () => {
    const errors = ["No account for this email", "Invalid email or password", "Account already exists"] as const;
    await assert.rejects(
      () =>
        signInSchoolAccount(
          { email: "parent@example.com", password: "long-enough" },
          { fetch: async () => jsonResponse(404, { error: errors[0] }) },
        ),
      (err: unknown) => err instanceof SchoolCallError && err.message === errors[0],
    );
    await assert.rejects(
      () =>
        signInSchoolAccount(
          { email: "parent@example.com", password: "long-enough" },
          { fetch: async () => jsonResponse(401, { error: errors[1] }) },
        ),
      (err: unknown) => err instanceof SchoolCallError && err.message === errors[1] && err.reason === "password",
    );
    await assert.rejects(
      () =>
        registerSchoolAccount(
          { email: "parent@example.com", password: "long-enough", name: "Parent" },
          { fetch: async () => jsonResponse(409, { error: errors[2] }) },
        ),
      (err: unknown) => err instanceof SchoolCallError && err.message === errors[2] && err.reason === "exists",
    );
  });

  it("re-hydrates spelling and mg from GET family with the bearer token", async () => {
    const profile = await readSchoolAccount("ada@school.test", {
      token: TOKEN,
      fetch: async (input, init) => {
        assert.equal(input, "https://www.dotheimpossible.ai/api/account/family");
        assert.equal(init?.method, "GET");
        assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${TOKEN}`);
        return jsonResponse(200, {
          family: {
            email: "ada@school.test",
            studentName: "Ada",
            levels: {
              sp: { grade: 1, band: "LK", index: 1, word: "lk-next-b" },
              mg: { grade: 4, step: 2, note: "kept" },
            },
            clock: { seconds: 15 },
            seen: [{ key: "sp:1", text: "letter" }],
          },
        });
      },
    });
    assert.equal(profile.level.sp?.band, "LK");
    assert.equal(profile.level.sp?.word, "lk-next-b");
    assert.equal(profile.level.mg?.grade, 4);
    assert.equal(profile.level.mg?.step, 2);
    assert.equal((profile.level.mg as { note?: string } | undefined)?.note, "kept");
    assert.equal(profile.clockSeconds, 15);
    assert.equal(profile.seen[0]?.text, "letter");
  });

  it("does not send the shared secret from browser code", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..");
    const files = [
      ...walk(join(root, "components")),
      ...walk(join(root, "routes")).filter((path) => !path.endsWith(join("api", "vkole", "purge.ts"))),
      join(root, "lib", "school-account.ts"),
      join(root, "lib", "school-auth.ts"),
      join(root, "lib", "account-purge.ts"),
    ];
    for (const path of files) {
      const text = readFileSync(path, "utf8");
      assert.equal(text.includes("x-vkole-secret"), false, path);
      assert.equal(text.includes("VKOLE_SHARED_SECRET"), false, path);
    }
    const server = readFileSync(join(root, "lib", "school-account.server.ts"), "utf8");
    assert.equal(server.includes('set("x-vkole-secret"'), false);
    assert.equal(server.includes("VKOLE_SHARED_SECRET"), false);
    assert.equal(server.includes("/api/account/forgot-password/send-code"), true);
    assert.equal(server.includes('"/api/vkole/password-reset"'), true);
  });
});

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (name.endsWith(".ts") || name.endsWith(".tsx")) out.push(path);
  }
  return out;
}

describe("master access", () => {
  it("never shows the trial page for the master email", () => {
    assert.equal(websiteMasterEmail(""), DEFAULT_WEBSITE_MASTER_EMAIL);
    assert.equal(websiteMasterEmail("  Owner@School.test "), "owner@school.test");
    assert.equal(websiteMasterEmail("teacher@school.test, helper@school.test"), DEFAULT_WEBSITE_MASTER_EMAIL);
    assert.equal(isWebsiteMasterEmail(" KirkSamAlpha@DotHeimpossible.ai "), true);
    assert.equal(isWebsiteMasterEmail("kirksam.alpha@dotheimpossible.ai"), false);
    assert.equal(isWebsiteMasterEmail("kirksamalpha@gmail.com"), false);
    const now = Date.parse("2026-10-17T19:00:00.000Z");
    for (const access of ["open", "closed", null] as const) {
      const decision = schoolAccessDecision({
        email: DEFAULT_WEBSITE_MASTER_EMAIL,
        access,
        freeWeekStart: null,
        now,
      });
      assert.equal(decision.showTrialPage, false);
      assert.equal(decision.blocked, false);
      assert.equal(decision.fullAccess, true);
    }
    const finished = schoolAccessDecision({
      email: "parent@example.com",
      access: "closed",
      freeWeekStart: "1970-01-01T00:00:00.000Z",
      now,
    });
    assert.equal(finished.showTrialPage, true);
    assert.equal(finished.fullAccess, false);
    const named = schoolAccessDecision({
      email: "owner@school.test",
      access: "closed",
      freeWeekStart: null,
      masterRaw: "owner@school.test",
      now,
    });
    assert.equal(named.showTrialPage, false);
    const notMaster = schoolAccessDecision({
      email: DEFAULT_WEBSITE_MASTER_EMAIL,
      access: "closed",
      freeWeekStart: null,
      masterRaw: "owner@school.test",
      now,
    });
    assert.equal(notMaster.fullAccess, false);
    assert.equal(notMaster.showTrialPage, true);
  });
});

describe("progress after a lapse", () => {
  const stored = {
    studentName: "Ada",
    level: {
      m: { grade: 4, step: 2 },
      sp: { grade: 1, step: 0, band: "LK", index: 12, word: "lk-next-m" },
      sw: { grade: 3, step: 0, band: "F-6", index: 4, word: "enough" },
    },
    freeWeekStart: "2026-01-01T00:00:00.000Z",
    clockSeconds: 120,
    plan: "month" as const,
  };

  it("does not treat a closed family as a new account", () => {
    const lapsed = { ...freshProfile, access: "closed" as const };
    assert.equal(isFreshSchoolProfile(lapsed), true);
    assert.equal(clearsLocalProgress(lapsed), false);
    assert.equal(clearsLocalProgress(lapsed, stored), false);
    assert.equal(clearsLocalProgress(freshProfile), true);
    assert.equal(clearsLocalProgress(freshProfile, stored), false);
    assert.equal(clearsLocalProgress({ ...freshProfile, studentName: "Ada" }), false);
  });

  it("keeps the further level and the saved student when the website sends an empty or starter book", () => {
    const kept = keptLevels(stored.level, {
      m: { grade: 1, step: 0 },
      sp: { grade: 1, step: 0 },
      sw: { grade: 1, step: 0, band: "D-PP", index: 0 },
    });
    assert.equal(kept.m?.grade, 4);
    assert.equal(kept.m?.step, 2);
    assert.equal(kept.sp?.index, 12);
    assert.equal(kept.sw?.band, "F-6");
    assert.equal(keptLevels(stored.level, {}).m?.grade, 4);
    assert.equal(keptLevels(stored.level, { m: { grade: 6, step: 0 } }).m?.grade, 6);
    const profile = profileKeepingProgress(stored, {
      ...freshProfile,
      access: "closed",
      clockSeconds: 0,
      seen: [],
    });
    assert.equal(profile.access, "closed");
    assert.equal(profile.studentName, "Ada");
    assert.equal(profile.level.m?.grade, 4);
    assert.equal(profile.level.sp?.word, "lk-next-m");
    assert.equal(profile.clockSeconds, 120);
    assert.equal(profile.freeWeekStart, stored.freeWeekStart);
    assert.equal(profile.plan, "month");
    assert.equal(schoolAccessDecision({
      email: "parent@example.com",
      access: profile.access,
      freeWeekStart: profile.freeWeekStart,
      now: Date.parse("2026-10-20T00:00:00.000Z"),
    }).blocked, true);
  });
});
