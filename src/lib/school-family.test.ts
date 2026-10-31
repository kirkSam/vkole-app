import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { finishSendsReport, parentProgressMail } from "./academic-email.ts";
import { SUBJECTS } from "./climb-rules.ts";
import { levelFieldsForWebsite, readLevelPair } from "./level-pair.ts";
import {
  THIRD_STUDENT_MESSAGE,
  accountIdOf,
  clearsLocalProgress,
  decideStudent,
  isSchoolAccountId,
  parseSchoolProfile,
  schoolAccessDecision,
  schoolWriteBody,
  studentIndexOf,
  studentIndexToAdd,
  studentScopeId,
} from "./school-account.ts";
import { registerSchoolAccount, resendConfirmationEmail, writeSchoolAccount } from "./school-account.server.ts";

const TOKEN = "account-token";
const EXPIRES = "2027-01-01T00:00:00.000Z";
const DEVICE = "11111111-1111-4111-8111-111111111111";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function family(email: string, extra: Record<string, unknown> = {}) {
  return { token: TOKEN, expiresAt: EXPIRES, family: { email, access: "open", ...extra } };
}

describe("two students and the website level shape", () => {
  it("keeps student 1 on the email and student 2 on a scoped id", () => {
    assert.equal(studentScopeId("ada@family.test", 1), "ada@family.test");
    assert.equal(studentScopeId("ada@family.test", 2), "ada@family.test#student-2");
    assert.equal(accountIdOf("ada@family.test#student-2"), "ada@family.test");
    assert.equal(studentIndexOf("ada@family.test#student-2"), 2);
    assert.equal(isSchoolAccountId("ada@family.test#student-2"), true);
  });

  it("lets a second name join and stops a third child", () => {
    assert.equal(decideStudent("Ada", "Bea"), "extra");
    assert.equal(decideStudent("Ada", "Bea", [{ name: "Ada" }]), "add");
    assert.equal(decideStudent("Ada", "Ada", [{ name: "Ada" }, { name: "Bea" }]), "same");
    assert.equal(decideStudent("Ada", "Cam", [{ name: "Ada" }, { name: "Bea" }]), "extra");
    assert.equal(studentIndexToAdd([{ index: 1 }], false), 2);
    assert.equal(studentIndexToAdd([{ index: 1 }, { index: 2 }], false), null);
    assert.equal(THIRD_STUDENT_MESSAGE.includes("2 students"), true);
  });

  it("locks confirm-email apart from the pay wall and keeps old payloads open", () => {
    const confirm = schoolAccessDecision({
      email: "ada@family.test",
      access: "closed",
      freeWeekStart: null,
      lockReason: "confirm-email",
    });
    assert.equal(confirm.confirmEmail, true);
    assert.equal(confirm.showTrialPage, false);
    assert.equal(confirm.expired, false);
    const unconfirmed = schoolAccessDecision({
      email: "ada@family.test",
      access: "open",
      freeWeekStart: null,
      emailConfirmed: false,
    });
    assert.equal(unconfirmed.confirmEmail, false);
    const websiteLock = schoolAccessDecision({
      email: "ada@family.test",
      access: "closed",
      freeWeekStart: "2026-10-24T06:17:15.245Z",
      lockReason: "confirm-email",
      emailConfirmed: false,
      now: Date.parse("2026-10-24T06:17:20.000Z"),
    });
    assert.equal(websiteLock.confirmEmail, true);
    assert.equal(websiteLock.showTrialPage, false);
    const confirmed = schoolAccessDecision({
      email: "ada@family.test",
      access: "open",
      freeWeekStart: "2026-10-24T06:17:22.050Z",
      lockReason: "",
      emailConfirmed: true,
      now: Date.parse("2026-10-24T06:17:30.000Z"),
    });
    assert.equal(confirmed.confirmEmail, false);
    assert.equal(confirmed.showTrialPage, false);
    const payment = schoolAccessDecision({
      email: "ada@family.test",
      access: "closed",
      freeWeekStart: null,
      lockReason: "payment",
    });
    assert.equal(payment.confirmEmail, false);
    assert.equal(payment.showTrialPage, true);
    const older = schoolAccessDecision({
      email: "ada@family.test",
      access: "open",
      freeWeekStart: "2026-10-20T00:00:00.000Z",
      now: Date.parse("2026-10-21T00:00:00.000Z"),
    });
    assert.equal(older.confirmEmail, false);
    assert.equal(older.showTrialPage, false);
    assert.equal(
      clearsLocalProgress({ access: "open", studentName: "", level: {}, lockReason: "confirm-email" }),
      false,
    );
    const climbs = readFileSync(new URL("./climbs.ts", import.meta.url), "utf8");
    assert.equal(climbs.includes("decision.confirmEmail"), true);
    assert.equal(climbs.includes("mirror?.freeWeekStart ?? new Date().toISOString()"), false);
    const auth = readFileSync(new URL("./school-auth.ts", import.meta.url), "utf8");
    const signIn = auth.slice(auth.indexOf("export const schoolSignIn"), auth.indexOf("export const resendSchoolConfirmation"));
    assert.equal(signIn.includes("resend"), false);
  });

  it("reads the published working and earned objects", () => {
    const pair = readLevelPair({
      grade: 3,
      step: 2,
      earnedGrade: 6,
      working: { grade: 3, step: 2, label: "Grade 3" },
      earned: { grade: 6 },
    });
    assert.deepEqual(pair.working, { grade: 3, step: 2, label: "Grade 3" });
    assert.deepEqual(pair.earned, { grade: 6 });
    const fallback = readLevelPair({ working: { grade: 4, step: 1 }, earned: { grade: 5 } });
    assert.equal(fallback.working.grade, 4);
    assert.equal(fallback.working.step, 1);
    assert.equal(fallback.earned?.grade, 5);
    const missing = readLevelPair({ grade: 2, step: 0 });
    assert.equal(missing.earned, null);
    const parsed = parseSchoolProfile({
      family: {
        email: "ada@family.test",
        access: "open",
        progress: { m: { grade: 3, step: 2, earnedGrade: 6, working: { grade: 3, step: 2, label: "Grade 3" }, earned: { grade: 6 } } },
      },
    });
    assert.equal(parsed?.profile.level.m?.grade, 3);
    assert.equal(parsed?.profile.level.m?.step, 2);
    assert.equal(parsed?.profile.level.m?.earnedGrade, 6);
    const spoken = parseSchoolProfile({
      family: {
        email: "ada@family.test",
        access: "open",
        levels: { sp: { grade: 2, step: 0, band: "LK", index: 4, word: "lk-next-e", levelCode: "LK", earned: { grade: 4 } } },
      },
    });
    assert.equal(spoken?.profile.level.sp?.band, "LK");
    assert.equal(spoken?.profile.level.sp?.index, 4);
    assert.equal(spoken?.profile.level.sp?.earnedGrade, 4);
    assert.equal(spoken?.profile.level.sp?.step, 0);
  });

  it("sends earnedGrade with the working grade and step for math, reading, history, and general study", () => {
    const body = schoolWriteBody({ m: { grade: 3, step: 2, earnedGrade: 6 }, ela: { grade: 4, step: 1, earnedGrade: 4 } }, 0, 0, []);
    assert.equal(body.levels.m?.grade, 3);
    assert.equal(body.levels.m?.step, 2);
    assert.equal(body.levels.m?.earnedGrade, 6);
    assert.deepEqual(body.levels.m?.working, { grade: 3, step: 2, label: "Grade 3" });
    assert.deepEqual(body.levels.m?.earned, { grade: 6 });
    assert.equal(body.levels.ela?.earnedGrade, 4);
    assert.deepEqual(levelFieldsForWebsite({ grade: 3, step: 2, earnedGrade: 6 }).earned, { grade: 6 });
    const kept = schoolWriteBody({ ss: { grade: 5, step: 0 }, gen: { grade: 1, step: 2 } }, 0, 0, []);
    assert.equal(kept.levels.ss?.earnedGrade, undefined);
    assert.equal(kept.levels.ss?.earned, undefined);
    assert.equal(kept.levels.gen?.grade, 1);
    assert.equal(kept.levels.gen?.step, 2);
    const second = schoolWriteBody({ m: { grade: 2, step: 0, earnedGrade: 2 } }, 0, 0, [], undefined, undefined, 2);
    assert.equal(second.studentIndex, 2);
    assert.equal("studentIndex" in schoolWriteBody({ m: { grade: 2, step: 0, earnedGrade: 2 } }, 0, 0, []), false);
  });

  it("asks the website to send the welcome email and does not send one itself", async () => {
    const source = readFileSync(new URL("./school-account.server.ts", import.meta.url), "utf8");
    assert.equal(source.includes("sendAcademicMail"), false);
    assert.equal(source.includes("sendAppMail"), false);
    const urls: string[] = [];
    let body: Record<string, unknown> = {};
    await registerSchoolAccount(
      { email: "ada@family.test", password: "long-enough", name: "Parent", deviceId: DEVICE },
      {
        fetch: async (input, init) => {
          urls.push(String(input));
          body = JSON.parse(String(init?.body));
          return jsonResponse(200, family("ada@family.test"));
        },
      },
    );
    assert.deepEqual(urls, ["https://www.dotheimpossible.ai/api/account/register"]);
    assert.equal(body.deviceId, DEVICE);
    assert.equal(body.email, "ada@family.test");
  });

  it("asks the website to send the confirmation email again", async () => {
    let path = "";
    let sent = "";
    await resendConfirmationEmail("ada@family.test", {
      token: TOKEN,
      expiresAt: EXPIRES,
      fetch: async (input, init) => {
        path = String(input);
        sent = String(init?.body);
        const headers = new Headers(init?.headers);
        assert.equal(headers.get("authorization"), `Bearer ${TOKEN}`);
        return jsonResponse(200, { ok: true });
      },
    });
    assert.equal(path, "https://www.dotheimpossible.ai/api/account/confirm-email/resend");
    assert.equal(sent, "{}");
  });

  it("posts student 2 on the family save and omits the index for student 1", async () => {
    let body: Record<string, unknown> = {};
    await writeSchoolAccount(
      "ada@family.test#student-2",
      schoolWriteBody({ m: { grade: 2, step: 1, earnedGrade: 3 } }, 0, 0, [], undefined, undefined, 2),
      {
        token: TOKEN,
        expiresAt: EXPIRES,
        fetch: async (input, init) => {
          assert.equal(String(input), "https://www.dotheimpossible.ai/api/account/family");
          body = JSON.parse(String(init?.body));
          return jsonResponse(200, family("ada@family.test", { levels: body.levels }));
        },
      },
    );
    assert.equal(body.studentIndex, 2);
    assert.equal((body.levels as { m: { earnedGrade: number } }).m.earnedGrade, 3);
  });

  it("sends the session-end report when Finish is pressed on every engine", () => {
    assert.equal(finishSendsReport("finished", 0), true);
    assert.equal(finishSendsReport("logout", 0), false);
    assert.equal(finishSendsReport("inactivity", 0), false);
    assert.equal(finishSendsReport("logout", 1), true);
    assert.deepEqual(
      SUBJECTS.map((subject) => subject.id),
      ["m", "ela", "ss", "gen", "sg", "sw", "sp", "pa"],
    );
    const session = readFileSync(new URL("../routes/session.$id.tsx", import.meta.url), "utf8");
    const climbs = readFileSync(new URL("./climbs.ts", import.meta.url), "utf8");
    const clock = readFileSync(new URL("./day-clock.ts", import.meta.url), "utf8");
    assert.equal(session.includes('finishRef.current("finished")'), true);
    assert.equal(session.includes('finishRef.current("logout", true)'), true);
    assert.equal(session.includes('finish("logout", true)'), false);
    assert.equal(session.includes("Finished"), true);
    assert.equal(session.includes("Lower the working level. The earned level stays."), true);
    assert.equal(session.includes("Earned level"), true);
    assert.equal(climbs.includes("parentProgressMail({"), true);
    assert.equal(climbs.includes("explicitLogout: data.explicitLogout === true"), true);
    assert.equal(clock.includes('z.enum(["m", "ela", "ss", "gen", "sg", "sw", "sp", "pa"])'), true);
  });

  it("keeps the Alphabet parent email off for idle, the 8-hour clock, and leaving", async () => {
    const sent: string[] = [];
    const send = async (label: string) => {
      sent.push(label);
    };
    const endings: { subject: string; reason: "logout" | "inactivity" | "finished"; explicitLogout: boolean; eventCount: number; label: string }[] = [
      { subject: "sp", reason: "inactivity", explicitLogout: false, eventCount: 4, label: "idle" },
      { subject: "sp", reason: "logout", explicitLogout: false, eventCount: 4, label: "eight-hour" },
      { subject: "sp", reason: "logout", explicitLogout: false, eventCount: 4, label: "leaving" },
      { subject: "sp", reason: "finished", explicitLogout: false, eventCount: 0, label: "finished" },
      { subject: "sp", reason: "finished", explicitLogout: false, eventCount: 6, label: "exercise-6" },
      { subject: "sp", reason: "logout", explicitLogout: true, eventCount: 2, label: "log-out" },
      { subject: "sp", reason: "logout", explicitLogout: true, eventCount: 0, label: "empty-log-out" },
      { subject: "m", reason: "inactivity", explicitLogout: false, eventCount: 1, label: "math-idle" },
      { subject: "m", reason: "logout", explicitLogout: false, eventCount: 1, label: "math-leave" },
    ];
    for (const end of endings) {
      if (parentProgressMail(end)) await send(end.label);
    }
    assert.deepEqual(sent, ["finished", "exercise-6", "log-out", "math-idle", "math-leave"]);
    assert.equal(sent.includes("idle"), false);
    assert.equal(sent.includes("eight-hour"), false);
    assert.equal(sent.includes("leaving"), false);
    assert.equal(sent.includes("empty-log-out"), false);
  });
});
