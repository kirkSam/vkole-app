/**
 * Server-only purge of account and student rows this app still stores.
 * Does not drop tables and does not touch the learning engines.
 * Never log or return the shared secret.
 */
import { timingSafeEqual } from "node:crypto";
import type { Sql } from "./db.ts";
import {
  PURGE_CONFIRM,
  SCHOOL_ACCOUNT_GONE_MESSAGE,
  SIGN_IN_COOKIES,
} from "./account-purge.ts";

export { SCHOOL_ACCOUNT_GONE_MESSAGE };

/**
 * Parent and student rows. `app_mail` is not here: it stores the operator
 * mail credential, not a parent account. `_migrations` is not here either.
 * Names are a fixed allowlist. Request input never chooses a table.
 */
const ACCOUNT_TABLES: {
  sqlName: string;
  regclass: string;
  userColumn?: string;
  emailColumn?: string;
  idColumn?: string;
  identifierColumn?: string;
}[] = [
  { sqlName: "climbs", regclass: "climbs", userColumn: "user_id" },
  { sqlName: "climb_events", regclass: "climb_events", userColumn: "user_id" },
  { sqlName: "climb_sittings", regclass: "climb_sittings", userColumn: "user_id" },
  { sqlName: "academic_mail", regclass: "academic_mail", userColumn: "user_id" },
  { sqlName: "app_trials", regclass: "app_trials", userColumn: "user_id" },
  { sqlName: "app_subscriptions", regclass: "app_subscriptions", userColumn: "user_id" },
  { sqlName: "parent_logins", regclass: "parent_logins", userColumn: "user_id", emailColumn: "email" },
  { sqlName: "payments", regclass: "payments", userColumn: "user_id", emailColumn: "email" },
  { sqlName: "student_passwords", regclass: "student_passwords", userColumn: "user_id" },
  { sqlName: "day_clocks", regclass: "day_clocks", userColumn: "user_id" },
  { sqlName: "assignment_sheets", regclass: "assignment_sheets", userColumn: "user_id" },
  { sqlName: "seen_prompts", regclass: "seen_prompts", userColumn: "user_id" },
  { sqlName: "question_bags", regclass: "question_bags", userColumn: "user_id" },
  { sqlName: "school_mirror", regclass: "school_mirror", userColumn: "user_id" },
  { sqlName: "registrations", regclass: "registrations", emailColumn: "email" },
  { sqlName: '"session"', regclass: '"session"', userColumn: '"userId"' },
  { sqlName: '"account"', regclass: '"account"', userColumn: '"userId"' },
  { sqlName: '"verification"', regclass: '"verification"', identifierColumn: '"identifier"' },
  { sqlName: '"user"', regclass: '"user"', idColumn: '"id"', emailColumn: '"email"' },
];

const ALLOWED_SQL = new Set(ACCOUNT_TABLES.map((table) => table.sqlName));

export function secretMatches(provided: string, expected: string | undefined): boolean {
  const left = Buffer.from(provided.trim());
  const right = Buffer.from((expected ?? "").trim());
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    if (left.length > 0) timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

export function adminEmailList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.includes("@"));
}

function assertAllowed(sqlName: string): void {
  if (!ALLOWED_SQL.has(sqlName)) throw new Error("Refusing to purge an unknown table.");
}

async function tableExists(sql: Sql, regclass: string): Promise<boolean> {
  const rows = await sql.query<{ name: string | null }>("select to_regclass($1) as name", [regclass]);
  return Boolean(rows[0]?.name);
}

async function deleteReturning(sql: Sql, sqlName: string, where: string, params: unknown[]): Promise<number> {
  assertAllowed(sqlName);
  const text = where
    ? `with deleted as (delete from ${sqlName} where ${where} returning 1) select count(*)::int as n from deleted`
    : `with deleted as (delete from ${sqlName} returning 1) select count(*)::int as n from deleted`;
  const rows = await sql.query<{ n: number | string }>(text, params);
  return Math.max(0, Number(rows[0]?.n) || 0);
}

function labelOf(sqlName: string): string {
  return sqlName.replaceAll('"', "");
}

/** Delete every parent and student row. Tables that are not installed are skipped. */
export async function purgeAllAccountRows(sql: Sql): Promise<Record<string, number>> {
  const cleared: Record<string, number> = {};
  const ordered = [
    ...ACCOUNT_TABLES.filter((table) => table.sqlName !== '"user"'),
    ...ACCOUNT_TABLES.filter((table) => table.sqlName === '"user"'),
  ];
  for (const table of ordered) {
    if (!(await tableExists(sql, table.regclass))) continue;
    cleared[labelOf(table.sqlName)] = await deleteReturning(sql, table.sqlName, "", []);
  }
  return cleared;
}

/**
 * Delete one website account's local rows (session, climbs, trial, mirror, and
 * the rest of the account tables). `id` is the parent email or the older user id.
 */
export async function forgetLocalAccount(sql: Sql, id: string): Promise<Record<string, number>> {
  const key = id.trim().toLowerCase();
  if (!key) return {};
  const ids = new Set<string>([key]);
  const emails = new Set<string>();
  if (key.includes("@")) emails.add(key);

  if (await tableExists(sql, '"user"')) {
    const rows = await sql.query<{ id: string; email: string | null }>(
      'select "id", "email" from "user" where "id" = $1 or lower("email") = $1',
      [key],
    );
    for (const row of rows) {
      if (row.id) ids.add(row.id);
      const email = row.email?.trim().toLowerCase();
      if (email) emails.add(email);
    }
  }

  const cleared: Record<string, number> = {};
  const add = (name: string, count: number) => {
    if (count <= 0) return;
    cleared[name] = (cleared[name] ?? 0) + count;
  };

  for (const table of ACCOUNT_TABLES) {
    if (table.sqlName === '"user"' || table.sqlName === '"verification"') continue;
    if (!(await tableExists(sql, table.regclass))) continue;
    if (table.userColumn) {
      for (const userId of ids) {
        add(labelOf(table.sqlName), await deleteReturning(sql, table.sqlName, `${table.userColumn} = $1`, [userId]));
      }
    }
    if (table.emailColumn) {
      for (const email of emails) {
        add(
          labelOf(table.sqlName),
          await deleteReturning(sql, table.sqlName, `lower(${table.emailColumn}) = $1`, [email]),
        );
      }
    }
  }

  if (await tableExists(sql, '"verification"')) {
    const identifiers = new Set<string>([...ids, ...emails]);
    for (const email of emails) identifiers.add(`vkole-reset:${email}`);
    for (const identifier of identifiers) {
      add(
        "verification",
        await deleteReturning(sql, '"verification"', '"identifier" = $1', [identifier]),
      );
    }
  }

  if (await tableExists(sql, '"user"')) {
    for (const userId of ids) {
      add("user", await deleteReturning(sql, '"user"', '"id" = $1', [userId]));
    }
    for (const email of emails) {
      add("user", await deleteReturning(sql, '"user"', 'lower("email") = $1', [email]));
    }
  }

  return cleared;
}

/** Expire this response's sign-in cookies. Safe to call when no request is open. */
export async function expireLocalSignInCookies(): Promise<void> {
  try {
    const { setCookie } = await import("@tanstack/react-start/server");
    for (const cookie of SIGN_IN_COOKIES) {
      setCookie(cookie.name, "", {
        path: "/",
        httpOnly: cookie.httpOnly,
        secure: true,
        sameSite: "lax",
        maxAge: 0,
      });
    }
  } catch {
    /* Outside a request, or the cookie store is unavailable. */
  }
}

export type PurgeDeps = {
  expectedSecret?: string;
  adminEmails?: string[];
  lookupSession?: () => Promise<string | null>;
  loadSql?: () => Promise<Sql>;
  purge?: (sql: Sql) => Promise<Record<string, number>>;
  expireCookies?: () => Promise<void>;
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

/**
 * POST /api/vkole/purge. Allowed when the shared secret matches, or when the
 * signed-in email is on the admin list. Requires the confirm phrase.
 * Returns counts only.
 */
export async function handleAccountPurge(request: Request, deps: PurgeDeps = {}): Promise<Response> {
  if (request.method !== "POST") return new Response(null, { status: 405 });

  const provided = request.headers.get("x-vkole-secret") ?? "";
  let allowed = secretMatches(provided, deps.expectedSecret);
  if (!allowed) {
    let email: string | null = null;
    try {
      email = (await deps.lookupSession?.()) ?? null;
    } catch {
      email = null;
    }
    const admins = (deps.adminEmails ?? []).map((item) => item.trim().toLowerCase());
    allowed = Boolean(email && admins.includes(email.trim().toLowerCase()));
  }
  if (!allowed) return json({ ok: false }, 401);

  let confirm: unknown;
  try {
    const text = await request.text();
    if (text.length > 2000) return json({ ok: false }, 400);
    confirm = text ? (JSON.parse(text) as { confirm?: unknown }).confirm : undefined;
  } catch {
    return json({ ok: false }, 400);
  }
  if (confirm !== PURGE_CONFIRM) return json({ ok: false }, 400);

  try {
    const sql = await deps.loadSql?.();
    if (!sql) return json({ ok: false }, 500);
    const purge = deps.purge ?? purgeAllAccountRows;
    const cleared = await purge(sql);
    await (deps.expireCookies ?? expireLocalSignInCookies)();
    return json({ ok: true, cleared }, 200);
  } catch {
    return json({ ok: false }, 500);
  }
}
