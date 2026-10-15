/**
 * Server-only calls to the school website account API.
 * Never import this from a client component. The secret stays here.
 */
import {
  SCHOOL_OFFLINE_MESSAGE,
  SCHOOL_ORIGIN,
  SCHOOL_WAIT_MESSAGE,
  failureKind,
  parseSchoolProfile,
  resetCode,
  type SchoolFailure,
  type SchoolProfile,
} from "./school-account.ts";

const PATHS = {
  register: "/api/vkole/register",
  signIn: "/api/vkole/sign-in",
  read: "/api/vkole/read",
  write: "/api/vkole/write",
  passwordReset: "/api/vkole/password-reset",
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
    const signing = path === PATHS.signIn || path === PATHS.register;
    const message =
      reason === "unknown"
        ? "The school website has no password for that email."
        : signing
          ? "Email or password did not match."
          : "The school website did not accept that request.";
    throw new SchoolCallError(reason, message);
  }
  return parsed;
}

export async function registerSchoolAccount(
  input: { email: string; password: string; name: string },
  deps?: CallDeps,
): Promise<{ id: string; profile: SchoolProfile }> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim() || "Parent";
  const body = await postSchool(
    PATHS.register,
    { email, password: input.password, name, parentName: name },
    deps,
  );
  const parsed = parseSchoolProfile(body);
  if (!parsed) throw new SchoolCallError("rejected", "The school website did not open the account.");
  if (parsed.profile.access !== "open" && parsed.profile.access !== "closed") {
    throw new SchoolCallError("rejected", "The school website did not open the account.");
  }
  return parsed;
}

export async function signInSchoolAccount(
  input: { email: string; password: string },
  deps?: CallDeps,
): Promise<{ id: string; profile: SchoolProfile }> {
  const email = input.email.trim().toLowerCase();
  const body = await postSchool(PATHS.signIn, { email, password: input.password }, deps);
  const parsed = parseSchoolProfile(body);
  if (!parsed) throw new SchoolCallError("rejected", "Email or password did not match.");
  return parsed;
}

export async function readSchoolAccount(id: string, deps?: CallDeps): Promise<SchoolProfile> {
  const email = id.trim().toLowerCase();
  const body = await postSchool(PATHS.read, { id: email, email }, deps);
  const payload = body && typeof body === "object" ? { ...(body as object), id: email, ok: true } : { id: email, ok: true };
  const parsed = parseSchoolProfile(payload);
  if (!parsed) throw offline();
  return parsed.profile;
}

export async function writeSchoolAccount(
  body: { id: string; level: unknown; clockSeconds: number; seen: unknown },
  deps?: CallDeps,
): Promise<void> {
  await postSchool(PATHS.write, { ...body, email: body.id }, deps);
}

export async function requestSchoolReset(
  email: string,
  deps?: CallDeps,
): Promise<{ code: string; expiresAt: string }> {
  const id = email.trim().toLowerCase();
  const body = await postSchool(PATHS.passwordReset, { id, email: id }, deps);
  const code = resetCode(body);
  if (!code) throw new SchoolCallError("unknown", "The school website has no password reset for that email.");
  return code;
}

export function schoolHeaders(secret: string): Headers {
  const headers = new Headers();
  headers.set("content-type", "application/json");
  headers.set("accept", "application/json");
  headers.set("x-vkole-secret", secret);
  headers.delete("origin");
  return headers;
}
