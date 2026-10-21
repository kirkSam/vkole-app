import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { schoolMiddleware } from "@/lib/school-middleware";
import {
  SCHOOL_ACCOUNT_GONE_MESSAGE,
  SCHOOL_OFFLINE_MESSAGE,
  SCHOOL_WAIT_MESSAGE,
  THIRD_STUDENT_MESSAGE,
  accountIdOf,
  clearsLocalProgress,
  isWebsiteMasterEmail,
  type SchoolFailure,
} from "@/lib/school-account";

const credentials = z.object({
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(80),
  deviceId: z.string().uuid().optional(),
});

const signUp = credentials.extend({
  name: z.string().trim().min(1).max(80),
});

const emailOnly = z.object({
  email: z.string().trim().email().max(160),
});

const resetConfirm = z.object({
  email: z.string().trim().email().max(160),
  code: z.string().trim().min(1).max(32),
  newPassword: z.string().min(8).max(80),
});

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error("Check the email and password and try again.");
  return parsed.data;
}

export type SchoolAuthResult =
  | { ok: true; sessionToken: string }
  | { ok: false; reason: SchoolFailure | "legacy" | "mail"; message: string };

function failed(reason: Extract<SchoolAuthResult, { ok: false }>["reason"], message: string): SchoolAuthResult {
  return { ok: false, reason, message };
}

export const schoolSignUp = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(signUp, data))
  .handler(async ({ data }): Promise<SchoolAuthResult> => {
    const { registerSchoolAccount, SchoolCallError } = await import("./school-account.server");
    const { openSchoolSession } = await import("./school-session.server");
    try {
      const account = await registerSchoolAccount({
        email: data.email,
        password: data.password,
        name: data.name,
        deviceId: data.deviceId,
      });
      const { getSql } = await import("./db");
      const sql = await getSql();
      const { readSchoolMirror } = await import("./school-mirror.server");
      if (clearsLocalProgress(account.profile, await readSchoolMirror(sql, account.id))) {
        const { forgetLocalAccount } = await import("./account-purge.server");
        await forgetLocalAccount(sql, account.id);
      }
      const { rememberAccountSession } = await import("./school-sync.server");
      const profile = await rememberAccountSession(account);
      const sessionToken = await openSchoolSession(account.id, profile.studentName || data.name);
      return { ok: true, sessionToken };
    } catch (err) {
      if (err instanceof SchoolCallError) return failed(err.reason, err.message);
      return failed("offline", SCHOOL_OFFLINE_MESSAGE);
    }
  });

export const schoolSignIn = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(credentials, data))
  .handler(async ({ data }): Promise<SchoolAuthResult> => {
    const { signInSchoolAccount, SchoolCallError } = await import("./school-account.server");
    const { openSchoolSession } = await import("./school-session.server");
    const { websiteSignInRefusal } = await import("./school-account");
    try {
      const account = await signInSchoolAccount({
        email: data.email,
        password: data.password,
        deviceId: data.deviceId,
      });
      const { getSql } = await import("./db");
      const sql = await getSql();
      const { readSchoolMirror } = await import("./school-mirror.server");
      if (clearsLocalProgress(account.profile, await readSchoolMirror(sql, account.id))) {
        const { forgetLocalAccount } = await import("./account-purge.server");
        await forgetLocalAccount(sql, account.id);
      }
      const { rememberAccountSession } = await import("./school-sync.server");
      const profile = await rememberAccountSession(account);
      const sessionToken = await openSchoolSession(account.id, profile.studentName || "Parent");
      return { ok: true, sessionToken };
    } catch (err) {
      if (err instanceof SchoolCallError) {
        if (err.reason === "gone") {
          try {
            const { forgetLocalAccount } = await import("./account-purge.server");
            const { getSql } = await import("./db");
            await forgetLocalAccount(await getSql(), data.email);
          } catch {
            return failed("offline", SCHOOL_OFFLINE_MESSAGE);
          }
          return failed("gone", SCHOOL_ACCOUNT_GONE_MESSAGE);
        }
        const reason = websiteSignInRefusal(err.reason, false);
        if (reason === "unknown") return failed("unknown", err.message);
        if (err.reason === "wait") return failed("wait", SCHOOL_WAIT_MESSAGE);
        if (err.reason === "offline") return failed("offline", SCHOOL_OFFLINE_MESSAGE);
        return failed(err.reason, err.message);
      }
      return failed("offline", SCHOOL_OFFLINE_MESSAGE);
    }
  });

export const resendSchoolConfirmation = createServerFn({ method: "POST" })
  .middleware([schoolMiddleware])
  .handler(async ({ context }) => {
    const { resendConfirmationEmail, SchoolCallError } = await import("./school-account.server");
    try {
      await resendConfirmationEmail(accountIdOf(context.userId));
      return { ok: true as const, message: "Look in your email for a new message." };
    } catch (err) {
      const message = err instanceof SchoolCallError ? err.message : "The email could not be sent. Try again.";
      return { ok: false as const, message };
    }
  });

export const switchSchoolStudent = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const parsed = z.object({ index: z.number().int().min(1).max(99) }).safeParse(data);
    if (!parsed.success) throw new Error("Pick a student.");
    return parsed.data;
  })
  .middleware([schoolMiddleware])
  .handler(async ({ context, data }) => {
    const { getSql } = await import("./db");
    const { readSchoolMirror, saveActiveStudentIndex } = await import("./school-mirror.server");
    const sql = await getSql();
    const account = accountIdOf(context.userId);
    if (data.index > 2 && !isWebsiteMasterEmail(account, process.env.VKOLE_MASTER_EMAIL)) {
      throw new Error(THIRD_STUDENT_MESSAGE);
    }
    const mirror = await readSchoolMirror(sql, context.userId);
    const known = mirror?.students?.some((student) => student.index === data.index);
    if (mirror?.students?.length && !known) throw new Error("That student is not on this account.");
    await saveActiveStudentIndex(sql, account, data.index);
    return { ok: true as const, index: data.index };
  });

export const schoolPasswordReset = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(emailOnly, data))
  .handler(async ({ data }): Promise<SchoolAuthResult> => {
    const { requestSchoolReset, SchoolCallError } = await import("./school-account.server");
    const email = data.email.trim().toLowerCase();
    try {
      await requestSchoolReset(email);
      return { ok: true, sessionToken: "" };
    } catch (err) {
      if (err instanceof SchoolCallError) return failed(err.reason, err.message);
      return failed("offline", SCHOOL_OFFLINE_MESSAGE);
    }
  });

export const schoolPasswordConfirm = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(resetConfirm, data))
  .handler(async ({ data }): Promise<SchoolAuthResult> => {
    const { confirmSchoolReset, SchoolCallError } = await import("./school-account.server");
    try {
      await confirmSchoolReset({
        email: data.email,
        code: data.code,
        newPassword: data.newPassword,
      });
      return { ok: true, sessionToken: "" };
    } catch (err) {
      if (err instanceof SchoolCallError) return failed(err.reason, err.message);
      return failed("offline", SCHOOL_OFFLINE_MESSAGE);
    }
  });
