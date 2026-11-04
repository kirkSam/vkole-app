import type { Sql } from "@/lib/db";
import {
  ENGINE_IDS,
  SCHOOL_ACCOUNT_GONE_MESSAGE,
  SCHOOL_LEGACY_MESSAGE,
  SCHOOL_OFFLINE_MESSAGE,
  SCHOOL_SEPARATE_MESSAGE,
  accountIdOf,
  clearsLocalProgress,
  profileKeepingProgress,
  sgAccountLevel,
  studentScopeId,
  type AccountSession,
  type EngineId,
  type EngineLevel,
  type LevelKey,
  type SchoolProfile,
} from "@/lib/school-account";
import { readSchoolAccount, SchoolCallError } from "@/lib/school-account.server";
import { readAccountGrant, readSchoolMirror, saveAccountGrant, saveActiveStudentIndex, saveSchoolMirror } from "@/lib/school-mirror.server";
import { masteryFromDetails, richerMastery } from "@/lib/vkole-singapore-report";
import { isSightBand } from "@/lib/vkole/constants";
import { spAccountLevel } from "@/lib/vkole/alphabet/level";
import { isSpBand, letterView } from "@/lib/vkole/alphabet/items";
import { ensureAlphabetCompletedColumn } from "@/lib/climbs";
import { paAccountLevel } from "@/lib/vkole/phonemic-awareness/level";
import { cardFromAccount as paCardFromAccount, migratePaBand } from "@/lib/vkole/phonemic-awareness/items";
import { swAccountLevel } from "@/lib/vkole/sight-words/level";
import { cardFromAccount } from "@/lib/vkole/sight-words/words";

async function applyProfile(sql: Sql, userId: string, profile: SchoolProfile): Promise<SchoolProfile> {
  await ensureAlphabetCompletedColumn(sql);
  const mirror = await readSchoolMirror(sql, userId);
  const kept = profileKeepingProgress(mirror, profile);
  if (Object.keys(kept.level).length === 0) {
    const fromClimbs = await collectLevel(sql, userId, {});
    if (Object.keys(fromClimbs).length > 0) kept.level = fromClimbs;
  }
  await saveSchoolMirror(sql, userId, kept, false);
  return kept;
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
 * mirror from GET /api/account/family. Account fields stay. The child does not.
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
    // Falls back to the sign-in response's own profile (computed the same way by the website),
    // but this failure is otherwise invisible — log it so a mismatch has a trail to follow.
    console.error("rememberAccountSession: family refresh failed, using the sign-in profile instead", err);
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

/**
 * Re-pull the family profile for an already-signed-in parent, using the
 * stored sign-in token instead of a fresh password. A parent who confirms
 * their email in a separate tab has no other way to make the app notice --
 * nothing refreshes `school_mirror` between sign-ins otherwise.
 */
export async function refreshSchoolAccount(accountId: string): Promise<SchoolProfile> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const grant = await readAccountGrant(sql, accountId);
  if (!grant) throw new SchoolCallError("unauthorized", "Sign in again.");
  const { readActiveStudentIndex } = await import("@/lib/school-mirror.server");
  const index = await readActiveStudentIndex(sql, accountId);
  const scope = studentScopeId(accountId, index);
  const profile = await readSchoolAccount(scope, { token: grant.token, expiresAt: grant.expiresAt });
  const mirror = await readSchoolMirror(sql, scope);
  const kept = profileKeepingProgress(mirror, profile);
  await saveSchoolMirror(sql, scope, kept, false);
  return kept;
}

export async function pushSchoolAccount(_sql: Sql, _userId: string): Promise<void> {
  // The child name, age, starting grade, engine levels, day clock, seen questions,
  // and clock limit stay on this app. They are not posted to the website.
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
  // CLAUDE: changed at Sam's explicit direction -- the app and the school
  // website now share one parent account book, but never share a student's
  // level/progress. "school" (an account whose identity comes from the
  // website) now runs the handler directly, same as "dev"/"local" -- it
  // never pulls or pushes progress to the website. This is the one change
  // that actually guarantees "only the login is shared, nothing about a
  // student is" -- every account's progress now lives solely in this app's
  // own tables, regardless of where its identity came from.
  if (kind === "dev" || kind === "local" || kind === "school") return run();
  if (kind === "legacy") throw new Error(SCHOOL_LEGACY_MESSAGE);
  throw new Error(SCHOOL_SEPARATE_MESSAGE);
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

