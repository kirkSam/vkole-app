import type { Sql } from "@/lib/db";
import type { EngineLevel, FamilyStudent, LevelKey, LockReason, SchoolProfile } from "@/lib/school-account";
import { CLOCK_LIMIT_SECONDS, LEVEL_KEYS, accountIdOf, normalizeEngineLevel } from "@/lib/school-account";

export type SchoolMirror = {
  access: "open" | "closed";
  freeWeekStart: string | null;
  clockSeconds: number;
  clockLimit: number;
  studentName: string;
  plan: "month" | "year" | null;
  level: Partial<Record<LevelKey, EngineLevel>>;
  lastPushAt: string | null;
  officePurchased: boolean;
  officeSlug: string | null;
  activeStudent: number;
  students: FamilyStudent[];
  emailConfirmed: boolean;
  confirmationExpiresAt: string | null;
  freeWeekGranted: boolean;
  lockReason: LockReason;
};

/** The website bearer token, stored on the same row as the family mirror. */
export type AccountGrant = {
  token: string;
  expiresAt: string;
};

type MirrorRow = {
  access: string;
  free_week_start: unknown;
  clock_seconds: number | string | null;
  clock_limit?: number | string | null;
  student_name: string | null;
  plan: string | null;
  levels: string | null;
  last_push_at: unknown;
  office_purchased: boolean | number | string | null;
  office_slug: string | null;
  active_student?: number | string | null;
  students?: string | null;
  email_confirmed?: boolean | number | string | null;
  confirmation_expires_at?: unknown;
  free_week_granted?: boolean | number | string | null;
  lock_reason?: string | null;
};

export async function ensureSchoolMirror(sql: Sql): Promise<void> {
  await sql`
    create table if not exists school_mirror (
      user_id text primary key,
      access text not null,
      free_week_start timestamptz,
      clock_seconds integer not null default 0,
      student_name text,
      plan text,
      levels text,
      last_push_at timestamptz,
      updated_at timestamptz not null default now()
    )
  `;
  await sql`alter table school_mirror add column if not exists office_purchased boolean not null default false`;
  await sql`alter table school_mirror add column if not exists office_slug text`;
  await sql`alter table school_mirror add column if not exists account_token text`;
  await sql`alter table school_mirror add column if not exists token_expires_at timestamptz`;
  await sql`alter table school_mirror add column if not exists clock_limit integer not null default 28800`;
  await sql`alter table school_mirror add column if not exists active_student integer not null default 1`;
  await sql`alter table school_mirror add column if not exists students text`;
  await sql`alter table school_mirror add column if not exists email_confirmed boolean not null default true`;
  await sql`alter table school_mirror add column if not exists confirmation_expires_at timestamptz`;
  await sql`alter table school_mirror add column if not exists free_week_granted boolean not null default false`;
  await sql`alter table school_mirror add column if not exists lock_reason text not null default ''`;
}

function flag(value: boolean | number | string | null | undefined): boolean {
  return value === true || value === 1 || value === "1" || value === "t";
}

function parseStudents(raw: string | null | undefined): FamilyStudent[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as FamilyStudent[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((student) => student && Number.isInteger(student.index) && typeof student.name === "string");
  } catch {
    return [];
  }
}

function asLock(value: string | null | undefined): LockReason {
  if (value === "confirm-email" || value === "payment") return value;
  return "";
}

function parseLevels(raw: string | null): Partial<Record<LevelKey, EngineLevel>> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Partial<Record<LevelKey, EngineLevel>>;
    const level: Partial<Record<LevelKey, EngineLevel>> = {};
    for (const id of LEVEL_KEYS) {
      const item = normalizeEngineLevel(parsed[id], id);
      if (item) level[id] = item;
    }
    return level;
  } catch {
    return {};
  }
}

export async function readSchoolMirror(sql: Sql, userId: string): Promise<SchoolMirror | null> {
  await ensureSchoolMirror(sql);
  const rows = await sql<MirrorRow>`
    select access, free_week_start, clock_seconds, clock_limit, student_name, plan, levels, last_push_at,
      office_purchased, office_slug, active_student, students, email_confirmed,
      confirmation_expires_at, free_week_granted, lock_reason
    from school_mirror
    where user_id = ${userId}
  `;
  const row = rows[0];
  if (!row) return null;
  const plan = row.plan === "year" || row.plan === "month" ? row.plan : null;
  return {
    access: row.access === "open" ? "open" : "closed",
    freeWeekStart: row.free_week_start ? new Date(String(row.free_week_start)).toISOString() : null,
    clockSeconds: Math.max(0, Number(row.clock_seconds) || 0),
    clockLimit: Math.floor(Number(row.clock_limit)) > 0 ? Math.floor(Number(row.clock_limit)) : CLOCK_LIMIT_SECONDS,
    studentName: row.student_name?.trim() ?? "",
    plan,
    level: parseLevels(row.levels),
    lastPushAt: row.last_push_at ? new Date(String(row.last_push_at)).toISOString() : null,
    officePurchased: flag(row.office_purchased),
    officeSlug: typeof row.office_slug === "string" && row.office_slug.trim() ? row.office_slug.trim() : null,
    activeStudent: Number.isInteger(Number(row.active_student)) && Number(row.active_student) >= 1 ? Number(row.active_student) : 1,
    students: parseStudents(row.students),
    emailConfirmed: row.email_confirmed == null ? true : flag(row.email_confirmed),
    confirmationExpiresAt: row.confirmation_expires_at ? new Date(String(row.confirmation_expires_at)).toISOString() : null,
    freeWeekGranted: flag(row.free_week_granted),
    lockReason: asLock(row.lock_reason),
  };
}

export async function saveSchoolMirror(sql: Sql, userId: string, profile: SchoolProfile, pushed: boolean): Promise<void> {
  await ensureSchoolMirror(sql);
  const students = JSON.stringify(profile.students ?? []);
  const lockReason = profile.lockReason === "confirm-email" || profile.lockReason === "payment" ? profile.lockReason : "";
  const confirmed = profile.emailConfirmed === false ? false : true;
  await sql`
    insert into school_mirror (
      user_id, access, free_week_start, clock_seconds, clock_limit, student_name, plan, levels, last_push_at,
      office_purchased, office_slug, students, email_confirmed, confirmation_expires_at,
      free_week_granted, lock_reason, updated_at
    )
    values (
      ${userId},
      ${profile.access},
      ${profile.freeWeekStart},
      ${profile.clockSeconds},
      ${profile.clockLimit && profile.clockLimit > 0 ? Math.floor(profile.clockLimit) : CLOCK_LIMIT_SECONDS},
      ${profile.studentName || null},
      ${profile.plan},
      ${JSON.stringify(profile.level)},
      ${pushed ? new Date().toISOString() : null},
      ${profile.officePurchased === true},
      ${profile.officeSlug},
      ${students},
      ${confirmed},
      ${profile.confirmationExpiresAt ?? null},
      ${profile.freeWeekGranted === true},
      ${lockReason},
      now()
    )
    on conflict (user_id) do update
    set access = excluded.access,
        free_week_start = excluded.free_week_start,
        clock_seconds = excluded.clock_seconds,
        clock_limit = excluded.clock_limit,
        student_name = excluded.student_name,
        plan = excluded.plan,
        levels = excluded.levels,
        last_push_at = case when ${pushed} then now() else school_mirror.last_push_at end,
        office_purchased = excluded.office_purchased,
        office_slug = excluded.office_slug,
        students = excluded.students,
        email_confirmed = excluded.email_confirmed,
        confirmation_expires_at = excluded.confirmation_expires_at,
        free_week_granted = excluded.free_week_granted,
        lock_reason = excluded.lock_reason,
        updated_at = now()
  `;
}

export async function readActiveStudentIndex(sql: Sql, accountId: string): Promise<number> {
  await ensureSchoolMirror(sql);
  const rows = await sql<{ active_student: number | string | null }>`
    select active_student from school_mirror where user_id = ${accountIdOf(accountId)}
  `;
  const index = Number(rows[0]?.active_student);
  return Number.isInteger(index) && index >= 1 ? index : 1;
}

export async function saveActiveStudentIndex(sql: Sql, accountId: string, index: number): Promise<void> {
  await ensureSchoolMirror(sql);
  const next = Number.isInteger(index) && index >= 1 ? index : 1;
  await sql`
    insert into school_mirror (user_id, access, active_student, updated_at)
    values (${accountIdOf(accountId)}, 'closed', ${next}, now())
    on conflict (user_id) do update
    set active_student = excluded.active_student,
        updated_at = now()
  `;
}

type GrantRow = {
  account_token: string | null;
  token_expires_at: unknown;
};

export async function readAccountGrant(sql: Sql, userId: string): Promise<AccountGrant | null> {
  await ensureSchoolMirror(sql);
  const id = accountIdOf(userId);
  const rows = await sql<GrantRow>`
    select account_token, token_expires_at
    from school_mirror
    where user_id = ${id}
  `;
  const token = rows[0]?.account_token?.trim() ?? "";
  const raw = rows[0]?.token_expires_at;
  if (!token || !raw) return null;
  const expiresAt = new Date(String(raw)).toISOString();
  if (Number.isNaN(Date.parse(expiresAt))) return null;
  return { token, expiresAt };
}

export async function saveAccountGrant(sql: Sql, userId: string, grant: AccountGrant): Promise<void> {
  await ensureSchoolMirror(sql);
  const token = grant.token.trim();
  if (!token) return;
  const id = accountIdOf(userId);
  await sql`
    insert into school_mirror (user_id, access, account_token, token_expires_at, updated_at)
    values (${id}, 'closed', ${token}, ${grant.expiresAt}, now())
    on conflict (user_id) do update
    set account_token = excluded.account_token,
        token_expires_at = excluded.token_expires_at,
        updated_at = now()
  `;
}

export async function clearAccountGrant(sql: Sql, userId: string): Promise<void> {
  await ensureSchoolMirror(sql);
  await sql`
    update school_mirror
    set account_token = null, token_expires_at = null, updated_at = now()
    where user_id = ${accountIdOf(userId)}
  `;
}
