/**
 * Asks the school website to mail the session-end parent report.
 * The website sends that mail. This module only posts the report.
 * Tests pass their own fetch. The default fetch is never used from a test.
 */
import { toCrossJSONAsync } from "seroval";
import { SCHOOL_ORIGIN } from "./school-account.ts";
import type { SessionEndReport } from "./session-report.ts";

/** The website's session-end parent-report mailer. */
const SESSION_END_REPORT_FN = "7a5f5706d9c2ad4456772f2370c95bbcb23cc10a1619e116b45a364dca15a195";

/** All seroval features, matching the website client. */
const SEROVAL_FEATURES = 127;

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

type PostDeps = {
  fetch?: FetchLike;
  token?: string;
  userId?: string;
};

async function accountToken(deps: PostDeps): Promise<string> {
  if (deps.token) return deps.token;
  if (!deps.userId) return "";
  try {
    const { getSql } = await import("./db");
    const { readAccountGrant } = await import("./school-mirror.server");
    const { accountIdOf } = await import("./school-account");
    const grant = await readAccountGrant(await getSql(), accountIdOf(deps.userId));
    return grant?.token ?? "";
  } catch {
    return "";
  }
}

export async function postSessionEndReport(report: SessionEndReport, deps: PostDeps = {}): Promise<{ ok: boolean }> {
  const token = await accountToken(deps);
  const tree = await toCrossJSONAsync({
    data: {
      ...report,
      engine: report.engine,
      subject: report.subject,
      token,
    },
  });
  const fetchImpl = deps.fetch ?? fetch;
  try {
    const response = await fetchImpl(`${SCHOOL_ORIGIN}/_serverFn/${SESSION_END_REPORT_FN}`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-tsr-serverFn": "true",
        origin: SCHOOL_ORIGIN,
        referer: `${SCHOOL_ORIGIN}/`,
      },
      body: JSON.stringify({ t: tree, f: SEROVAL_FEATURES, m: [] }),
      redirect: "manual",
      referrerPolicy: "no-referrer",
      credentials: "omit",
      signal: AbortSignal.timeout(12_000),
    });
    return { ok: response.ok };
  } catch {
    return { ok: false };
  }
}
