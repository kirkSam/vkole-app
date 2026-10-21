/**
 * Server-only calls to the school website account API.
 * Never import this from a client component.
 *
 * The website account routes take no shared secret and no cookies.
 * A browser request that sends X-Vkole-Secret is refused, so this client
 * does not send that header. The bearer token from sign-in or register
 * authorizes GET, POST, and PATCH /api/account/family.
 */
import { accountEmailForms, normalizeAccountEmail, sameAccount } from "./account-scope.ts";
import {
  SCHOOL_ACCOUNT_GONE_MESSAGE,
  SCHOOL_OFFLINE_MESSAGE,
  SCHOOL_ORIGIN,
  SCHOOL_WAIT_MESSAGE,
  accountIdOf,
  accountTokenExpired,
  decideStudent,
  failureKind,
  isWebsiteMasterEmail,
  parseAccountSession,
  parseSchoolProfile,
  rotatedGrant,
  schoolFailureMessage,
  schoolPassword,
  studentIndexOf,
  websiteErrorText,
  type AccountSession,
  type FamilyWrite,
  type SchoolFailure,
  type SchoolProfile,
} from "./school-account.ts";

const PATHS = {
  register: "/api/account/register",
  signIn: "/api/account/sign-in",
  family: "/api/account/family",
  resendConfirmation: "/api/account/confirm-email/resend",
  sendCode: "/api/account/forgot-password/send-code",
  confirm: "/api/account/forgot-password/confirm",
} as const;

const RETIRED_RESET = "/api/vkole/password-reset";

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
  token?: string;
  expiresAt?: string;
  now?: number;
  studentIndex?: number;
  /** An open engine may still present an expired token. A 401 must not end that sitting. */
  engineActive?: boolean;
  /** A family response that carries a new token. The caller stores it with no sign-in screen. */
  onGrant?: (grant: { token: string; expiresAt: string }) => void;
};

function offline(): SchoolCallError {
  return new SchoolCallError("offline", SCHOOL_OFFLINE_MESSAGE);
}

function signInAgain(spoken = ""): SchoolCallError {
  return new SchoolCallError("unauthorized", spoken.trim() || "Sign in again.");
}

async function callSchool(
  method: "GET" | "POST" | "PATCH",
  path: string,
  body: unknown | undefined,
  deps?: CallDeps,
): Promise<unknown> {
  if (path === RETIRED_RESET || path.startsWith(`${RETIRED_RESET}/`)) {
    throw new SchoolCallError("rejected", "The school website did not accept that request.");
  }
  const headers = new Headers();
  headers.set("accept", "application/json");
  if (body !== undefined) headers.set("content-type", "application/json");
  if (deps?.token) headers.set("authorization", `Bearer ${deps.token}`);
  headers.delete("origin");
  headers.delete("Origin");
  headers.delete("cookie");
  headers.delete("Cookie");
  headers.delete("x-vkole-secret");
  headers.delete("X-Vkole-Secret");
  const fetchImpl = deps?.fetch ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(`${SCHOOL_ORIGIN}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
      referrerPolicy: "no-referrer",
      credentials: "omit",
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
  if (response.status === 401 && deps?.token) {
    throw signInAgain(websiteErrorText(parsed));
  }
  const reason = failureKind(response.status, parsed);
  if (!response.ok) {
    if (reason === "offline") throw offline();
    if (reason === "wait") throw new SchoolCallError("wait", SCHOOL_WAIT_MESSAGE);
    if (reason === "gone") throw new SchoolCallError("gone", SCHOOL_ACCOUNT_GONE_MESSAGE);
    if (reason === "unauthorized") throw signInAgain(websiteErrorText(parsed));
    const signing = path === PATHS.signIn || path === PATHS.register;
    const spoken = redactPassword(websiteErrorText(parsed), passwordOf(body));
    throw new SchoolCallError(reason, schoolFailureMessage(signing, reason, spoken));
  }
  return parsed;
}

function passwordOf(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const row = body as { password?: unknown; newPassword?: unknown };
  if (typeof row.password === "string") return row.password;
  if (typeof row.newPassword === "string") return row.newPassword;
  return "";
}

/** A website sentence must not echo the password back onto the screen. */
function redactPassword(spoken: string, password: string): string {
  if (!spoken || password.length < 8 || !spoken.includes(password)) return spoken;
  return spoken.split(password).join("").trim();
}

function masterProfile(email: string, profile: SchoolProfile): SchoolProfile {
  if (!isWebsiteMasterEmail(email, process.env.VKOLE_MASTER_EMAIL)) return profile;
  return { ...profile, access: "open" };
}

function accountId(raw: string): string {
  const email = normalizeAccountEmail(accountIdOf(raw));
  if (!email.includes("@")) throw new SchoolCallError("rejected", "Check the email and password and try again.");
  return email;
}

function familyPath(index: number): string {
  return index > 1 ? `${PATHS.family}?studentIndex=${index}` : PATHS.family;
}

function withStudentIndex<T extends object>(body: T, index: number): T & { studentIndex?: number } {
  if (!Number.isInteger(index) || index <= 1) return body;
  return { ...body, studentIndex: index };
}

async function storedGrant(email: string): Promise<{ token: string; expiresAt: string } | null> {
  const { getSql } = await import("./db");
  const { readAccountGrant } = await import("./school-mirror.server");
  return readAccountGrant(await getSql(), email);
}

async function clearStoredGrant(email: string): Promise<void> {
  try {
    const { getSql } = await import("./db");
    const { clearAccountGrant } = await import("./school-mirror.server");
    await clearAccountGrant(await getSql(), email);
  } catch {
    /* A caller that passed the token clears the row itself. */
  }
}

function noteRotatedGrant(body: unknown, deps?: CallDeps): void {
  const grant = rotatedGrant(body);
  if (grant) deps?.onGrant?.(grant);
}

async function tokenFor(email: string, deps?: CallDeps): Promise<string> {
  if (deps?.expiresAt && accountTokenExpired(deps.expiresAt, deps.now)) {
    if (deps.engineActive && deps.token) return deps.token;
    if (!deps.token) await clearStoredGrant(email);
    throw signInAgain();
  }
  if (deps?.token) return deps.token;
  const grant = await storedGrant(email);
  if (!grant || accountTokenExpired(grant.expiresAt, deps?.now)) {
    if (deps?.engineActive && grant?.token) return grant.token;
    await clearStoredGrant(email);
    throw signInAgain();
  }
  return grant.token;
}

export async function registerSchoolAccount(
  input: { email: string; password: string; name: string; studentName?: string; deviceId?: string },
  deps?: CallDeps,
): Promise<AccountSession> {
  const email = accountId(input.email);
  const password = schoolPassword(input.password);
  const studentName = input.studentName?.trim() ?? "";
  const deviceId = input.deviceId?.trim() ?? "";
  const payload: { email: string; password: string; studentName?: string; deviceId?: string } = { email, password };
  if (studentName) payload.studentName = studentName;
  if (deviceId) payload.deviceId = deviceId;
  const body = await callSchool("POST", PATHS.register, payload, deps);
  const session = parseAccountSession(body, email);
  if (!session || !sameAccount(session.id, email)) {
    throw new SchoolCallError("rejected", "The school website did not open the account.");
  }
  return { ...session, id: email, profile: masterProfile(email, session.profile) };
}

export async function signInSchoolAccount(
  input: { email: string; password: string; deviceId?: string },
  deps?: CallDeps,
): Promise<AccountSession> {
  const forms = accountEmailForms(input.email);
  const id = forms[0];
  if (!id) throw new SchoolCallError("rejected", "Check the email and password and try again.");
  const password = schoolPassword(input.password);
  const deviceId = input.deviceId?.trim() ?? "";
  let last: unknown = new SchoolCallError("rejected", "Email or password did not match.");
  for (const email of forms) {
    try {
      const body = await callSchool(
        "POST",
        PATHS.signIn,
        deviceId ? { email, password, deviceId } : { email, password },
        deps,
      );
      const session = parseAccountSession(body, id);
      if (!session || !sameAccount(session.id, id)) {
        throw new SchoolCallError("rejected", "Email or password did not match.");
      }
      return { ...session, id, profile: masterProfile(id, session.profile) };
    } catch (err) {
      last = err;
      if (!(err instanceof SchoolCallError) || err.reason !== "unknown") throw err;
    }
  }
  throw last;
}

/**
 * The student gate. Calls GET /api/account/family.
 * A failed read throws the website's own sentence and never comes back as `extra`.
 * An empty roster is `new`. A name already on the roster is `same`.
 * A new name under the cap of 2 is `add`. A new name at the cap is `extra`.
 */
export async function studentCheck(
  userId: string,
  typedFirstName: string,
  read: (id: string) => Promise<SchoolProfile> = readSchoolAccount,
): Promise<"new" | "extra" | "same" | "add"> {
  let profile: SchoolProfile;
  try {
    profile = await read(userId);
  } catch (err) {
    const message = err instanceof Error ? err.message.trim() : "";
    throw new Error(message || "The school website did not accept that request.");
  }
  const roster = profile.students?.length ? profile.students : profile.studentName ? [{ name: profile.studentName }] : [];
  const cap = isWebsiteMasterEmail(userId, process.env.VKOLE_MASTER_EMAIL) ? Number.POSITIVE_INFINITY : 2;
  return decideStudent(profile.studentName, typedFirstName, roster, cap);
}

export async function readSchoolAccount(id: string, deps?: CallDeps): Promise<SchoolProfile> {
  const email = accountId(id);
  const token = await tokenFor(email, deps);
  const index = deps?.studentIndex ?? studentIndexOf(id);
  let body: unknown;
  try {
    body = await callSchool("GET", familyPath(index), undefined, { ...deps, token });
  } catch (err) {
    if (err instanceof SchoolCallError && err.reason === "unauthorized" && !deps?.token && !deps?.engineActive) {
      await clearStoredGrant(email);
    }
    throw err;
  }
  noteRotatedGrant(body, deps);
  const parsed = parseSchoolProfile(body, email);
  if (!parsed) throw new SchoolCallError("rejected", "The school website did not open the account.");
  return masterProfile(email, parsed.profile);
}

/**
 * Save the child on the website before a level is opened.
 * The website keeps `{ student: { name, startingGrade } }`.
 * `{ studentName }` alone comes back unchanged. `{ student: { name } }`
 * without a grade is refused with "Enter a starting grade from 1 to 12."
 */
export async function saveSchoolStudent(
  id: string,
  input: { name: string; startingGrade: number; age?: number; studentIndex?: number },
  deps?: CallDeps,
): Promise<SchoolProfile> {
  const email = accountId(id);
  const name = input.name.trim().replace(/\s+/g, " ");
  const startingGrade = Math.round(input.startingGrade);
  if (!name) throw new SchoolCallError("rejected", "Enter the student’s first name.");
  if (!Number.isInteger(startingGrade) || startingGrade < 1 || startingGrade > 12) {
    throw new SchoolCallError("rejected", "Enter a starting grade from 1 to 12.");
  }
  const student: { name: string; startingGrade: number; age?: number } = { name, startingGrade };
  if (input.age != null && Number.isInteger(input.age)) student.age = input.age;
  const token = await tokenFor(email, deps);
  const index = input.studentIndex ?? studentIndexOf(id);
  let response: unknown;
  try {
    response = await callSchool("PATCH", PATHS.family, withStudentIndex({ student }, index), { ...deps, token });
  } catch (err) {
    if (err instanceof SchoolCallError && err.reason === "unauthorized" && !deps?.token && !deps?.engineActive) {
      await clearStoredGrant(email);
    }
    throw err;
  }
  noteRotatedGrant(response, deps);
  const parsed = parseSchoolProfile(response, email);
  const saved = parsed ? masterProfile(email, parsed.profile) : null;
  if (!saved?.studentName) {
    const spoken = websiteErrorText(response);
    throw new SchoolCallError("rejected", spoken || "The school website did not save the student.");
  }
  return saved;
}

export async function writeSchoolAccount(id: string, body: FamilyWrite, deps?: CallDeps): Promise<SchoolProfile | null> {
  const email = accountId(id);
  const token = await tokenFor(email, deps);
  const index = body.studentIndex ?? deps?.studentIndex ?? studentIndexOf(id);
  let response: unknown;
  try {
    response = await callSchool("POST", PATHS.family, withStudentIndex(body, index), { ...deps, token });
  } catch (err) {
    if (err instanceof SchoolCallError && err.reason === "unauthorized" && !deps?.token && !deps?.engineActive) {
      await clearStoredGrant(email);
    }
    throw err;
  }
  noteRotatedGrant(response, deps);
  const parsed = parseSchoolProfile(response, email);
  return parsed ? masterProfile(email, parsed.profile) : null;
}

/** Ask the website to send the confirmation email again. The website sends that mail. */
export async function resendConfirmationEmail(id: string, deps?: CallDeps): Promise<void> {
  const email = accountId(id);
  const token = await tokenFor(email, deps);
  try {
    await callSchool("POST", PATHS.resendConfirmation, {}, { ...deps, token });
  } catch (err) {
    if (err instanceof SchoolCallError && err.reason === "unauthorized" && !deps?.token && !deps?.engineActive) {
      await clearStoredGrant(email);
    }
    throw err;
  }
}

/** Ask the website to email a reset code. The app does not send that code. */
export async function requestSchoolReset(email: string, deps?: CallDeps): Promise<{ message: string }> {
  const id = accountId(email);
  const body = await callSchool("POST", PATHS.sendCode, { email: id }, deps);
  const message = websiteErrorText(body) || "Code sent";
  return { message };
}

/** Save a new password with the code from the website reset email. */
export async function confirmSchoolReset(
  input: { email: string; code: string; newPassword: string },
  deps?: CallDeps,
): Promise<{ message: string }> {
  const email = accountId(input.email);
  const body = await callSchool(
    "POST",
    PATHS.confirm,
    { email, code: input.code.trim(), newPassword: schoolPassword(input.newPassword) },
    deps,
  );
  return { message: websiteErrorText(body) || "Password updated" };
}
