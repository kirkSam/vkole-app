import type { Sql } from "@/lib/db";
import { DAY_LIMIT_SECONDS, localDayKey, PACIFIC, projectTodayClock } from "@/lib/day-clock-math";
import {
  ENGINE_IDS,
  SCHOOL_ACCOUNT_GONE_MESSAGE,
  SCHOOL_LEGACY_MESSAGE,
  SCHOOL_OFFLINE_MESSAGE,
  SCHOOL_SEPARATE_MESSAGE,
  accountIdOf,
  clearsLocalProgress,
  clockDayKeyOf,
  keptEngineLevel,
  keptLevels,
  profileKeepingProgress,
  schoolWriteBody,
  sgAccountLevel,
  studentIndexOf,
  studentScopeId,
  type AccountSession,
  type EngineId,
  type EngineLevel,
  type LevelKey,
  type SchoolProfile,
} from "@/lib/school-account";
import { readSchoolAccount, SchoolCallError, writeSchoolAccount } from "@/lib/school-account.server";
import { readAccountGrant, readSchoolMirror, saveAccountGrant, saveActiveStudentIndex, saveSchoolMirror } from "@/lib/school-mirror.server";
import { masteryFromDetails, richerMastery } from "@/lib/vkole-singapore-report";
import { isSightBand } from "@/lib/vkole/constants";
import { spAccountLevel } from "@/lib/vkole/spelling/level";
import { isSpBand, letterView, resumeAlphabetPlace } from "@/lib/vkole/spelling/items";
import { ensureAlphabetCompletedColumn } from "@/lib/climbs";
import { paAccountLevel } from "@/lib/vkole/phonemic-awareness/level";
import { cardFromAccount as paCardFromAccount, migratePaBand } from "@/lib/vkole/phonemic-awareness/items";
import { swAccountLevel } from "@/lib/vkole/sight-words/level";
import { cardFromAccount } from "@/lib/vkole/sight-words/words";
import { ensureSeen, mergeLocalSeen } from "@/lib/next-sheet";

const LOGIN_CLOCK = "login";

function rowTime(value: unknown): string {
  return String(value ?? "");
}

async function applyProfile(sql: Sql, userId: string, profile: SchoolProfile): Promise<SchoolProfile> {
  await ensureAlphabetCompletedColumn(sql);
  const mirror = await readSchoolMirror(sql, userId);
  const kept = profileKeepingProgress(mirror, profile);
  if (Object.keys(kept.level).length === 0) {
    const fromClimbs = await collectLevel(sql, userId, {});
    if (Object.keys(fromClimbs).length > 0) kept.level = fromClimbs;
  }
  const name = kept.studentName.trim() || profile.studentName.trim() || "student";
  const key = name.toLowerCase();
  if (profile.freeWeekStart && profile.freeWeekGranted === true && profile.lockReason !== "confirm-email") {
    await sql`
      insert into app_trials (user_id, subject, started_at)
      values (${userId}, 'app', ${profile.freeWeekStart})
      on conflict (user_id, subject) do update
      set started_at = excluded.started_at
    `;
  }
  const locked = profile.access !== "open";
  const localLevels = await sql<{
    subject: string;
    updated_at: unknown;
    level: number | string;
    standard_step: number | string | null;
    standard_code: string | null;
  }>`
    select subject, updated_at, level, standard_step, standard_code from climbs where user_id = ${userId}
  `;
  const pushedAt = mirror?.lastPushAt ? new Date(mirror.lastPushAt).getTime() : null;
  for (const engine of ENGINE_IDS) {
    if (locked) continue;
    const level = profile.level[engine];
    if (!level) continue;
    if (keptEngineLevel(engine, mirror?.level[engine], level) !== level) continue;
    const local = localLevels.find((row) => row.subject === engine);
    if (local && keptEngineLevel(engine, climbPlace(local), level) !== level) continue;
    const localAt = local ? new Date(String(rowTime(local.updated_at))).getTime() : 0;
    if (pushedAt != null && local && localAt > pushedAt) continue;
    if (engine === "sp" && level.band && level.band !== "LK") continue;
    if (engine === "sp" && level.band) {
      const place = resumeAlphabetPlace({
        index: level.index,
        word: level.word,
        silence: level.streak,
        wrong: level.missStreak,
        completedExercises: level.completedExercises,
      });
      const view = letterView(place);
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
            alphabet_completed = ${Array.isArray(level.completedExercises) ? level.completedExercises.join(",") : ""},
            performance_level = case when ${level.earnedGrade != null} then ${level.earnedGrade ?? grade} else performance_level end,
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
            performance_level = case when ${level.earnedGrade != null} then ${level.earnedGrade ?? card.grade} else performance_level end,
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
            performance_level = case when ${level.earnedGrade != null} then ${level.earnedGrade ?? card.grade} else performance_level end,
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
            performance_level = case when ${level.earnedGrade != null} then ${level.earnedGrade ?? level.grade} else performance_level end,
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
          performance_level = case when ${level.earnedGrade != null} then ${level.earnedGrade ?? level.grade} else performance_level end,
          updated_at = now()
      where user_id = ${userId} and subject = ${engine}
    `;
  }
  const clockDay = clockDayKeyOf(kept.clockDayKey);
  const clockSeconds = Math.max(0, Math.floor(kept.clockSeconds) || 0);
  if (clockDay && clockSeconds > 0) {
    await sql`
      insert into day_clocks (user_id, child_key, day_key, used_seconds, last_tick_at, armed, time_zone)
      values (${userId}, ${LOGIN_CLOCK}, ${clockDay}, ${clockSeconds}, null, 0, ${PACIFIC})
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
  await saveSchoolMirror(sql, userId, kept, false);
  return kept;
}

/** The place stored on a climb row, used so a starter payload cannot walk it backward. */
function climbPlace(row: {
  level: number | string;
  standard_step: number | string | null;
  standard_code: string | null;
}): EngineLevel {
  const step = Math.max(0, Math.round(Number(row.standard_step) || 0));
  const band = row.standard_code?.trim() || undefined;
  return { grade: Math.round(Number(row.level) || 0), step, index: step, ...(band ? { band } : {}) };
}

async function collectLevel(sql: Sql, userId: string, remote: Partial<Record<LevelKey, EngineLevel>>) {
  await ensureAlphabetCompletedColumn(sql);
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
    alphabet_completed: string | null;
  }>`
    select subject, level, standard_step, child_name, performance_level, correct_at_level,
      incorrect_streak, asked, right_count, start_grade, standard_code, current_prompt, alphabet_completed
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
        completedExercises: row.alphabet_completed,
        ...(Number.isInteger(starting) && starting >= 1 && starting <= 12 ? { startingGrade: starting } : {}),
        updatedAt: Date.now(),
      });
      continue;
    }
    if (row.subject === "pa") {
      const step = row.standard_step;
      const parsedStep = step == null || step === "" ? Number.NaN : Number(step);
      const index = Number.isInteger(parsedStep) && parsedStep >= 0 ? parsedStep : undefined;
      const card = paCardFromAccount(
        {
          grade,
          band: migratePaBand(row.standard_code),
          index,
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
    const earned = Math.min(12, Math.max(1, Math.round(Number(row.performance_level) || grade)));
    level[row.subject as EngineId] = { grade, step, earnedGrade: earned };
  }
  return level;
}

async function collectClock(sql: Sql, userId: string): Promise<number> {
  const rows = await sql<{ used_seconds: number | string | null; last_tick_at: unknown; armed: unknown; day_key: string | null }>`
    select used_seconds, last_tick_at, armed, day_key
    from day_clocks
    where user_id = ${userId} and child_key = ${LOGIN_CLOCK}
    order by day_key desc
    limit 1
  `;
  return projectTodayClock(rows[0]).used;
}

async function collectSeen(sql: Sql, userId: string): Promise<Array<{ key: string; text: string }>> {
  await ensureSeen(sql);
  await sql`alter table seen_prompts add column if not exists prompt_text text`;
  const stored = await sql<{ prompt_key: string; prompt_text: string | null; seen_at: unknown }>`
    select prompt_key, prompt_text, seen_at
    from seen_prompts
    where user_id = ${userId}
    order by seen_at desc
    limit 400
  `;
  const events = await sql<{ subject: string; detail: string; created_at: unknown }>`
    select subject, detail, created_at
    from climb_events
    where user_id = ${userId}
    order by created_at desc
    limit 400
  `;
  return mergeLocalSeen(
    stored.map((row) => ({ at: row.seen_at, key: row.prompt_key, text: row.prompt_text ?? "" })),
    events.map((row) => ({ at: row.created_at, subject: row.subject, detail: row.detail })),
  );
}

export async function pullSchoolAccount(sql: Sql, userId: string, opts?: { engineActive?: boolean }): Promise<SchoolProfile> {
  const account = accountIdOf(userId);
  const grant = await readAccountGrant(sql, account);
  if (!grant) throw new SchoolCallError("unauthorized", "Sign in again.");
  let spun: { token: string; expiresAt: string } | null = null;
  const profile = await readSchoolAccount(userId, {
    token: grant.token,
    expiresAt: grant.expiresAt,
    engineActive: opts?.engineActive === true,
    onGrant: (next) => {
      spun = next;
    },
  });
  const mirror = await readSchoolMirror(sql, userId);
  if (clearsLocalProgress(profile, mirror)) {
    const { clearFreshLocalRows } = await import("./account-purge.server.ts");
    await clearFreshLocalRows(sql, userId);
  }
  const kept = await applyProfile(sql, userId, profile);
  await saveAccountGrant(sql, account, spun ?? grant);
  return kept;
}

/**
 * Store the register or sign-in token before any family read, then fill the
 * mirror from GET /api/account/family. The child-name save uses that same token.
 */
export async function rememberAccountSession(session: AccountSession): Promise<SchoolProfile> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  await saveAccountGrant(sql, session.id, { token: session.token, expiresAt: session.expiresAt });
  let profile = session.profile;
  const index = profile.activeStudent && profile.activeStudent > 1 ? profile.activeStudent : 1;
  const scope = studentScopeId(session.id, index);
  try {
    profile = await readSchoolAccount(scope, { token: session.token, expiresAt: session.expiresAt });
  } catch (err) {
    if (err instanceof SchoolCallError && (err.reason === "unauthorized" || err.reason === "gone")) throw err;
  }
  await saveActiveStudentIndex(sql, session.id, profile.activeStudent ?? index);
  const mirror = await readSchoolMirror(sql, scope);
  const kept = profileKeepingProgress(mirror, profile);
  if (Object.keys(kept.level).length === 0) {
    const fromClimbs = await collectLevel(sql, scope, {});
    if (Object.keys(fromClimbs).length > 0) kept.level = fromClimbs;
  }
  await saveSchoolMirror(sql, scope, kept, false);
  return kept;
}

export async function pushSchoolAccount(sql: Sql, userId: string): Promise<void> {
  const mirror = await readSchoolMirror(sql, userId);
  // A locked family is not playing. Posting now would send an empty or starter
  // book over the levels the website already saved.
  if ((mirror?.access ?? "closed") !== "open") return;
  if (mirror?.lockReason === "confirm-email" || mirror?.lockReason === "payment") return;
  const remoteLevel = mirror?.level ?? {};
  const level = keptLevels(remoteLevel, await collectLevel(sql, userId, remoteLevel));
  const clockLimit = mirror?.clockLimit && mirror.clockLimit > 0 ? mirror.clockLimit : DAY_LIMIT_SECONDS;
  const dayKey = localDayKey(PACIFIC);
  const localClock = await collectClock(sql, userId);
  const remoteSeconds = Math.max(0, Math.floor(Number(mirror?.clockSeconds) || 0));
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
  const grant = await readAccountGrant(sql, accountIdOf(userId));
  let spun: { token: string; expiresAt: string } | null = null;
  const body = schoolWriteBody(
    level,
    localClock,
    remoteSeconds,
    seen,
    studentName ? { name: studentName, age, startingGrade } : undefined,
    clockLimit,
    studentIndexOf(userId),
    dayKey,
  );
  await writeSchoolAccount(
    userId,
    body,
    grant
      ? {
          token: grant.token,
          expiresAt: grant.expiresAt,
          onGrant: (next) => {
            spun = next;
          },
        }
      : undefined,
  );
  if (spun) await saveAccountGrant(sql, accountIdOf(userId), spun);
  const next: SchoolProfile = {
    access: mirror?.access ?? "closed",
    studentName: studentName || mirror?.studentName || "",
    level,
    freeWeekStart: mirror?.freeWeekStart ?? null,
    clockSeconds: body.clock.seconds,
    clockDayKey: body.clock.dayKey,
    clockLimit,
    seen,
    plan: mirror?.plan ?? null,
    officePurchased: mirror?.officePurchased === true,
    officeSlug: mirror?.officeSlug ?? null,
    activeStudent: studentIndexOf(userId),
    students: mirror?.students,
    emailConfirmed: mirror?.emailConfirmed,
    confirmationExpiresAt: mirror?.confirmationExpiresAt ?? null,
    freeWeekGranted: mirror?.freeWeekGranted,
    lockReason: mirror?.lockReason,
  };
  await saveSchoolMirror(sql, userId, next, true);
}

/**
 * Pull, run the local handler, then push.
 * An unauthorized website token ends the app session only when no engine is open.
 * During a sitting the local handler still runs, and the stored grant is left in place.
 */
export async function runWithSchoolBook<T>(opts: {
  engineActive: boolean;
  pull: () => Promise<unknown>;
  run: () => Promise<T>;
  push: () => Promise<unknown>;
  endSession: (message: string) => Promise<Error>;
  onAccountGone: (err: SchoolCallError) => Promise<never>;
}): Promise<T> {
  try {
    await opts.pull();
  } catch (err) {
    if (err instanceof SchoolCallError && err.reason === "unauthorized") {
      if (opts.engineActive) return opts.run();
      throw await opts.endSession(err.message);
    }
    if (err instanceof SchoolCallError && (err.reason === "unknown" || err.reason === "gone")) {
      return opts.onAccountGone(err);
    }
    throw err;
  }
  const result = await opts.run();
  try {
    await opts.push();
  } catch (err) {
    if (err instanceof SchoolCallError && err.reason === "unauthorized") {
      if (opts.engineActive) return result;
      throw await opts.endSession(err.message);
    }
    throw err;
  }
  return result;
}

export async function withSchoolAccount<T>(userId: string, run: () => Promise<T>, opts?: { engineActive?: boolean }): Promise<T> {
  const { separateSignIn } = await import("@/lib/school-session.server");
  const kind = await separateSignIn(userId);
  if (kind === "dev") return run();
  if (kind === "legacy") throw new Error(SCHOOL_LEGACY_MESSAGE);
  if (kind !== "school") throw new Error(SCHOOL_SEPARATE_MESSAGE);
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const engineActive = opts?.engineActive === true;
  return runWithSchoolBook({
    engineActive,
    pull: () => pullSchoolAccount(sql, userId, { engineActive }),
    run,
    push: () => pushSchoolAccount(sql, userId),
    endSession: (message) => endWebsiteSession(sql, userId, message),
    onAccountGone: async () => {
      try {
        const { expireLocalSignInCookies, forgetLocalAccount } = await import("./account-purge.server.ts");
        const account = accountIdOf(userId);
        await forgetLocalAccount(sql, account);
        if (account !== userId) await forgetLocalAccount(sql, userId);
        await expireLocalSignInCookies();
      } catch {
        throw new Error(SCHOOL_OFFLINE_MESSAGE);
      }
      throw new Error(SCHOOL_ACCOUNT_GONE_MESSAGE);
    },
  });
}

async function endWebsiteSession(sql: Sql, userId: string, website: string): Promise<Error> {
  const { signInAgainError } = await import("./account-purge.ts");
  try {
    const { expireLocalSignInCookies } = await import("./account-purge.server.ts");
    const { clearAccountGrant } = await import("./school-mirror.server.ts");
    await clearAccountGrant(sql, accountIdOf(userId));
    await expireLocalSignInCookies();
  } catch {
    throw new Error(SCHOOL_OFFLINE_MESSAGE);
  }
  return new Error(signInAgainError(website));
}

