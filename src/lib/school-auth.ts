import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { schoolMiddleware } from "@/lib/school-middleware";
import {
  SCHOOL_ACCOUNT_GONE_MESSAGE,
  SCHOOL_OFFLINE_MESSAGE,
  SCHOOL_WAIT_MESSAGE,
  THIRD_STUDENT_MESSAGE,
  accountIdOf,
  clearsLocalProgress,
  isWebsiteMasterEmail,
  studentScopeId,
  type SchoolFailure,
} from "@/lib/school-account";
import { acceptStudentSwitch, mergeFamilyStudents } from "@/lib/student-card";

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
  // CLAUDE: `pendingConfirmation` is new -- true when a LOCAL account was
  // just created (or signed into) but hasn't clicked its confirmation email
  // yet, so there's no usable session (`sessionToken` is empty). The UI
  // should show the existing "check your email" screen, not enter the app.
  | { ok: true; sessionToken: string; pendingConfirmation?: boolean }
  | { ok: false; reason: SchoolFailure | "legacy" | "mail"; message: string };

function failed(reason: Extract<SchoolAuthResult, { ok: false }>["reason"], message: string): SchoolAuthResult {
  return { ok: false, reason, message };
}

// CLAUDE: rewritten at Sam's and the App Builder's explicit direction. A new
// parent now registers a LOCAL account (this app's own Better Auth
// email/password, not the school website) -- "A new local account opens the
// engines and never calls the website." The website path this used to call
// (`registerSchoolAccount`) is untouched elsewhere in this file/repo; it's
// simply no longer what sign-UP does. `requireEmailVerification: true`
// (auth/server.ts) means no usable session exists until the parent confirms
// by email, so this always returns `pendingConfirmation: true` on success.
export const schoolSignUp = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(signUp, data))
  .handler(async ({ data }): Promise<SchoolAuthResult> => {
    const { auth } = await import("./auth/server");
    const { APIError } = await import("better-auth");
    try {
      await auth.api.signUpEmail({
        body: {
          name: data.name,
          email: data.email,
          password: data.password,
          callbackURL: "/confirmed",
        },
      });
      return { ok: true, sessionToken: "", pendingConfirmation: true };
    } catch (err) {
      if (err instanceof APIError) {
        const code = (err.body as { code?: string } | undefined)?.code ?? "";
        if (code === "USER_ALREADY_EXISTS" || /already exists/i.test(err.message)) {
          return failed("exists", "This email already has an account. Sign in instead.");
        }
        return failed("unknown", err.message || "Check the email and password and try again.");
      }
      return failed("offline", SCHOOL_OFFLINE_MESSAGE);
    }
  });

// CLAUDE: added at Sam's and the App Builder's explicit direction -- "look
// locally first only when that email already has a local password... If the
// email is not a local account, sign in through the website exactly as
// today." A wrong LOCAL password fails as a wrong password; it never also
// tries the website (and a missing local account never silently creates
// one). This is the one new branch; everything below it (the website path)
// is the ORIGINAL, unmodified logic for an email with no local account.
export const schoolSignIn = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(credentials, data))
  .handler(async ({ data }): Promise<SchoolAuthResult> => {
    const { localCredentialAccountExists } = await import("./school-session.server");
    if (await localCredentialAccountExists(data.email)) {
      const { auth } = await import("./auth/server");
      const { APIError } = await import("better-auth");
      try {
        const result = await auth.api.signInEmail({
          body: { email: data.email, password: data.password },
        });
        if (!result.token) return { ok: true, sessionToken: "", pendingConfirmation: true };
        return { ok: true, sessionToken: result.token };
      } catch (err) {
        if (err instanceof APIError) {
          const code = (err.body as { code?: string } | undefined)?.code ?? "";
          if (code === "EMAIL_NOT_VERIFIED" || /not verified/i.test(err.message)) {
            return { ok: true, sessionToken: "", pendingConfirmation: true };
          }
          return failed("password", "Check the email and password and try again.");
        }
        return failed("offline", SCHOOL_OFFLINE_MESSAGE);
      }
    }
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
  // The family session stays. Do not pull or push the open child's book first:
  // that reload can replace the roster with one child and refuse the tap.
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { getSql } = await import("./db");
    const { readSchoolMirror, rememberFamilyRoster, saveActiveStudentIndex } = await import("./school-mirror.server");
    const sql = await getSql();
    const account = accountIdOf(context.userId);
    const master = isWebsiteMasterEmail(account, process.env.VKOLE_MASTER_EMAIL);
    const accountMirror = await readSchoolMirror(sql, account);
    const scopeMirror = context.userId === account ? null : await readSchoolMirror(sql, context.userId);
    const second = await readSchoolMirror(sql, studentScopeId(account, 2));
    const roster = mergeFamilyStudents(accountMirror?.students, scopeMirror?.students, second?.students);
    const gate = acceptStudentSwitch(roster, data.index, master);
    if (gate === "cap") throw new Error(THIRD_STUDENT_MESSAGE);
    if (gate === "missing") throw new Error("That student is not on this account.");
    await rememberFamilyRoster(sql, account, roster);
    await saveActiveStudentIndex(sql, account, data.index);
    const student = roster.find((item) => item.index === data.index);
    return { ok: true as const, index: data.index, name: student?.name ?? "" };
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
