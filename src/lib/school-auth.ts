import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { APP_NAME } from "@/lib/brand";
import {
  SCHOOL_ACCOUNT_GONE_MESSAGE,
  SCHOOL_LEGACY_MESSAGE,
  SCHOOL_OFFLINE_MESSAGE,
  SCHOOL_WAIT_MESSAGE,
  isFreshSchoolProfile,
  type SchoolFailure,
} from "@/lib/school-account";

const credentials = z.object({
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(80),
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
  | { ok: true }
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
      const account = await registerSchoolAccount(data);
      if (isFreshSchoolProfile(account.profile)) {
        const { forgetLocalAccount } = await import("./account-purge.server");
        const { getSql } = await import("./db");
        await forgetLocalAccount(await getSql(), account.id);
      }
      await openSchoolSession(account.id, data.name);
      return { ok: true };
    } catch (err) {
      if (err instanceof SchoolCallError) {
        if (err.reason === "exists") {
          return failed("exists", "That email is already registered. Sign in with the school password.");
        }
        return failed(err.reason, err.message);
      }
      return failed("offline", SCHOOL_OFFLINE_MESSAGE);
    }
  });

export const schoolSignIn = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(credentials, data))
  .handler(async ({ data }): Promise<SchoolAuthResult> => {
    const { signInSchoolAccount, SchoolCallError } = await import("./school-account.server");
    const { localEmailExists, openSchoolSession } = await import("./school-session.server");
    try {
      const account = await signInSchoolAccount({ email: data.email, password: data.password });
      if (isFreshSchoolProfile(account.profile)) {
        const { forgetLocalAccount } = await import("./account-purge.server");
        const { getSql } = await import("./db");
        await forgetLocalAccount(await getSql(), account.id);
      }
      await openSchoolSession(account.id, account.profile.studentName || "Parent");
      return { ok: true };
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
        if (err.reason === "unknown" && (await localEmailExists(data.email))) {
          return failed("legacy", SCHOOL_LEGACY_MESSAGE);
        }
        if (err.reason === "wait") return failed("wait", SCHOOL_WAIT_MESSAGE);
        if (err.reason === "offline") return failed("offline", SCHOOL_OFFLINE_MESSAGE);
        return failed(err.reason, err.message);
      }
      return failed("offline", SCHOOL_OFFLINE_MESSAGE);
    }
  });

export const schoolPasswordReset = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(emailOnly, data))
  .handler(async ({ data }): Promise<SchoolAuthResult> => {
    const { requestSchoolReset, SchoolCallError } = await import("./school-account.server");
    const email = data.email.trim().toLowerCase();
    try {
      const reset = await requestSchoolReset(email);
      const { sendAppMail } = await import("./app-mail");
      const when = new Date(reset.expiresAt).toLocaleString("en-US", {
        timeZone: "America/Los_Angeles",
        dateStyle: "medium",
        timeStyle: "short",
      });
      const sent = await sendAppMail(
        email,
        `${APP_NAME} password code`,
        `Your password code for ${APP_NAME} is ${reset.code}. It expires at ${when} Pacific time (30 minutes). Enter that code and a new password in the app. If you did not ask for this, ignore this email.`,
      );
      if (sent !== "sent") {
        return failed("mail", "The code could not be emailed. Try again in a moment.");
      }
      return { ok: true };
    } catch (err) {
      if (err instanceof SchoolCallError) return failed(err.reason, err.message);
      return failed("mail", "The code could not be emailed. Try again in a moment.");
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
      return { ok: true };
    } catch (err) {
      if (err instanceof SchoolCallError) return failed(err.reason, err.message);
      return failed("offline", SCHOOL_OFFLINE_MESSAGE);
    }
  });
