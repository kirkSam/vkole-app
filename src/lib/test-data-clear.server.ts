/**
 * Count, then delete, this app's copied family records.
 * Records only. Tables, migrations, operator settings, and the operator mailbox stay.
 * The master account's own rows stay. Everyone else's rows go.
 * Never log row contents, passwords, or a connection string.
 */
import type { Sql } from "./db.ts";
import { websiteMasterEmail } from "./school-account.ts";
import {
  CLEAR_TABLES,
  ONLY_MASTER_MESSAGE,
  TYPE_PHRASE_MESSAGE,
  clearedAt,
  mayClearTestData,
  phraseMatches,
  type ClearTableKey,
  type TestDataClear,
  type TestDataCounts,
  type TestDataView,
} from "./test-data-clear.ts";

const ALLOWED = new Set<string>(CLEAR_TABLES.map((table) => table.sqlName));

function assertAllowed(sqlName: string): void {
  if (!ALLOWED.has(sqlName)) throw new Error("Refusing to clear an unknown table.");
}

async function tableExists(sql: Sql, regclass: string): Promise<boolean> {
  const rows = await sql.query<{ name: string | null }>("select to_regclass($1) as name", [regclass]);
  return Boolean(rows[0]?.name);
}

async function countOf(sql: Sql, sqlName: string): Promise<number> {
  assertAllowed(sqlName);
  const rows = await sql.query<{ n: number | string }>(`select count(*)::int as n from ${sqlName}`);
  const n = Number(rows[0]?.n);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

async function studentNames(sql: Sql): Promise<string[]> {
  if (!(await tableExists(sql, "climbs"))) return [];
  const rows = await sql.query<{ name: string | null }>(
    `select distinct btrim(child_name) as name
     from climbs
     where btrim(coalesce(child_name, '')) <> ''
     order by 1`,
  );
  return rows.map((row) => row.name?.trim() ?? "").filter((name) => name.length > 0);
}

async function gather(sql: Sql): Promise<{ counts: TestDataCounts; students: string[] }> {
  const counts = { students: 0 } as TestDataCounts;
  for (const table of CLEAR_TABLES) {
    counts[table.key] = (await tableExists(sql, table.regclass)) ? await countOf(sql, table.sqlName) : 0;
  }
  const students = await studentNames(sql);
  counts.students = students.length;
  return { counts, students };
}

async function actorIsMaster(sql: Sql, userId: string, masterRaw?: string | null): Promise<boolean> {
  if (mayClearTestData(userId, masterRaw)) return true;
  if (!(await tableExists(sql, '"user"'))) return false;
  const rows = await sql.query<{ email: string | null }>(
    'select "email" from "user" where "id" = $1 or lower("email") = lower($1) limit 1',
    [userId],
  );
  return mayClearTestData(rows[0]?.email ?? "", masterRaw);
}

function keptUser(column: string, table: string): string {
  return `not exists (
    select 1 from "user" u
    where u."id" = ${table}.${column}
      and (lower(coalesce(u."email", '')) = $1 or u."id" = $1)
  )`;
}

function notMasterUserId(table: string, column: string, users: boolean): string {
  const byEmail = `lower(split_part(coalesce(${column}, ''), '#student-', 1)) <> $1`;
  return users ? `${byEmail} and ${keptUser(column, table)}` : byEmail;
}

function deleteSql(table: (typeof CLEAR_TABLES)[number], users: boolean): string {
  assertAllowed(table.sqlName);
  const name = table.sqlName;
  if (table.match === "user") {
    return `delete from ${name} where lower(coalesce("email", '')) <> $1 and "id" <> $1`;
  }
  if (table.match === "session") {
    return `delete from ${name} where ${notMasterUserId(name, '"userId"', users)}`;
  }
  if (table.match === "account") {
    return `delete from ${name} where ${notMasterUserId(name, '"userId"', users)}`;
  }
  if (table.match === "verification") {
    const byEmail = `lower(coalesce("identifier", '')) <> $1 and lower(coalesce("identifier", '')) <> ('vkole-reset:' || $1)`;
    const byUser = users ? ` and ${keptUser('"identifier"', name)}` : "";
    return `delete from ${name} where ${byEmail}${byUser}`;
  }
  if (table.match === "email") {
    return `delete from ${name} where lower(coalesce(email, '')) <> $1`;
  }
  if (table.match === "both") {
    return `delete from ${name} where lower(coalesce(email, '')) <> $1 and ${notMasterUserId(name, "user_id", users)}`;
  }
  return `delete from ${name} where ${notMasterUserId(name, "user_id", users)}`;
}

const DELETE_LAST: ClearTableKey[] = ["verification", "sign_in_accounts", "sessions", "users"];

/** Step 1. The master sees counts and student names. Anyone else sees nothing. */
export async function showTestDataCounts(
  sql: Sql,
  userId: string,
  masterRaw?: string | null,
): Promise<TestDataView> {
  if (!(await actorIsMaster(sql, userId, masterRaw))) return { ok: false };
  const { counts, students } = await gather(sql);
  return { ok: true, counts, students, at: clearedAt() };
}

/** Step 2. Count, delete other families' records, count again. */
export async function confirmClearTestData(
  sql: Sql,
  userId: string,
  confirmation: string,
  masterRaw?: string | null,
): Promise<TestDataClear> {
  if (!(await actorIsMaster(sql, userId, masterRaw))) {
    return { ok: false, error: ONLY_MASTER_MESSAGE };
  }
  if (!phraseMatches(confirmation)) return { ok: false, error: TYPE_PHRASE_MESSAGE };
  const before = await gather(sql);
  const master = websiteMasterEmail(masterRaw);
  const users = await tableExists(sql, '"user"');
  const last = new Set<string>(DELETE_LAST);
  const ordered = [
    ...CLEAR_TABLES.filter((table) => !last.has(table.key)),
    ...DELETE_LAST.map((key) => CLEAR_TABLES.find((table) => table.key === key)).filter((table) => table != null),
  ];
  for (const table of ordered) {
    if (!(await tableExists(sql, table.regclass))) continue;
    await sql.query(deleteSql(table, users), [master]);
  }
  const after = await gather(sql);
  return {
    ok: true,
    before: before.counts,
    after: after.counts,
    studentsBefore: before.students,
    studentsAfter: after.students,
    at: clearedAt(),
  };
}
