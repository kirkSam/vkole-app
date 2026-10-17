/**
 * Server-only calls to the school website account API.
 * Never import this from a client component. The secret stays here.
 */
import { accountEmailForms, normalizeAccountEmail, sameAccount } from "./account-scope.ts";
import {
  SCHOOL_ACCOUNT_GONE_MESSAGE,
  SCHOOL_OFFLINE_MESSAGE,
  SCHOOL_ORIGIN,
  SCHOOL_WAIT_MESSAGE,
  decideStudent,
  failureKind,
  parseSchoolProfile,
  resetCode,
  websiteErrorText,
  type SchoolFailure,
  type SchoolProfile,
} from "./school-account.ts";

const PATHS = {
  register: "/api/vkole/register",
  signIn: "/api/vkole/sign-in",
  read: "/api/vkole/read",
  write: "/api/vkole/write",
  passwordReset: "/api/vkole/password-reset",
  passwordResetConfirm: "/api/vkole/password-reset/confirm",
} as const;

export class SchoolCallError extends Error {
  readonly reason: SchoolFailure;
  constructor(reason: SchoolFailure, message: string) {
    super(message);
    this.name = "SchoolCallError";
    this.reason = reason;
  }
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

type CallDeps = {
  fetch?: FetchLike;
  secret?: string;
};

function secretFrom(deps?: CallDeps): string {
  const secret = (deps?.secret ?? process.env.VKOLE_SHARED_SECRET ?? "").trim();
  return secret;
}

function offline(): SchoolCallError {
  return new SchoolCallError("offline", SCHOOL_OFFLINE_MESSAGE);
}

async function postSchool(path: string, body: unknown, deps?: CallDeps): Promise<unknown> {
  const secret = secretFrom(deps);
  if (!secret) throw offline();
  const headers = new Headers();
  headers.set("content-type", "application/json");
  headers.set("accept", "application/json");
  headers.set("x-vkole-secret", secret);
  headers.delete("origin");
  headers.delete("Origin");
  const fetchImpl = deps?.fetch ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(`${SCHOOL_ORIGIN}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      redirect: "manual",
      referrerPolicy: "no-referrer",
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw offline();
  }
  if (response.status === 429) throw new SchoolCallError("wait", SCHOOL_WAIT_MESSAGE);
  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      if (response.status >= 500) throw offline();
      throw new SchoolCallError("rejected", "The school website did not accept that request.");
    }
  }
  if (response.status >= 500) throw offline();
  const reason = failureKind(response.status, parsed);
  if (!response.ok || (parsed && typeof parsed === "object" && (parsed as { ok?: boolean }).ok === false)) {
    if (reason === "offline") throw offline();
    if (reason === "wait") throw new SchoolCallError("wait", SCHOOL_WAIT_MESSAGE);
    if (reason === "gone") throw new SchoolCallError("gone", SCHOOL_ACCOUNT_GONE_MESSAGE);
    const signing = path === PATHS.signIn || path === PATHS.register;
    const spoken = websiteErrorText(parsed);
    const message =
      !signing && spoken
        ? spoken
        : reason === "unknown"
          ? "The school website has no password for that email."
          : signing
            ? "Email or password did not match."
            : "The school website did not accept that request.";
    throw new SchoolCallError(reason, message);
  }
  return parsed;
}

function accountId(raw: string): string {
  const email = normalizeAccountEmail(raw);
  if (!email.includes("@")) throw new SchoolCallError("rejected", "Check the email and password and try again.");
  return email;
}

export async function registerSchoolAccount(
  input: { email: string; password: string; name: string },
  deps?: CallDeps,
): Promise<{ id: string; profile: SchoolProfile }> {
  const email = accountId(input.email);
  const name = input.name.trim() || "Parent";
  const body = await postSchool(
    PATHS.register,
    { email, password: input.password, name, parentName: name },
    deps,
  );
  const parsed = parseSchoolProfile(body);
  if (!parsed || !sameAccount(parsed.id, email)) {
    throw new SchoolCallError("rejected", "The school website did not open the account.");
  }
  if (parsed.profile.access !== "open" && parsed.profile.access !== "closed") {
    throw new SchoolCallError("rejected", "The school website did not open the account.");
  }
  return { id: email, profile: parsed.profile };
}

export async function signInSchoolAccount(
  input: { email: string; password: string },
  deps?: CallDeps,
): Promise<{ id: string; profile: SchoolProfile }> {
  const forms = accountEmailForms(input.email);
  const id = forms[0];
  if (!id) throw new SchoolCallError("rejected", "Check the email and password and try again.");
  let last: unknown = new SchoolCallError("rejected", "Email or password did not match.");
  for (const email of forms) {
    try {
      const body = await postSchool(PATHS.signIn, { email, password: input.password }, deps);
      const parsed = parseSchoolProfile(body);
      if (parsed && !sameAccount(parsed.id, id)) {
        throw new SchoolCallError("rejected", "Email or password did not match.");
      }
      const account = parsed ?? parseSchoolProfile({ ...(asRecord(body) ?? {}), id, email: id, ok: true });
      if (!account || !sameAccount(account.id, id)) {
        throw new SchoolCallError("rejected", "Email or password did not match.");
      }
      return { id, profile: account.profile };
    } catch (err) {
      last = err;
      if (!(err instanceof SchoolCallError) || err.reason !== "unknown") throw err;
    }
  }
  throw last;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/**
 * The student gate. Calls POST /api/vkole/read.
 * A failed read throws the website's own sentence and never comes back as `extra`.
 * An empty or missing student name is `new`. `extra` is only a different saved first name.
 */
export async function studentCheck(
  userId: string,
  typedFirstName: string,
  read: (id: string) => Promise<SchoolProfile> = readSchoolAccount,
): Promise<"new" | "extra" | "same"> {
  let profile: SchoolProfile;
  try {
    profile = await read(userId);
  } catch (err) {
    const message = err instanceof Error ? err.message.trim() : "";
    throw new Error(message || "The school website did not accept that request.");
  }
  return decideStudent(profile.studentName, typedFirstName);
}

export async function readSchoolAccount(id: string, deps?: CallDeps): Promise<SchoolProfile> {
  const email = accountId(id);
  const body = await postSchool(PATHS.read, { id: email, email }, deps);
  const payload = body && typeof body === "object" ? { ...(body as object), id: email, ok: true } : { id: email, ok: true };
  const parsed = parseSchoolProfile(payload);
  if (!parsed) throw offline();
  return parsed.profile;
}

export async function writeSchoolAccount(
  body: { id: string; level: unknown; clockSeconds: number; seen: unknown; student?: { name: string } },
  deps?: CallDeps,
): Promise<void> {
  await postSchool(PATHS.write, { ...body, email: body.id }, deps);
}

export async function requestSchoolReset(
  email: string,
  deps?: CallDeps,
): Promise<{ code: string; expiresAt: string }> {
  const id = accountId(email);
  const body = await postSchool(PATHS.passwordReset, { id, email: id }, deps);
  const code = resetCode(body);
  if (!code) throw new SchoolCallError("unknown", "The school website has no password reset for that email.");
  return code;
}

/** Save a new password with the code from the website reset email. */
export async function confirmSchoolReset(
  input: { email: string; code: string; newPassword: string },
  deps?: CallDeps,
): Promise<void> {
  const email = accountId(input.email);
  await postSchool(
    PATHS.passwordResetConfirm,
    { email, code: input.code.trim(), newPassword: input.newPassword },
    deps,
  );
}

export function schoolHeaders(secret: string): Headers {
  const headers = new Headers();
  headers.set("content-type", "application/json");
  headers.set("accept", "application/json");
  headers.set("x-vkole-secret", secret);
  headers.delete("origin");
  return headers;
}
