import { getSql, type Sql } from "@/lib/db";
import { localDayKey, PACIFIC, projectClock } from "@/lib/day-clock-math";
import {
  ENGINE_IDS,
  SCHOOL_LEGACY_MESSAGE,
  SCHOOL_SEPARATE_MESSAGE,
  schoolWriteBody,
  sgAccountLevel,
  type EngineId,
  type EngineLevel,
  type SchoolProfile,
  type SeenQuestion,
} from "@/lib/school-account";
import { readSchoolAccount, writeSchoolAccount } from "@/lib/school-account.server";
import { readSchoolMirror, saveSchoolMirror } from "@/lib/school-mirror.server";
import { separateSignIn } from "@/lib/school-session.server";
import { masteryFromDetails, richerMastery } from "@/lib/vkole-singapore-report";

const LOGIN_CLOCK = "login";

function rowTime(value: unknown): string {
  return String(value ?? "");
}

async function childName(sql: Sql, userId: string, fallback: string): Promise<string> {
  const rows = await sql<{ child_name: string }>`
    select child_name from climbs where user_id = ${userId} order by created_at asc limit 1
  `;
  return rows[0]?.child_name?.trim() || fallback.trim() || "student";
}

async function applyProfile(sql: Sql, userId: string, profile: SchoolProfile): Promise<void> {
  const mirror = await readSchoolMirror(sql, userId);
  const name = await childName(sql, userId, profile.studentName || mirror?.studentName || "");
  const key = name.toLowerCase();
  if (profile.freeWeekStart) {
    await sql`
      insert into app_trials (user_id, subject, started_at)
      values (${userId}, 'app', ${profile.freeWeekStart})
      on conflict (user_id, subject) do update
      set started_at = excluded.started_at
    `;
  }
  const localLevels = await sql<{ subject: string; updated_at: unknown }>`
    select subject, updated_at from climbs where user_id = ${userId}
  `;
  const pushedAt = mirror?.lastPushAt ? new Date(mirror.lastPushAt).getTime() : null;
  for (const engine of ENGINE_IDS) {
    const level = profile.level[engine];
    if (!level) continue;
    const local = localLevels.find((row) => row.subject === engine);
    const localAt = local ? new Date(String(rowTime(local.updated_at))).getTime() : 0;
    if (pushedAt != null && local && localAt > pushedAt) continue;
    if (engine === "sg" && typeof level.streak === "number") {
      await sql`
        update climbs
        set level = ${level.grade},
            standard_step = ${level.step},
            performance_level = ${level.earnedGrade ?? level.grade},
            correct_at_level = ${level.streak},
            incorrect_streak = ${level.missStreak ?? 0},
            right_count = ${level.reached ?? 0},
            asked = ${(level.reached ?? 0) + (level.missed ?? 0)},
            updated_at = now()
        where user_id = ${userId} and subject = ${engine}
      `;
      continue;
    }
    await sql`
      update climbs
      set level = ${level.grade},
          standard_step = ${level.step},
          updated_at = now()
      where user_id = ${userId} and subject = ${engine}
    `;
  }
  const day = localDayKey(PACIFIC);
  const clockSeconds = profile.clockSeconds;
  if (clockSeconds > 0) {
    await sql`
      insert into day_clocks (user_id, child_key, day_key, used_seconds, last_tick_at, armed, time_zone)
      values (${userId}, ${LOGIN_CLOCK}, ${day}, ${clockSeconds}, null, 0, ${PACIFIC})
      on conflict (user_id, child_key, day_key) do update
      set used_seconds = greatest(day_clocks.used_seconds, excluded.used_seconds),
          time_zone = excluded.time_zone
    `;
  }
  for (const item of profile.seen) {
    await sql`
      insert into seen_prompts (user_id, child_key, prompt_key, prompt_text)
      values (${userId}, ${key}, ${item.key}, ${item.text})
      on conflict (user_id, child_key, prompt_key) do update
      set prompt_text = case
        when seen_prompts.prompt_text is null or seen_prompts.prompt_text = '' then excluded.prompt_text
        else seen_prompts.prompt_text
      end
    `;
  }
  await saveSchoolMirror(sql, userId, profile, false);
}

async function collectLevel(sql: Sql, userId: string, remote: Partial<Record<EngineId, EngineLevel>>) {
  const rows = await sql<{
    subject: string;
    level: number | string;
    standard_step: number | string | null;
    child_name: string;
    performance_level: number | string | null;
    correct_at_level: number | string | null;
    incorrect_streak: number | string | null;
    asked: number | string | null;
    right_count: number | string | null;
    start_grade: number | string | null;
  }>`
    select subject, level, standard_step, child_name, performance_level, correct_at_level,
      incorrect_streak, asked, right_count, start_grade
    from climbs
    where user_id = ${userId}
    order by updated_at desc
  `;
  const level: Partial<Record<EngineId, EngineLevel>> = { ...remote };
  const seen = new Set<string>();
  for (const row of rows) {
    if (!ENGINE_IDS.includes(row.subject as EngineId) || seen.has(row.subject)) continue;
    seen.add(row.subject);
    const grade = Math.min(12, Math.max(1, Math.round(Number(row.level) || 1)));
    const step = Math.min(2, Math.max(0, Math.round(Number(row.standard_step) || 0)));
    if (row.subject === "sg") {
      const events = await sql<{ detail: string; correct: boolean | number | string | null }>`
        select detail, correct from climb_events
        where user_id = ${userId} and subject = 'sg'
      `;
      const local = masteryFromDetails(
        events.map((event) => ({
          detail: event.detail,
          correct: event.correct === true || event.correct === 1 || event.correct === "1" || event.correct === "t",
        })),
      );
      const mastery = richerMastery(local, remote.sg?.mastery);
      const reached = Math.max(0, Math.round(Number(row.right_count) || 0));
      const asked = Math.max(reached, Math.round(Number(row.asked) || 0));
      const starting = Number(row.start_grade);
      level.sg = sgAccountLevel(remote.sg, {
        name: row.child_name?.trim() || remote.sg?.name || "",
        grade,
        step,
        earnedGrade: Math.min(12, Math.max(1, Math.round(Number(row.performance_level) || grade))),
        streak: Math.max(0, Math.round(Number(row.correct_at_level) || 0)),
        missStreak: Math.max(0, Math.round(Number(row.incorrect_streak) || 0)),
        reached,
        missed: asked - reached,
        ...(Number.isInteger(starting) && starting >= 1 && starting <= 12 ? { startingGrade: starting } : {}),
        ...(mastery ? { mastery } : {}),
        updatedAt: Date.now(),
      });
      continue;
    }
    level[row.subject as EngineId] = { grade, step };
  }
  return level;
}

async function collectClock(sql: Sql, userId: string): Promise<number> {
  const day = localDayKey(PACIFIC);
  const rows = await sql<{ used_seconds: number | string | null; last_tick_at: unknown; armed: unknown }>`
    select used_seconds, last_tick_at, armed
    from day_clocks
    where user_id = ${userId} and child_key = ${LOGIN_CLOCK} and day_key = ${day}
  `;
  return projectClock(rows[0]).used;
}

async function collectSeen(sql: Sql, userId: string): Promise<Array<{ key: string; text: string }>> {
  const rows = await sql<{ prompt_key: string; prompt_text: string | null }>`
    select prompt_key, prompt_text
    from seen_prompts
    where user_id = ${userId}
    order by seen_at desc
    limit 400
  `;
  return rows.map((row) => ({ key: row.prompt_key, text: row.prompt_text?.trim() || row.prompt_key }));
}

export async function pullSchoolAccount(sql: Sql, userId: string): Promise<SchoolProfile> {
  const profile = await readSchoolAccount(userId);
  await applyProfile(sql, userId, profile);
  return profile;
}

export async function pushSchoolAccount(sql: Sql, userId: string): Promise<void> {
  const mirror = await readSchoolMirror(sql, userId);
  const remoteLevel = mirror?.level ?? {};
  const level = await collectLevel(sql, userId, remoteLevel);
  const localClock = await collectClock(sql, userId);
  const seen = await collectSeen(sql, userId);
  const body = schoolWriteBody(userId, level, localClock, mirror?.clockSeconds ?? 0, seen);
  await writeSchoolAccount(body);
  const next: SchoolProfile = {
    access: mirror?.access ?? "closed",
    studentName: mirror?.studentName ?? "",
    level,
    freeWeekStart: mirror?.freeWeekStart ?? null,
    clockSeconds: body.clockSeconds,
    seen,
    plan: mirror?.plan ?? null,
  };
  await saveSchoolMirror(sql, userId, next, true);
}

export async function withSchoolAccount<T>(userId: string, run: () => Promise<T>): Promise<T> {
  const kind = await separateSignIn(userId);
  if (kind === "dev") return run();
  if (kind === "legacy") throw new Error(SCHOOL_LEGACY_MESSAGE);
  if (kind !== "school") throw new Error(SCHOOL_SEPARATE_MESSAGE);
  const sql = await getSql();
  await pullSchoolAccount(sql, userId);
  const result = await run();
  await pushSchoolAccount(sql, userId);
  return result;
}

