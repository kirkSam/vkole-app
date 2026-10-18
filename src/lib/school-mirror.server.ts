import type { Sql } from "@/lib/db";
import type { EngineLevel, LevelKey, SchoolProfile } from "@/lib/school-account";
import { LEVEL_KEYS, normalizeEngineLevel } from "@/lib/school-account";

export type SchoolMirror = {
  access: "open" | "closed";
  freeWeekStart: string | null;
  clockSeconds: number;
  studentName: string;
  plan: "month" | "year" | null;
  level: Partial<Record<LevelKey, EngineLevel>>;
  lastPushAt: string | null;
  officePurchased: boolean;
  officeSlug: string | null;
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
  student_name: string | null;
  plan: string | null;
  levels: string | null;
  last_push_at: unknown;
  office_purchased: boolean | number | string | null;
  office_slug: string | null;
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
    select access, free_week_start, clock_seconds, student_name, plan, levels, last_push_at,
      office_purchased, office_slug
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
    studentName: row.student_name?.trim() ?? "",
    plan,
    level: parseLevels(row.levels),
    lastPushAt: row.last_push_at ? new Date(String(row.last_push_at)).toISOString() : null,
    officePurchased: row.office_purchased === true || row.office_purchased === 1 || row.office_purchased === "1" || row.office_purchased === "t",
    officeSlug: typeof row.office_slug === "string" && row.office_slug.trim() ? row.office_slug.trim() : null,
  };
}

export async function saveSchoolMirror(sql: Sql, userId: string, profile: SchoolProfile, pushed: boolean): Promise<void> {
  await ensureSchoolMirror(sql);
  await sql`
    insert into school_mirror (
      user_id, access, free_week_start, clock_seconds, student_name, plan, levels, last_push_at,
      office_purchased, office_slug, updated_at
    )
    values (
      ${userId},
      ${profile.access},
      ${profile.freeWeekStart},
      ${profile.clockSeconds},
      ${profile.studentName || null},
      ${profile.plan},
      ${JSON.stringify(profile.level)},
      ${pushed ? new Date().toISOString() : null},
      ${profile.officePurchased === true},
      ${profile.officeSlug},
      now()
    )
    on conflict (user_id) do update
    set access = excluded.access,
        free_week_start = excluded.free_week_start,
        clock_seconds = excluded.clock_seconds,
        student_name = excluded.student_name,
        plan = excluded.plan,
        levels = excluded.levels,
        last_push_at = case when ${pushed} then now() else school_mirror.last_push_at end,
        office_purchased = excluded.office_purchased,
        office_slug = excluded.office_slug,
        updated_at = now()
  `;
}

type GrantRow = {
  account_token: string | null;
  token_expires_at: unknown;
};

export async function readAccountGrant(sql: Sql, userId: string): Promise<AccountGrant | null> {
  await ensureSchoolMirror(sql);
  const rows = await sql<GrantRow>`
    select account_token, token_expires_at
    from school_mirror
    where user_id = ${userId}
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
  await sql`
    insert into school_mirror (user_id, access, account_token, token_expires_at, updated_at)
    values (${userId}, 'closed', ${token}, ${grant.expiresAt}, now())
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
    where user_id = ${userId}
  `;
}
