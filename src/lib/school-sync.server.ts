import { getSql, type Sql } from "@/lib/db";
import { localDayKey, PACIFIC, projectClock } from "@/lib/day-clock-math";
import {
  ENGINE_IDS,
  SCHOOL_ACCOUNT_GONE_MESSAGE,
  SCHOOL_LEGACY_MESSAGE,
  SCHOOL_OFFLINE_MESSAGE,
  SCHOOL_SEPARATE_MESSAGE,
  isFreshSchoolProfile,
  schoolWriteBody,
  sgAccountLevel,
  type AccountSession,
  type EngineId,
  type EngineLevel,
  type LevelKey,
  type SchoolProfile,
} from "@/lib/school-account";
import { readSchoolAccount, SchoolCallError, writeSchoolAccount } from "@/lib/school-account.server";
import { readAccountGrant, readSchoolMirror, saveAccountGrant, saveSchoolMirror } from "@/lib/school-mirror.server";
import { separateSignIn } from "@/lib/school-session.server";
import { masteryFromDetails, richerMastery } from "@/lib/vkole-singapore-report";
import { isSightBand } from "@/lib/vkole/constants";
import { spAccountLevel } from "@/lib/vkole/spelling/level";
import { isSpBand, letterView } from "@/lib/vkole/spelling/items";
import { paAccountLevel } from "@/lib/vkole/phonemic-awareness/level";
import { cardFromAccount as paCardFromAccount, isPaBand } from "@/lib/vkole/phonemic-awareness/items";
import { swAccountLevel } from "@/lib/vkole/sight-words/level";
import { cardFromAccount } from "@/lib/vkole/sight-words/words";

const LOGIN_CLOCK = "login";

function rowTime(value: unknown): string {
  return String(value ?? "");
}

async function applyProfile(sql: Sql, userId: string, profile: SchoolProfile): Promise<void> {
  const mirror = await readSchoolMirror(sql, userId);
  const name = profile.studentName.trim() || "student";
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
    if (engine === "sp" && level.band && level.band !== "LK") continue;
    if (engine === "sp" && level.band) {
      const view = letterView({ index: level.index ?? 0, silence: level.streak ?? 0, wrong: level.missStreak ?? 0 });
      const reached = level.reached ?? 0;
      const missed = level.missed ?? 0;
      const grade = Math.min(12, Math.max(1, Math.round(level.grade) || 1));
      await sql`
        update climbs
        set level = ${grade},
            standard_step = ${view.index},
            correct_at_level = ${view.silence},
            incorrect_streak = ${view.wrong},
            standard_code = ${view.band},
            standard_label = ${view.name},
            current_prompt = ${view.show},
            answer_key = ${view.answer},
            answer_aliases = ${JSON.stringify(view.also)},
            answer_note = ${view.name},
            question_id = ${`sp:${view.band}:${view.id}:s${view.silence}:w${view.wrong}`},
            performance_level = ${level.earnedGrade ?? grade},
            right_count = ${reached},
            asked = ${reached + missed},
            updated_at = now()
        where user_id = ${userId} and subject = ${engine}
      `;
      continue;
    }
    if (engine === "pa" && level.band) {
      const card = paCardFromAccount(level, level.grade);
      const reached = level.reached ?? 0;
      const missed = level.missed ?? 0;
      await sql`
        update climbs
        set level = ${Math.min(12, Math.max(1, Math.round(card.grade) || 1))},
            standard_step = ${card.index},
            standard_code = ${card.band},
            standard_label = ${card.name},
            current_prompt = ${card.say},
            answer_key = ${card.answer},
            answer_aliases = ${JSON.stringify(card.also)},
            answer_note = ${card.name},
            question_id = ${`pa:${card.band}:${card.index}`},
            performance_level = ${level.earnedGrade ?? card.grade},
            correct_at_level = ${level.streak ?? 0},
            incorrect_streak = ${level.missStreak ?? 0},
            right_count = ${reached},
            asked = ${reached + missed},
            updated_at = now()
        where user_id = ${userId} and subject = ${engine}
      `;
      continue;
    }
    if (engine === "sw" && level.band) {
      const card = cardFromAccount(level, level.grade);
      const reached = level.reached ?? 0;
      const missed = level.missed ?? 0;
      await sql`
        update climbs
        set level = ${Math.min(12, Math.max(1, Math.round(card.grade) || 1))},
            standard_step = ${card.index},
            standard_code = ${card.band},
            standard_label = ${card.label},
            current_prompt = ${level.word || card.word},
            answer_key = ${level.word || card.word},
            performance_level = ${level.earnedGrade ?? card.grade},
            right_count = ${reached},
            asked = ${reached + missed},
            updated_at = now()
        where user_id = ${userId} and subject = ${engine}
      `;
      continue;
    }
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

async function collectLevel(sql: Sql, userId: string, remote: Partial<Record<LevelKey, EngineLevel>>) {
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
    standard_code: string | null;
    current_prompt: string | null;
  }>`
    select subject, level, standard_step, child_name, performance_level, correct_at_level,
      incorrect_streak, asked, right_count, start_grade, standard_code, current_prompt
    from climbs
    where user_id = ${userId}
    order by updated_at desc
  `;
  const level: Partial<Record<LevelKey, EngineLevel>> = { ...remote };
  const seen = new Set<string>();
  for (const row of rows) {
    if (!ENGINE_IDS.includes(row.subject as EngineId) || seen.has(row.subject)) continue;
    seen.add(row.subject);
    const grade = Math.min(12, Math.max(1, Math.round(Number(row.level) || 1)));
    if (row.subject === "sp") {
      const view = letterView({
        index: Math.max(0, Math.round(Number(row.standard_step) || 0)),
        silence: Math.max(0, Math.round(Number(row.correct_at_level) || 0)),
        wrong: Math.max(0, Math.round(Number(row.incorrect_streak) || 0)),
      });
      const band = isSpBand(row.standard_code) ? row.standard_code : view.band;
      const reached = Math.max(0, Math.round(Number(row.right_count) || 0));
      const asked = Math.max(reached, Math.round(Number(row.asked) || 0));
      const starting = Number(row.start_grade);
      level.sp = spAccountLevel(remote.sp, {
        name: row.child_name?.trim() || remote.sp?.name || "",
        grade,
        band,
        index: view.index,
        word: view.id,
        silence: view.silence,
        wrong: view.wrong,
        earnedGrade: Math.min(12, Math.max(1, Math.round(Number(row.performance_level) || grade))),
        reached,
        missed: asked - reached,
        ...(Number.isInteger(starting) && starting >= 1 && starting <= 12 ? { startingGrade: starting } : {}),
        updatedAt: Date.now(),
      });
      continue;
    }
    if (row.subject === "pa") {
      const card = paCardFromAccount(
        {
          grade,
          band: isPaBand(row.standard_code) ? row.standard_code : undefined,
          index: Math.max(0, Math.round(Number(row.standard_step) || 0)),
          word: row.current_prompt,
        },
        grade,
      );
      const reached = Math.max(0, Math.round(Number(row.right_count) || 0));
      const asked = Math.max(reached, Math.round(Number(row.asked) || 0));
      const starting = Number(row.start_grade);
      level.pa = paAccountLevel(remote.pa, {
        name: row.child_name?.trim() || remote.pa?.name || "",
        grade,
        band: card.band,
        index: card.index,
        word: card.id,
        earnedGrade: Math.min(12, Math.max(1, Math.round(Number(row.performance_level) || card.grade))),
        reached,
        missed: asked - reached,
        streak: Math.max(0, Math.round(Number(row.correct_at_level) || 0)),
        missStreak: Math.max(0, Math.round(Number(row.incorrect_streak) || 0)),
        ...(Number.isInteger(starting) && starting >= 1 && starting <= 12 ? { startingGrade: starting } : {}),
        updatedAt: Date.now(),
      });
      continue;
    }
    if (row.subject === "sw") {
      const card = cardFromAccount(
        {
          grade,
          band: isSightBand(row.standard_code) ? row.standard_code : undefined,
          index: Math.max(0, Math.round(Number(row.standard_step) || 0)),
        },
        grade,
      );
      const reached = Math.max(0, Math.round(Number(row.right_count) || 0));
      const asked = Math.max(reached, Math.round(Number(row.asked) || 0));
      const starting = Number(row.start_grade);
      level.sw = swAccountLevel(remote.sw, {
        name: row.child_name?.trim() || remote.sw?.name || "",
        grade,
        band: card.band,
        index: card.index,
        word: row.current_prompt?.trim() || card.word,
        earnedGrade: Math.min(12, Math.max(1, Math.round(Number(row.performance_level) || card.grade))),
        reached,
        missed: asked - reached,
        ...(Number.isInteger(starting) && starting >= 1 && starting <= 12 ? { startingGrade: starting } : {}),
        updatedAt: Date.now(),
      });
      continue;
    }
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
  const grant = await readAccountGrant(sql, userId);
  if (!grant) throw new SchoolCallError("unauthorized", "Sign in again.");
  const profile = await readSchoolAccount(userId, { token: grant.token, expiresAt: grant.expiresAt });
  if (isFreshSchoolProfile(profile)) {
    const { clearFreshLocalRows } = await import("./account-purge.server");
    await clearFreshLocalRows(sql, userId);
  }
  await applyProfile(sql, userId, profile);
  await saveAccountGrant(sql, userId, grant);
  return profile;
}

/**
 * Store the register or sign-in token before any family read, then fill the
 * mirror from GET /api/account/family. The child-name save uses that same token.
 */
export async function rememberAccountSession(session: AccountSession): Promise<SchoolProfile> {
  const sql = await getSql();
  await saveAccountGrant(sql, session.id, { token: session.token, expiresAt: session.expiresAt });
  let profile = session.profile;
  try {
    profile = await readSchoolAccount(session.id, { token: session.token, expiresAt: session.expiresAt });
  } catch (err) {
    if (err instanceof SchoolCallError && (err.reason === "unauthorized" || err.reason === "gone")) throw err;
  }
  await saveSchoolMirror(sql, session.id, profile, false);
  return profile;
}

export async function pushSchoolAccount(sql: Sql, userId: string): Promise<void> {
  const mirror = await readSchoolMirror(sql, userId);
  const remoteLevel = mirror?.level ?? {};
  const level = await collectLevel(sql, userId, remoteLevel);
  const localClock = await collectClock(sql, userId);
  const seen = await collectSeen(sql, userId);
  const named = await sql<{ child_name: string; age: number | string | null; start_grade: number | string | null }>`
    select child_name, age, start_grade from climbs
    where user_id = ${userId} and child_name is not null and trim(child_name) <> ''
    order by created_at asc
    limit 1
  `;
  const studentName = (mirror?.studentName || named[0]?.child_name || "").trim();
  const age = named[0]?.age == null ? null : Number(named[0].age);
  const startingGrade = named[0]?.start_grade == null ? null : Number(named[0].start_grade);
  const grant = await readAccountGrant(sql, userId);
  const body = schoolWriteBody(
    level,
    localClock,
    mirror?.clockSeconds ?? 0,
    seen,
    studentName ? { name: studentName, age, startingGrade } : undefined,
  );
  await writeSchoolAccount(userId, body, grant ? { token: grant.token, expiresAt: grant.expiresAt } : undefined);
  const next: SchoolProfile = {
    access: mirror?.access ?? "closed",
    studentName: studentName || mirror?.studentName || "",
    level,
    freeWeekStart: mirror?.freeWeekStart ?? null,
    clockSeconds: body.clock.seconds,
    seen,
    plan: mirror?.plan ?? null,
    officePurchased: mirror?.officePurchased === true,
    officeSlug: mirror?.officeSlug ?? null,
  };
  await saveSchoolMirror(sql, userId, next, true);
}

export async function withSchoolAccount<T>(userId: string, run: () => Promise<T>): Promise<T> {
  const kind = await separateSignIn(userId);
  if (kind === "dev") return run();
  if (kind === "legacy") throw new Error(SCHOOL_LEGACY_MESSAGE);
  if (kind !== "school") throw new Error(SCHOOL_SEPARATE_MESSAGE);
  const sql = await getSql();
  try {
    await pullSchoolAccount(sql, userId);
  } catch (err) {
    if (err instanceof SchoolCallError && err.reason === "unauthorized") {
      throw await endWebsiteSession(sql, userId, err.message);
    }
    if (err instanceof SchoolCallError && (err.reason === "unknown" || err.reason === "gone")) {
      try {
        const { expireLocalSignInCookies, forgetLocalAccount } = await import("./account-purge.server");
        await forgetLocalAccount(sql, userId);
        await expireLocalSignInCookies();
      } catch {
        throw new Error(SCHOOL_OFFLINE_MESSAGE);
      }
      throw new Error(SCHOOL_ACCOUNT_GONE_MESSAGE);
    }
    throw err;
  }
  const result = await run();
  try {
    await pushSchoolAccount(sql, userId);
  } catch (err) {
    if (err instanceof SchoolCallError && err.reason === "unauthorized") {
      throw await endWebsiteSession(sql, userId, err.message);
    }
    throw err;
  }
  return result;
}

async function endWebsiteSession(sql: Sql, userId: string, website: string): Promise<Error> {
  const { signInAgainError } = await import("./account-purge");
  try {
    const { expireLocalSignInCookies } = await import("./account-purge.server");
    const { clearAccountGrant } = await import("./school-mirror.server");
    await clearAccountGrant(sql, userId);
    await expireLocalSignInCookies();
  } catch {
    throw new Error(SCHOOL_OFFLINE_MESSAGE);
  }
  return new Error(signInAgainError(website));
}

