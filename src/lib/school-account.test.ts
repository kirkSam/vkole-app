import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLOCK_LIMIT_SECONDS,
  SCHOOL_OFFLINE_MESSAGE,
  SCHOOL_WAIT_MESSAGE,
  WEBSITE_ERRORS_NOT_EXTRA,
  clockToWrite,
  decideStudent,
  DEFAULT_WEBSITE_MASTER_EMAIL,
  failureKind,
  isFreshSchoolProfile,
  isWebsiteMasterEmail,
  officeOffer,
  parseSchoolProfile,
  resetCode,
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
  signInSchoolAccount,
  studentCheck,
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
    assert.equal(parsed?.profile.officePurchased, false);
    assert.equal(parsed?.profile.officeSlug, null);
  });

  it("reads a purchased office and treats missing or unsafe fields as not purchased", () => {
    const open = parseSchoolProfile({
      ok: true,
      id: "ada@school.test",
      profile: { officePurchased: true, officeSlug: "ada-l" },
    });
    assert.equal(open?.profile.officePurchased, true);
    assert.equal(open?.profile.officeSlug, "ada-l");
    assert.deepEqual(officeOffer(true, "ada-l"), {
      kind: "office",
      href: "https://www.dotheimpossible.ai/s/ada-l/",
    });
    const missing = parseSchoolProfile({ ok: true, id: "a@b.co", profile: {} });
    assert.equal(missing?.profile.officePurchased, false);
    assert.equal(missing?.profile.officeSlug, null);
    assert.deepEqual(officeOffer(false, null), {
      kind: "package",
      href: "https://www.dotheimpossible.ai/pay/checkout?item=first-month",
    });
    const unsafe = parseSchoolProfile({
      ok: true,
      id: "a@b.co",
      profile: { officePurchased: true, officeSlug: "../admin" },
    });
    assert.equal(unsafe?.profile.officePurchased, true);
    assert.equal(unsafe?.profile.officeSlug, null);
    assert.equal(officeOffer(true, unsafe?.profile.officeSlug ?? null).kind, "package");
    assert.equal(officeOffer(false, "ada-l").kind, "package");
    const word = parseSchoolProfile({
      ok: true,
      id: "a@b.co",
      profile: { officePurchased: "true", officeSlug: null },
    });
    assert.equal(word?.profile.officePurchased, false);
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
    assert.equal(body.student, undefined);
  });

  it("sends the first child's name so the website can enroll that student", () => {
    const body = schoolWriteBody("a@b.co", { m: { grade: 2, step: 0 } }, 0, 0, [], "Ada");
    assert.deepEqual(body.student, { name: "Ada" });
  });
});

describe("website errors", () => {
  it("names a lockout, a missing account, and an unreachable site", () => {
    assert.equal(failureKind(429, {}), "wait");
    assert.equal(failureKind(400, { message: "too many tries" }), "wait");
    assert.equal(failureKind(404, { error: "not found" }), "unknown");
    assert.equal(failureKind(410, { error: "account gone" }), "gone");
    assert.equal(failureKind(404, { code: "account_deleted" }), "gone");
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
      ok: true,
      id: "Parent@Example.com",
      profile: {
        parentName: "Ada",
        email: "parent@example.com",
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
      ok: true,
      id: "parent@example.com",
      profile: { student: { name: "Ada" }, level: null, parentName: "Bea" },
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
          secret: SECRET,
          fetch: async (input, init) => {
            assert.equal(input, "https://www.dotheimpossible.ai/api/vkole/read");
            assert.equal(JSON.parse(String(init?.body)).email, "parent@example.com");
            return jsonResponse(400, { ok: false, error: "That level could not be saved." });
          },
        }),
      (err: unknown) =>
        err instanceof SchoolCallError && err.message === "That level could not be saved." && err.reason !== "offline",
    );
    await assert.rejects(
      () =>
        studentCheck("parent@example.com", "Ada", (id) =>
          readSchoolAccount(id, {
            secret: SECRET,
            fetch: async () => jsonResponse(409, { message: "An account already exists for that email. Sign in with it." }),
          }),
        ),
      (err: unknown) => err instanceof Error && err.message === "An account already exists for that email. Sign in with it.",
    );
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

  it("confirms a password reset with the website sentence when the code is refused", async () => {
    let body: unknown = null;
    await confirmSchoolReset(
      { email: "Ada@School.test", code: " 123456 ", newPassword: "long-enough" },
      {
        secret: SECRET,
        fetch: async (input, init) => {
          assert.equal(input, "https://www.dotheimpossible.ai/api/vkole/password-reset/confirm");
          const headers = new Headers(init?.headers);
          assert.equal(headers.get("x-vkole-secret"), SECRET);
          assert.equal(headers.get("origin"), null);
          body = JSON.parse(String(init?.body));
          return jsonResponse(200, { ok: true });
        },
      },
    );
    assert.deepEqual(body, { email: "ada@school.test", code: "123456", newPassword: "long-enough" });
    await assert.rejects(
      () =>
        confirmSchoolReset(
          { email: "a@b.co", code: "000000", newPassword: "long-enough" },
          {
            secret: SECRET,
            fetch: async () => jsonResponse(400, { ok: false, error: "That code has expired." }),
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
        secret: SECRET,
        fetch: async (input, init) => {
          assert.equal(input, "https://www.dotheimpossible.ai/api/vkole/sign-in");
          const email = JSON.parse(String(init?.body)).email as string;
          calls.push(email);
          if (email === "sam@family.test") return jsonResponse(404, { ok: false, error: "No account for that email." });
          return jsonResponse(200, { ok: true, profile: { access: "open", studentName: "Sam" } });
        },
      },
    );
    assert.deepEqual(calls, ["sam@family.test", "Sam@Family.test"]);
    assert.equal(account.id, "sam@family.test");
    assert.equal(account.profile.studentName, "Sam");
  });

  it("treats a secret rejection as offline, not as an unrecognized password", () => {
    assert.equal(failureKind(401, { error: "Unauthorized" }), "offline");
    assert.equal(failureKind(403, { error: "Forbidden secret" }), "offline");
  });

  it("does not open the dotted operator session for an ordinary parent sign-in", async () => {
    await assert.rejects(
      () =>
        signInSchoolAccount(
          { email: "kirksamalpha@gmail.com", password: "long-enough" },
          {
            secret: SECRET,
            fetch: async () =>
              jsonResponse(200, {
                ok: true,
                id: "kirk.sam.alpha@gmail.com",
                email: "kirk.sam.alpha@gmail.com",
                profile: { access: "open", studentName: "Sam" },
              }),
          },
        ),
      (err: unknown) => err instanceof SchoolCallError && err.reason === "rejected",
    );
  });

  it("keeps a new account on the email that was typed", async () => {
    const account = await registerSchoolAccount(
      { email: "kirksamalpha@gmail.com", password: "long-enough", name: "Kirk" },
      {
        secret: SECRET,
        fetch: async () =>
          jsonResponse(200, {
            ok: true,
            id: "kirksamalpha@gmail.com",
            profile: { access: "open", studentName: "" },
          }),
      },
    );
    assert.equal(account.id, "kirksamalpha@gmail.com");
    await assert.rejects(
      () =>
        registerSchoolAccount(
          { email: "kirksamalpha@gmail.com", password: "long-enough", name: "Kirk" },
          {
            secret: SECRET,
            fetch: async () =>
              jsonResponse(200, {
                ok: true,
                id: "kirk.sam.alpha@gmail.com",
                profile: { access: "open" },
              }),
          },
        ),
      (err: unknown) => err instanceof SchoolCallError && err.reason === "rejected",
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
      if (path.endsWith("/register")) {
        stored.set(email, password);
        return jsonResponse(200, {
          ok: true,
          id: email,
          profile: { access: "closed", studentName: "", freeWeekStart: "1970-01-01T00:00:00.000Z" },
        });
      }
      const saved = stored.get(email);
      if (saved == null || saved !== password) {
        return jsonResponse(401, { ok: false, error: "Email or password did not match." });
      }
      return jsonResponse(200, {
        ok: true,
        id: email,
        profile: { access: "closed", studentName: "", freeWeekStart: "1970-01-01T00:00:00.000Z" },
      });
    };
    const registered = await registerSchoolAccount(
      { email: "  KirkSamAlpha@DotHeimpossible.ai ", password: typedPassword, name: "Parent" },
      { secret: SECRET, fetch: fetchImpl },
    );
    const signedIn = await signInSchoolAccount(
      { email: "KirkSamAlpha@DotHeimpossible.ai", password: typedPassword },
      { secret: SECRET, fetch: fetchImpl },
    );
    assert.equal(registered.id, DEFAULT_WEBSITE_MASTER_EMAIL);
    assert.equal(signedIn.id, registered.id);
    assert.equal(calls.length, 2);
    assert.equal(calls[0]?.path.endsWith("/api/vkole/register"), true);
    assert.equal(calls[1]?.path.endsWith("/api/vkole/sign-in"), true);
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
          { secret: SECRET, fetch: async () => jsonResponse(404, { ok: false, error: missing }) },
        ),
      (err: unknown) => err instanceof SchoolCallError && err.reason === "unknown" && err.message === missing,
    );
  });
});

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
