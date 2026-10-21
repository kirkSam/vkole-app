import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { IDLE_MS, academicLetter, finishSendsReport, parentLogoutLetter, trialState, type AppTime, type EndReason, type ReportEvent } from "@/lib/academic-email";
import { reportLine } from "@/lib/session-report";
import { schoolMiddleware } from "@/lib/school-middleware";
import { accountIdOf, isSchoolAccountId, schoolAccessDecision, studentIndexOf, type FamilyStudent } from "@/lib/school-account";
import { isSubject, SUBJECTS, subjectMeta, type SubjectId } from "@/lib/climb-rules";
import { moveRung, stepName, stepSentence } from "@/lib/cc-steps";
import { fillSheet, practicePromptText, rememberPrompt, seenKeys } from "@/lib/next-sheet";
import { capVkoleGrade } from "@/lib/vkole-cap";
import { getSql, type Sql } from "@/lib/db";
import { childAccess } from "@/lib/subscription";
import { settleGradingCall } from "@/lib/grading-pause";
import { dealQuestion, keyedAnswer, recentQuestions } from "@/lib/question-history";
import { answersMatch, chooseNext, keyedFeedback, RECENT_WINDOW } from "@/lib/question-pool";
import { clampStoredGrade, cycleInstruction, questionTheChildCanSee, requestCycle, unreadableReply } from "@/lib/vkole-cycle";
import { formatMasteryReport, masteryFromDetails } from "@/lib/vkole-singapore-report";
import { applyLetterAnswer, formatCompletedExercises, jumpToExercise, letterExercise, letterMoveNote, letterView, normalizeCompletedExercises, normalizeLetterProgress, noteExerciseCompletion, progressAfterSong, resumeAlphabetPlace } from "@/lib/vkole/spelling/items";
import { savedSpellingReport, spellingStatsFromEvents, writeSpellingReport } from "@/lib/vkole/spelling/report";
import { cardFromAccount as paCardFromAccount, migratePaBand, nextAfterAnswer, paPrompt } from "@/lib/vkole/phonemic-awareness/items";
import { cardFromAccount, nextCard, startCard } from "@/lib/vkole/sight-words/words";
import { isSightBand } from "@/lib/vkole/constants";

export type Climb = {
  id: string;
  childName: string;
  subject: SubjectId;
  level: number;
  performanceLevel: number;
  correctAtLevel: number;
  incorrectStreak: number;
  gradingFailures: number;
  asked: number;
  rightCount: number;
  age: number | null;
  startGrade: number | null;
  standardCode: string;
  standardLabel: string;
  standardStep: number;
  currentPrompt: string;
  lastFeedback: string;
  awaitingNext: boolean;
  startedAt: string;
  endsAt: string;
  daysLeft: number;
  expired: boolean;
  subscribed: boolean;
  subscriptionEndsAt: string | null;
  plan: "month" | "year" | null;
  renews: boolean;
  blocked: boolean;
  /** The website master email. No trial countdown and no payment gate. */
  fullAccess: boolean;
  /** The parent still needs to confirm the email. The payment lock stays separate. */
  confirmEmail: boolean;
  students: FamilyStudent[];
  activeStudent: number;
  onlineSeconds: number;
  /** Alphabet exercises finished in this flow. Other engines leave this empty. */
  completedExercises: number[];
};

const idSchema = z.object({ id: z.string().trim().min(8).max(80) });
const answerSchema = idSchema.extend({ answer: z.string().max(2000) });
const endSchema = idSchema.extend({ reason: z.enum(["logout", "inactivity", "finished"]) });

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error("Check the form and try again.");
  return parsed.data;
}

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function flag(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "t";
}

function failureCount(value: unknown): number {
  const count = Number(value);
  if (!Number.isFinite(count) || count < 0) return 0;
  return Math.floor(count);
}

type ClimbRow = {
  id: string;
  child_name: string;
  subject: string;
  level: number | string;
  performance_level: number | string | null;
  correct_at_level: number | string;
  incorrect_streak: number | string;
  grading_failures: number | string | null;
  asked: number | string;
  right_count: number | string;
  age: number | string | null;
  start_grade: number | string | null;
  standard_code: string | null;
  standard_label: string | null;
  standard_step: number | string | null;
  current_prompt: string | null;
  last_feedback: string | null;
  awaiting_next: number | string | boolean | null;
  online_seconds: number | string | null;
  created_at: unknown;
};

async function accountState(sql: Sql, userId: string) {
  if (isSchoolAccountId(userId)) {
    const { readSchoolMirror } = await import("@/lib/school-mirror.server");
    const mirror = await readSchoolMirror(sql, userId);
    const decision = schoolAccessDecision({
      email: accountIdOf(userId),
      access: mirror?.access ?? null,
      freeWeekStart: mirror?.freeWeekStart ?? null,
      lockReason: mirror?.lockReason ?? "",
      emailConfirmed: mirror?.emailConfirmed,
      masterRaw: process.env.VKOLE_MASTER_EMAIL,
    });
    const startedAt = decision.fullAccess
      ? new Date().toISOString()
      : decision.confirmEmail
        ? (mirror?.freeWeekStart ?? new Date().toISOString())
        : (mirror?.freeWeekStart ?? new Date(0).toISOString());
    const trial = trialState(startedAt);
    const office = {
      officePurchased: mirror?.officePurchased === true,
      officeSlug: mirror?.officeSlug ?? null,
    };
    return {
      ...trial,
      expired: decision.expired,
      daysLeft: decision.daysLeft ?? trial.daysLeft,
      endsAt: decision.endsAt ?? trial.endsAt,
      subscribed: decision.subscribed,
      subscriptionEndsAt: null,
      plan: decision.fullAccess || mirror?.access === "open" ? (mirror?.plan ?? null) : null,
      renews: false,
      fullAccess: decision.fullAccess,
      confirmEmail: decision.confirmEmail,
      students: mirror?.students ?? [],
      activeStudent: studentIndexOf(userId),
      ...office,
    };
  }
  const trials = await sql<{ started_at: unknown }>`
    select started_at from app_trials where user_id = ${userId} and subject = 'app'
  `;
  const startedAt = trials[0] ? asIso(trials[0].started_at) : new Date().toISOString();
  const trial = trialState(startedAt);
  const subs = await sql<{ detail: string; expires_at: unknown; renews: boolean | number | string | null }>`
    select detail, expires_at, renews from app_subscriptions
    where user_id = ${userId} and subject = 'app' and detail in ('month', 'year') and expires_at > now()
    order by expires_at desc
    limit 1
  `;
  const sub = subs[0];
  const plan: "month" | "year" | null = sub?.detail === "year" ? "year" : sub?.detail === "month" ? "month" : null;
  return {
    ...trial,
    subscribed: Boolean(sub),
    subscriptionEndsAt: sub ? asIso(sub.expires_at) : null,
    plan,
    renews: sub ? flag(sub.renews) : false,
    officePurchased: false,
    officeSlug: null as string | null,
    fullAccess: false,
    confirmEmail: false,
    students: [] as FamilyStudent[],
    activeStudent: 1,
  };
}

function toClimb(row: ClimbRow, account: Awaited<ReturnType<typeof accountState>>, blocked: boolean): Climb {
  const level = Number(row.level);
  return {
    id: row.id,
    childName: row.child_name,
    subject: isSubject(row.subject) ? row.subject : "gen",
    level,
    performanceLevel: Number(row.performance_level ?? level),
    correctAtLevel: Number(row.correct_at_level),
    incorrectStreak: Number(row.incorrect_streak),
    gradingFailures: failureCount(row.grading_failures),
    asked: Number(row.asked),
    rightCount: Number(row.right_count),
    age: row.age == null ? null : Number(row.age),
    startGrade: row.start_grade == null || row.start_grade === "" ? null : Number(row.start_grade),
    standardCode: row.standard_code ?? "",
    standardLabel: row.standard_label ?? "",
    standardStep: Number(row.standard_step ?? 0),
    currentPrompt: row.current_prompt ?? "",
    lastFeedback: row.last_feedback ?? "",
    awaitingNext: flag(row.awaiting_next),
    onlineSeconds: Number(row.online_seconds ?? 0),
    completedExercises: [],
    blocked,
    ...account,
  };
}

const CLIMB_COLUMNS = `id, child_name, subject, level, performance_level, correct_at_level, incorrect_streak,
  grading_failures, asked, right_count, age, start_grade, standard_code, standard_label, standard_step,
  current_prompt, last_feedback, awaiting_next, online_seconds, created_at`;

function levelTitle(subject: SubjectId, grade: number, step: number): string {
  const name = stepName(subject, grade, step);
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : name;
}

async function finishLoad(sql: Sql, userId: string, row: ClimbRow | undefined): Promise<Climb> {
  if (!row) throw new Error("Session not found.");
  const account = await accountState(sql, userId);
  const access = await childAccess(sql, userId, row.child_name);
  return toClimb(row, account, access !== "open");
}

async function selectOwned(sql: Sql, userId: string, id: string): Promise<Climb> {
  const rows = await sql.query<ClimbRow>(
    `select ${CLIMB_COLUMNS} from climbs where id = $1 and user_id = $2`,
    [id, userId],
  );
  return finishLoad(sql, userId, rows[0]);
}

export async function accountPasswordMatches(sql: Sql, userId: string, password: string): Promise<boolean> {
  if (!isSchoolAccountId(userId)) return false;
  const { SchoolCallError, signInSchoolAccount } = await import("@/lib/school-account.server");
  try {
    const session = await signInSchoolAccount({ email: accountIdOf(userId), password });
    const { saveAccountGrant } = await import("@/lib/school-mirror.server");
    await saveAccountGrant(sql, accountIdOf(userId), { token: session.token, expiresAt: session.expiresAt }).catch(() => undefined);
    return true;
  } catch (err) {
    if (err instanceof SchoolCallError && err.reason !== "offline" && err.reason !== "wait") return false;
    throw err;
  }
}

export const beginSharedTrial = createServerFn({ method: "POST" })
  .middleware([schoolMiddleware])
  .handler(async () => ({ ok: true as const }));

export const listClimbs = createServerFn({ method: "GET" })
  .middleware([schoolMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<ClimbRow>(
      `select ${CLIMB_COLUMNS} from climbs where user_id = $1 order by updated_at desc`,
      [context.userId],
    );
    const account = await accountState(sql, context.userId);
    const climbs: Climb[] = [];
    for (const row of rows) {
      const access = await childAccess(sql, context.userId, row.child_name);
      climbs.push(toClimb(row, account, access !== "open"));
    }
    return {
      climbs,
      endsAt: account.fullAccess ? null : account.endsAt,
      daysLeft: account.fullAccess ? null : account.daysLeft,
      subscribed: account.subscribed,
      plan: account.plan,
      renews: account.renews,
      blocked: account.fullAccess || account.confirmEmail ? false : account.expired && !account.subscribed,
      fullAccess: account.fullAccess,
      confirmEmail: account.confirmEmail === true,
      students: account.students,
      activeStudent: account.activeStudent,
      officePurchased: account.officePurchased,
      officeSlug: account.officeSlug,
    };
  });

function alphabetItemId(questionId: string | null | undefined): string {
  const match = (questionId ?? "").match(/sp:[^:]+:([^:]+)/i);
  return match?.[1] ?? "";
}

let alphabetColumnReady: Promise<void> | null = null;

export async function ensureAlphabetCompletedColumn(sql: Sql): Promise<void> {
  if (!alphabetColumnReady) {
    alphabetColumnReady = sql`alter table climbs add column if not exists alphabet_completed text not null default ''`.then(
      () => undefined,
      (err: unknown) => {
        alphabetColumnReady = null;
        throw err;
      },
    );
  }
  await alphabetColumnReady;
}

async function readAlphabetCompleted(sql: Sql, userId: string, id: string): Promise<number[]> {
  await ensureAlphabetCompletedColumn(sql);
  const rows = await sql<{ alphabet_completed: string | null }>`
    select alphabet_completed from climbs where id = ${id} and user_id = ${userId}
  `;
  return normalizeCompletedExercises(rows[0]?.alphabet_completed);
}

async function writeAlphabetPlace(
  sql: Sql,
  userId: string,
  id: string,
  view: ReturnType<typeof letterView>,
  completed: unknown,
): Promise<void> {
  await ensureAlphabetCompletedColumn(sql);
  await sql`
    update climbs
    set standard_step = ${view.index},
        correct_at_level = ${view.silence},
        incorrect_streak = ${view.wrong},
        standard_code = ${view.band},
        standard_label = ${view.name},
        current_prompt = ${view.show},
        answer_key = ${view.answer},
        answer_aliases = ${JSON.stringify(view.also)},
        answer_note = ${view.name},
        question_id = ${`sp:${view.band}:${view.id}:s${view.silence}:w${view.wrong}`},
        alphabet_completed = ${formatCompletedExercises(completed)},
        updated_at = now()
    where id = ${id} and user_id = ${userId}
  `;
}

/** Repair an old hidden-letter card before the student sees the saved record. Opening still starts at exercise 1. */
async function migratedSpellingClimb(sql: Sql, userId: string, climb: Climb): Promise<Climb> {
  if (climb.subject !== "sp") return climb;
  const rows = await sql<{ question_id: string | null; current_prompt: string | null; standard_step: number | string | null }>`
    select question_id, current_prompt, standard_step
    from climbs
    where id = ${climb.id} and user_id = ${userId}
  `;
  const row = rows[0];
  if (!row) return climb;
  const completed = await readAlphabetCompleted(sql, userId, climb.id);
  const current = Number(row.standard_step ?? climb.standardStep);
  const place = resumeAlphabetPlace({
    index: Number.isInteger(current) ? current : climb.standardStep,
    word: alphabetItemId(row.question_id),
    prompt: row.current_prompt ?? "",
    silence: climb.correctAtLevel,
    wrong: climb.incorrectStreak,
    completedExercises: completed,
  });
  const same = place.index === climb.standardStep && place.silence === climb.correctAtLevel && place.wrong === climb.incorrectStreak;
  if (!same) {
    const view = letterView(place);
    await writeAlphabetPlace(sql, userId, climb.id, view, completed);
    return { ...(await selectOwned(sql, userId, climb.id)), completedExercises: completed };
  }
  return { ...climb, completedExercises: completed };
}

export const getClimb = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(idSchema, data))
  .middleware([schoolMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const climb = await selectOwned(sql, context.userId, data.id);
    return migratedSpellingClimb(sql, context.userId, climb);
  });

export const setChildAge = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(idSchema.extend({ age: z.number().int().min(4).max(18) }), data))
  .middleware([schoolMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`update climbs set age = ${data.age}, updated_at = now() where id = ${data.id} and user_id = ${context.userId}`;
    return selectOwned(sql, context.userId, data.id);
  });

export const setClimbLevel = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    parse(idSchema.extend({ direction: z.enum(["up", "down"]), password: z.string().min(8).max(80) }), data),
  )
  .middleware([schoolMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    if (!(await accountPasswordMatches(sql, context.userId, data.password))) {
      throw new Error("That is not the password for the account that registered.");
    }
    const current = await selectOwned(sql, context.userId, data.id);
    const held = capVkoleGrade(current.level);
    const level = capVkoleGrade(current.level + (data.direction === "up" ? 1 : -1));
    if (current.subject === "sp") {
      const kept = level === held && data.direction === "up";
      const view = letterView({ index: kept ? current.standardStep : 0, silence: 0, wrong: 0 });
      await sql`
        update climbs
        set level = ${level},
            standard_step = ${view.index},
            correct_at_level = 0,
            incorrect_streak = 0,
            standard_code = ${view.band},
            standard_label = ${view.name},
            current_prompt = ${view.show},
            answer_key = ${view.answer},
            answer_aliases = ${JSON.stringify(view.also)},
            answer_note = ${view.name},
            question_id = ${`sp:${view.band}:${view.id}:s0:w0`},
            next_prompt = '',
            awaiting_next = 0,
            updated_at = now()
        where id = ${data.id} and user_id = ${context.userId}
      `;
      await rememberPrompt(sql, context.userId, current.childName, practicePromptText("sp", { letter: view.letter }));
      return selectOwned(sql, context.userId, data.id);
    }
    if (current.subject === "pa") {
      const heldCard =
        level === held && data.direction === "up"
          ? paCardFromAccount(
              { grade: held, age: current.age, band: current.standardCode, index: current.standardStep },
              held,
            )
          : paCardFromAccount({ grade: level, age: current.age }, level);
      await sql`
        update climbs
        set level = ${level},
            standard_step = ${heldCard.index},
            correct_at_level = 0,
            incorrect_streak = 0,
            standard_code = ${heldCard.band},
            standard_label = ${heldCard.name},
            current_prompt = ${heldCard.say},
            answer_key = ${heldCard.answer},
            answer_aliases = ${JSON.stringify(heldCard.also)},
            answer_note = ${heldCard.name},
            question_id = ${`pa:${heldCard.band}:${heldCard.index}`},
            next_prompt = '',
            awaiting_next = 0,
            updated_at = now()
        where id = ${data.id} and user_id = ${context.userId}
      `;
      await rememberPrompt(sql, context.userId, current.childName, practicePromptText("pa", { say: heldCard.say }));
      return selectOwned(sql, context.userId, data.id);
    }
    if (current.subject === "sw") {
      const card =
        level === held && data.direction === "up"
          ? cardFromAccount({ grade: held, band: current.standardCode, index: current.standardStep }, held)
          : startCard(level);
      await sql`
        update climbs
        set level = ${level},
            standard_step = ${card.index},
            correct_at_level = 0,
            incorrect_streak = 0,
            standard_code = ${card.band},
            standard_label = ${card.label},
            current_prompt = ${card.word},
            answer_key = ${card.word},
            answer_aliases = ${JSON.stringify(card.also)},
            answer_note = ${card.label},
            question_id = ${`sw:${card.band}:${card.index}`},
            next_prompt = '',
            awaiting_next = 0,
            updated_at = now()
        where id = ${data.id} and user_id = ${context.userId}
      `;
      await rememberPrompt(sql, context.userId, current.childName, practicePromptText("sw", { word: card.word }));
      return selectOwned(sql, context.userId, data.id);
    }
    const step = level === held && data.direction === "up" ? Math.min(2, Math.max(0, current.standardStep ?? 0)) : 0;
    const item = await dealQuestion(sql, context.userId, current.childName, current.subject, level, step);
    await sql`
      update climbs
      set level = ${level},
          standard_step = ${step},
          correct_at_level = 0,
          incorrect_streak = 0,
          standard_code = ${item.standard},
          standard_label = ${item.note},
          current_prompt = ${item.stem},
          answer_key = ${item.answer},
          answer_aliases = ${JSON.stringify(item.aliases)},
          answer_note = ${item.note},
          question_id = ${item.id},
          next_prompt = '',
          awaiting_next = 0,
          updated_at = now()
      where id = ${data.id} and user_id = ${context.userId}
    `;
    return selectOwned(sql, context.userId, data.id);
  });

export const recordAnswer = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(answerSchema, data))
  .middleware([schoolMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const current = await selectOwned(sql, context.userId, data.id);
    if (current.subject === "sw") throw new Error("Sight words are marked from the microphone.");
    if (current.subject === "sp") throw new Error("Alphabet is marked from the microphone.");
    if (current.subject === "pa") throw new Error("Phonemic awareness is marked from the microphone.");
    if (current.blocked) throw new Error("This app needs a parent subscription before the child can continue.");
    if (current.awaitingNext) return { status: "saved" as const, climb: current };
    const keyed = await keyedAnswer(sql, context.userId, data.id);
    const recentRows = await recentQuestions(sql, context.userId, current.childName, RECENT_WINDOW);
    const recent = recentRows.map((row) => row.text).filter(Boolean);
    let correct = false;
    let modelFeedback = "";
    let modelPrompt = "";
    let modelCode = current.standardCode;
    let modelLabel = current.standardLabel;
    if (keyed) {
      correct = answersMatch(keyed.answer, data.answer, keyed.aliases);
      modelFeedback = keyedFeedback(keyed.answer, keyed.note);
    } else {
      const instruction = cycleInstruction({
        subject: current.subject,
        startGrade: current.startGrade ?? clampStoredGrade(current.level),
        grade: Math.min(12, clampStoredGrade(current.level)),
        code: current.standardCode,
        label: current.standardLabel,
        correctStreak: current.correctAtLevel,
        incorrectStreak: current.incorrectStreak,
        question: current.currentPrompt,
        answer: data.answer,
        recentPrompts: recent,
      });
      let call = await requestCycle(instruction);
      if (call.outcome === "absent") call = await requestCycle(instruction);
      const settled = settleGradingCall(
        call.outcome,
        call.outcome === "graded" ? call.reply.correct : null,
        current.gradingFailures,
      );
      if (settled.action !== "score") {
        await sql`
          update climbs
          set grading_failures = ${settled.failures}, updated_at = now()
          where id = ${data.id} and user_id = ${context.userId}
        `;
        return { status: settled.action, climb: { ...current, gradingFailures: settled.failures } };
      }
      const heldGrade = capVkoleGrade(current.level);
      const reply =
        call.outcome === "graded"
          ? call.reply
          : unreadableReply({
              grade: heldGrade,
              code: current.standardCode,
              label: current.standardLabel,
              nextPrompt: "",
            });
      correct = reply.correct;
      modelFeedback = reply.feedback;
      modelPrompt = reply.nextPrompt;
      modelCode = reply.code;
      modelLabel = reply.label;
    }
    const beforeGrade = capVkoleGrade(current.level);
    const beforeStep = current.standardStep ?? 0;
    const moved = moveRung({
      grade: beforeGrade,
      step: beforeStep,
      correct,
      correctStreak: current.correctAtLevel,
      missStreak: current.incorrectStreak,
    });
    const reached = correct;
    const pool = await dealQuestion(sql, context.userId, current.childName, current.subject, moved.grade, moved.step);
    const visible = questionTheChildCanSee(modelPrompt, current.subject, moved.grade);
    const chosen = chooseNext({
      modelPrompt: visible?.prompt ?? modelPrompt,
      recent,
      pool,
      preferPool: true,
    });
    const nextPrompt = chosen.fromPool ? pool.stem : chosen.prompt;
    const nextCode = chosen.fromPool ? pool.standard : visible?.code || modelCode;
    const nextLabel = chosen.fromPool ? pool.note : visible?.label || modelLabel;
    const nextAnswer = chosen.fromPool ? pool.answer : "";
    const nextAliases = chosen.fromPool ? JSON.stringify(pool.aliases) : "[]";
    const nextNote = chosen.fromPool ? pool.note : "";
    const nextId = chosen.fromPool ? pool.id : "";
    const earnedMove = moved.grade > beforeGrade ? 1 : moved.grade < beforeGrade ? -1 : 0;
    const performanceLevel = capVkoleGrade(current.performanceLevel + earnedMove);
    const note = stepSentence(current.subject, beforeGrade, beforeStep, { ...moved, reached });
    const feedback = modelFeedback ? (modelFeedback.includes(note) ? modelFeedback : `${modelFeedback}\n\n${note}`) : note;
    await sql`
      update climbs
      set level = ${moved.grade},
          performance_level = ${performanceLevel},
          correct_at_level = ${moved.correctAtLevel},
          incorrect_streak = ${moved.incorrectStreak},
          grading_failures = 0,
          standard_step = ${moved.step},
          asked = ${current.asked + 1},
          right_count = ${current.rightCount + (reached ? 1 : 0)},
          standard_code = ${nextCode},
          standard_label = ${nextLabel},
          next_prompt = ${nextPrompt},
          answer_key = ${nextAnswer},
          answer_aliases = ${nextAliases},
          answer_note = ${nextNote},
          question_id = ${nextId},
          last_feedback = ${feedback},
          awaiting_next = 1,
          updated_at = now()
      where id = ${data.id} and user_id = ${context.userId}
    `;
    await sql`
      insert into climb_events (id, climb_id, user_id, subject, child_name, age, correct, level_before, level_after, detail)
      values (
        ${crypto.randomUUID()}, ${data.id}, ${context.userId}, ${current.subject}, ${current.childName},
        ${current.age}, ${reached}, ${current.level}, ${moved.grade},
        ${JSON.stringify({
          correct: reached,
          engine: `VKOLE/${subjectMeta(current.subject).code}`,
          code: current.standardCode,
          label: levelTitle(current.subject, beforeGrade, beforeStep),
          grade: String(beforeGrade),
          stepBefore: beforeStep,
          stepAfter: moved.step,
          question: current.currentPrompt,
          answer: data.answer.trim() || "(blank)",
          note,
        })}
      )
    `;
    if (!keyed?.id && current.currentPrompt) await rememberPrompt(sql, context.userId, current.childName, current.currentPrompt);
    return { status: "saved" as const, climb: await selectOwned(sql, context.userId, data.id) };
  });

const sightSchema = idSchema.extend({ outcome: z.enum(["correct", "miss", "timeout"]) });

export const markSightWord = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(sightSchema, data))
  .middleware([schoolMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const current = await selectOwned(sql, context.userId, data.id);
    if (current.subject !== "sw") throw new Error("This session is not sight words.");
    if (current.blocked) throw new Error("This app needs a parent subscription before the child can continue.");
    const place = cardFromAccount(
      {
        grade: current.level,
        band: isSightBand(current.standardCode) ? current.standardCode : current.standardCode,
        index: current.standardStep,
      },
      current.level,
    );
    const word = current.currentPrompt.trim() || place.word;
    const next = nextCard(place.band, place.index, current.level);
    const correct = data.outcome === "correct";
    const earned = capVkoleGrade(Math.max(current.performanceLevel, current.level));
    const note =
      data.outcome === "correct"
        ? "Read."
        : data.outcome === "timeout"
          ? "No answer within 20 seconds."
          : "Miss.";
    await sql`
      update climbs
      set level = ${current.level},
          performance_level = ${earned},
          correct_at_level = 0,
          incorrect_streak = 0,
          grading_failures = 0,
          standard_step = ${next.index},
          asked = ${current.asked + 1},
          right_count = ${current.rightCount + (correct ? 1 : 0)},
          standard_code = ${next.band},
          standard_label = ${next.label},
          current_prompt = ${next.word},
          answer_key = ${next.word},
          answer_aliases = ${JSON.stringify(next.also)},
          answer_note = ${next.label},
          question_id = ${`sw:${next.band}:${next.index}`},
          next_prompt = '',
          last_feedback = ${note},
          awaiting_next = 0,
          updated_at = now()
      where id = ${data.id} and user_id = ${context.userId}
    `;
    await sql`
      insert into climb_events (id, climb_id, user_id, subject, child_name, age, correct, level_before, level_after, detail)
      values (
        ${crypto.randomUUID()}, ${data.id}, ${context.userId}, ${current.subject}, ${current.childName},
        ${current.age}, ${correct}, ${current.level}, ${current.level},
        ${JSON.stringify({
          correct,
          engine: "VKOLE/SW",
          code: place.band,
          label: place.label,
          grade: String(place.grade),
          word,
          outcome: data.outcome,
          question: word,
          answer: data.outcome === "correct" ? "read" : data.outcome === "timeout" ? "no answer" : "miss",
          note,
        })}
      )
    `;
    await rememberPrompt(sql, context.userId, current.childName, practicePromptText("sw", { word }));
    await rememberPrompt(sql, context.userId, current.childName, practicePromptText("sw", { word: next.word }));
    return selectOwned(sql, context.userId, data.id);
  });

const spellingSchema = idSchema.extend({ outcome: z.enum(["correct", "miss", "timeout"]) });

/** The song opens the next exercise in order. It never opens the old hidden-letter prompt. */
export const placeSpellingAfterSong = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(idSchema, data))
  .middleware([schoolMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const current = await migratedSpellingClimb(sql, context.userId, await selectOwned(sql, context.userId, data.id));
    if (current.subject !== "sp") throw new Error("This session is not alphabet.");
    if (current.blocked) throw new Error("This app needs a parent subscription before the child can continue.");
    const before = normalizeLetterProgress({
      index: current.standardStep,
      silence: current.correctAtLevel,
      wrong: current.incorrectStreak,
    });
    const askedNow = letterView(before);
    const after = progressAfterSong({
      ...before,
      word: askedNow.id,
      prompt: current.currentPrompt,
      completedExercises: current.completedExercises,
    });
    if (after.index === before.index && after.silence === before.silence && after.wrong === before.wrong) {
      const saved = await selectOwned(sql, context.userId, data.id);
      return { ...saved, completedExercises: current.completedExercises };
    }
    const next = letterView(after);
    await sql`
      update climbs
      set correct_at_level = ${next.silence},
          incorrect_streak = ${next.wrong},
          standard_step = ${next.index},
          standard_code = ${next.band},
          standard_label = ${next.name},
          current_prompt = ${next.show},
          answer_key = ${next.answer},
          answer_aliases = ${JSON.stringify(next.also)},
          answer_note = ${next.name},
          question_id = ${`sp:${next.band}:${next.id}:s${next.silence}:w${next.wrong}`},
          next_prompt = '',
          last_feedback = ${"The alphabet is on the screen."},
          awaiting_next = 0,
          updated_at = now()
      where id = ${data.id} and user_id = ${context.userId}
    `;
    const saved = await selectOwned(sql, context.userId, data.id);
    return { ...saved, completedExercises: current.completedExercises };
  });

/** A numbered button opens that exercise. Exercise 1 is the song and has no card. */
export const placeSpellingExercise = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    parse(idSchema.extend({ exercise: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]) }), data),
  )
  .middleware([schoolMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const current = await migratedSpellingClimb(sql, context.userId, await selectOwned(sql, context.userId, data.id));
    if (current.subject !== "sp") throw new Error("This session is not alphabet.");
    if (current.blocked) throw new Error("This app needs a parent subscription before the child can continue.");
    const place = jumpToExercise(data.exercise);
    if (!place) return current;
    const view = letterView(place);
    await writeAlphabetPlace(sql, context.userId, data.id, view, current.completedExercises);
    const saved = await selectOwned(sql, context.userId, data.id);
    return { ...saved, completedExercises: current.completedExercises };
  });

export const markSpelling = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(spellingSchema, data))
  .middleware([schoolMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const current = await migratedSpellingClimb(sql, context.userId, await selectOwned(sql, context.userId, data.id));
    if (current.subject !== "sp") throw new Error("This session is not alphabet.");
    if (current.blocked) throw new Error("This app needs a parent subscription before the child can continue.");
    const before = normalizeLetterProgress({
      index: current.standardStep,
      silence: current.correctAtLevel,
      wrong: current.incorrectStreak,
    });
    const asked = letterView(before);
    const correct = data.outcome === "correct";
    const after = applyLetterAnswer(before, data.outcome);
    const next = letterView(after);
    const completed = noteExerciseCompletion(
      before.index,
      after.index,
      current.completedExercises,
      correct && letterExercise(before.index) === 5,
    );
    const earned = capVkoleGrade(Math.max(current.performanceLevel, current.level));
    const note = letterMoveNote(before, data.outcome, after);
    await sql`
      update climbs
      set level = ${current.level},
          performance_level = ${earned},
          correct_at_level = ${next.silence},
          incorrect_streak = ${next.wrong},
          grading_failures = 0,
          standard_step = ${next.index},
          asked = ${current.asked + 1},
          right_count = ${current.rightCount + (correct ? 1 : 0)},
          standard_code = ${next.band},
          standard_label = ${next.name},
          current_prompt = ${next.show},
          answer_key = ${next.answer},
          answer_aliases = ${JSON.stringify(next.also)},
          answer_note = ${next.name},
          question_id = ${`sp:${next.band}:${next.id}:s${next.silence}:w${next.wrong}`},
          alphabet_completed = ${formatCompletedExercises(completed)},
          next_prompt = '',
          last_feedback = ${note},
          awaiting_next = 0,
          updated_at = now()
      where id = ${data.id} and user_id = ${context.userId}
    `;
    await sql`
      insert into climb_events (id, climb_id, user_id, subject, child_name, age, correct, level_before, level_after, detail)
      values (
        ${crypto.randomUUID()}, ${data.id}, ${context.userId}, ${current.subject}, ${current.childName},
        ${current.age}, ${correct}, ${current.level}, ${current.level},
        ${JSON.stringify({
          correct,
          engine: `VKOLE/${subjectMeta(current.subject).code}`,
          code: asked.band,
          label: asked.name,
          grade: String(current.level),
          question: asked.kind === "cue" ? asked.show : asked.say,
          answer: data.outcome === "correct" ? "heard" : data.outcome === "timeout" ? "no answer" : "not yet",
          note,
          letter: asked.answer,
          outcome: data.outcome,
        })}
      )
    `;
    await rememberPrompt(sql, context.userId, current.childName, practicePromptText("sp", { letter: asked.letter }));
    await rememberPrompt(sql, context.userId, current.childName, practicePromptText("sp", { letter: next.letter }));
    const saved = await selectOwned(sql, context.userId, data.id);
    return { ...saved, completedExercises: completed };
  });

const paSchema = idSchema.extend({ outcome: z.enum(["correct", "miss", "timeout"]) });

export const markPhonemic = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(paSchema, data))
  .middleware([schoolMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const current = await selectOwned(sql, context.userId, data.id);
    if (current.subject !== "pa") throw new Error("This session is not phonemic awareness.");
    if (current.blocked) throw new Error("This app needs a parent subscription before the child can continue.");
    const place = paCardFromAccount(
      {
        grade: current.level,
        age: current.age,
        band: migratePaBand(current.standardCode),
        index: current.standardStep,
      },
      current.level,
    );
    const correct = data.outcome === "correct";
    const moved = nextAfterAnswer(
      {
        band: place.band,
        index: place.index,
        grade: current.level,
        correctStreak: current.correctAtLevel,
        missStreak: current.incorrectStreak,
      },
      correct,
    );
    const next = paCardFromAccount(
      { grade: current.level, band: moved.band, index: moved.index },
      current.level,
    );
    const prompt = paPrompt(next.band, next.index, current.level);
    const earned = capVkoleGrade(Math.max(current.performanceLevel, current.level));
    const note =
      data.outcome === "correct"
        ? moved.move === "up"
          ? "Heard. The next prompt is one band up."
          : "Heard."
        : data.outcome === "timeout"
          ? moved.move === "down"
            ? "No answer within 20 seconds. The next prompt is one band down."
            : "No answer within 20 seconds."
          : moved.move === "down"
            ? "Not yet. The next prompt is one band down."
            : "Not yet.";
    await sql`
      update climbs
      set level = ${current.level},
          performance_level = ${earned},
          correct_at_level = ${moved.correctStreak},
          incorrect_streak = ${moved.missStreak},
          grading_failures = 0,
          standard_step = ${next.index},
          asked = ${current.asked + 1},
          right_count = ${current.rightCount + (correct ? 1 : 0)},
          standard_code = ${next.band},
          standard_label = ${next.name},
          current_prompt = ${prompt.stem},
          answer_key = ${prompt.answer},
          answer_aliases = ${JSON.stringify(prompt.aliases)},
          answer_note = ${prompt.note},
          question_id = ${prompt.id},
          next_prompt = '',
          last_feedback = ${note},
          awaiting_next = 0,
          updated_at = now()
      where id = ${data.id} and user_id = ${context.userId}
    `;
    await sql`
      insert into climb_events (id, climb_id, user_id, subject, child_name, age, correct, level_before, level_after, detail)
      values (
        ${crypto.randomUUID()}, ${data.id}, ${context.userId}, ${current.subject}, ${current.childName},
        ${current.age}, ${correct}, ${current.level}, ${current.level},
        ${JSON.stringify({
          correct,
          engine: "VKOLE/PA",
          code: place.band,
          label: place.name,
          grade: String(current.level),
          question: place.say,
          answer: data.outcome === "correct" ? "heard" : data.outcome === "timeout" ? "no answer" : "not yet",
          note,
        })}
      )
    `;
    await rememberPrompt(sql, context.userId, current.childName, practicePromptText("pa", { say: place.say }));
    await rememberPrompt(sql, context.userId, current.childName, practicePromptText("pa", { say: prompt.stem }));
    return selectOwned(sql, context.userId, data.id);
  });

export const revealNextQuestion = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(idSchema, data))
  .middleware([schoolMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const current = await selectOwned(sql, context.userId, data.id);
    if (current.subject === "sw" || current.subject === "sp" || current.subject === "pa") return selectOwned(sql, context.userId, data.id);
    const prompt = current.awaitingNext ? "" : current.currentPrompt;
    const rows = await sql<{ next_prompt: string | null }>`select next_prompt from climbs where id = ${data.id} and user_id = ${context.userId}`;
    const saved = rows[0]?.next_prompt?.trim() || prompt;
    if (saved) {
      await sql`
        update climbs
        set current_prompt = ${saved},
            next_prompt = '',
            awaiting_next = 0,
            updated_at = now()
        where id = ${data.id} and user_id = ${context.userId}
      `;
    } else {
      const item = await dealQuestion(sql, context.userId, current.childName, current.subject, current.level, current.standardStep);
      await sql`
        update climbs
        set current_prompt = ${item.stem},
            standard_code = ${item.standard},
            standard_label = ${item.note},
            answer_key = ${item.answer},
            answer_aliases = ${JSON.stringify(item.aliases)},
            answer_note = ${item.note},
            question_id = ${item.id},
            next_prompt = '',
            awaiting_next = 0,
            updated_at = now()
        where id = ${data.id} and user_id = ${context.userId}
      `;
    }
    return selectOwned(sql, context.userId, data.id);
  });

async function parentEmail(sql: Sql, userId: string): Promise<string | null> {
  const id = accountIdOf(userId);
  const rows = await sql.query<{ email: string }>('select "email" from "user" where "id" = $1', [id]);
  return rows[0]?.email?.trim() || (id.includes("@") ? id : null);
}

async function registrationFacts(sql: Sql, userId: string, childName: string) {
  await sql`alter table climbs add column if not exists registration_email text`;
  const account = await parentEmail(sql, userId);
  const rows = await sql<{ registered_at: unknown; top: number | string | null }>`
    select min(created_at) as registered_at, max(level) as top
    from climbs
    where user_id = ${userId} and lower(child_name) = lower(${childName})
  `;
  const saved = await sql<{ email: string }>`
    select registration_email as email
    from climbs
    where user_id = ${userId}
      and lower(child_name) = lower(${childName})
      and registration_email is not null
      and registration_email <> ''
    order by created_at asc
    limit 1
  `;
  let email = saved[0]?.email?.trim() || "";
  if (!email && account) {
    email = account;
    await sql`
      update climbs set registration_email = ${email}
      where user_id = ${userId}
        and lower(child_name) = lower(${childName})
        and (registration_email is null or registration_email = '')
    `;
  }
  return {
    email,
    registeredAt: rows[0]?.registered_at ? asIso(rows[0].registered_at) : new Date().toISOString(),
    top: Number(rows[0]?.top ?? 1),
  };
}

type SittingRow = { id: string; started_at: unknown; last_seen_at: unknown };

async function openSitting(sql: Sql, userId: string, climbId: string) {
  const rows = await sql<SittingRow>`
    select id, started_at, last_seen_at from climb_sittings
    where climb_id = ${climbId} and user_id = ${userId} and ended_at is null
    order by started_at desc limit 1
  `;
  return rows[0] ?? null;
}

function sittingSeconds(row: SittingRow, reason: EndReason): number {
  const started = new Date(asIso(row.started_at)).getTime();
  const seen = new Date(asIso(row.last_seen_at)).getTime();
  const until = reason === "inactivity" ? Math.min(seen, Date.now() - IDLE_MS) : Date.now();
  return Math.max(0, Math.round((until - started) / 1000));
}

function stepBeforeOf(detail: string): number | null {
  try {
    const row = JSON.parse(detail) as { stepBefore?: unknown };
    const step = Number(row.stepBefore);
    return Number.isInteger(step) ? step : null;
  } catch {
    return null;
  }
}

async function closeSitting(sql: Sql, userId: string, climbId: string, reason: EndReason) {
  const open = await openSitting(sql, userId, climbId);
  if (!open) return null;
  const seconds = sittingSeconds(open, reason);
  const ended = await sql<{ id: string }>`
    update climb_sittings
    set ended_at = now(), end_reason = ${reason}, seconds = ${seconds}
    where id = ${open.id} and user_id = ${userId} and ended_at is null
    returning id
  `;
  if (!ended[0]) return null;
  await sql`
    update climbs set online_seconds = online_seconds + ${seconds}, updated_at = now()
    where id = ${climbId} and user_id = ${userId}
  `;
  return { sittingId: open.id, seconds, startedAt: asIso(open.started_at) };
}

async function singaporeMastery(sql: Sql, userId: string, climbId: string, subject: string): Promise<string> {
  if (subject !== "sg") return "";
  const rows = await sql<{ detail: string; correct: boolean | number | string | null }>`
    select detail, correct from climb_events
    where climb_id = ${climbId} and user_id = ${userId}
    order by created_at asc
  `;
  return formatMasteryReport(
    masteryFromDetails(
      rows.map((row) => ({
        detail: row.detail,
        correct: row.correct === true || row.correct === 1 || row.correct === "1" || row.correct === "t",
      })),
    ),
  );
}

async function deliverLetter(sql: Sql, userId: string, climbId: string, reason: EndReason, sittingSecondsValue: number, startedAt: string) {
  const climb = await selectOwned(sql, userId, climbId);
  const facts = await registrationFacts(sql, userId, climb.childName);
  const events = await sql<{ created_at: unknown; detail: string; level_after: number | string; level_before: number | string; correct: boolean | number | string }>`
    select created_at, detail, level_after, level_before, correct from climb_events
    where climb_id = ${climbId} and user_id = ${userId} and created_at >= ${startedAt}
    order by created_at asc limit 40
  `;
  const reportEvents: ReportEvent[] = events.map((event) => ({
    at: asIso(event.created_at),
    detail: event.detail,
    levelAfter: Number(event.level_after),
    correct: flag(event.correct),
  }));
  const before = events[0] ? Number(events[0].level_before) : climb.level;
  const startStep = events[0] ? stepBeforeOf(events[0].detail) : null;
  const startPos = before * 3 + (startStep ?? 0);
  const nowPos = climb.level * 3 + (climb.standardStep ?? 0);
  const moved =
    startStep == null
      ? climb.level > before
        ? "up"
        : climb.level < before
          ? "down"
          : null
      : nowPos > startPos
        ? "up"
        : nowPos < startPos
          ? "down"
          : null;
  const used = await seenKeys(sql, userId, climb.childName);
  const built = fillSheet(Math.max(1, facts.top), used);
  const empty = {
    sent: false,
    recipient: facts.email,
    reason,
    sittingSeconds: sittingSecondsValue,
    totalSeconds: climb.onlineSeconds,
    subject: "",
    body: "",
    error: "",
    sheetNote: "",
    sheetKeys: [] as string[],
    spellingReport: "",
  };
  let spellingReport = "";
  if (climb.subject === "sp") {
    await sql`alter table climb_sittings add column if not exists spelling_report text`;
    const savedRows = await sql<{ spelling_report: string | null }>`
      select spelling_report from climb_sittings
      where climb_id = ${climbId} and user_id = ${userId} and ended_at is null
      order by started_at desc limit 1
    `;
    const saved = savedSpellingReport(savedRows[0]?.spelling_report);
    if (saved) {
      spellingReport = saved;
    } else {
      const written = await writeSpellingReport(spellingStatsFromEvents(reportEvents));
      spellingReport = written.text;
      await sql`
        update climb_sittings set spelling_report = ${spellingReport}
        where climb_id = ${climbId} and user_id = ${userId} and ended_at is null
      `;
    }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(facts.email)) {
    return { ...empty, error: "The registration email is not a working address.", spellingReport };
  }
  const mastery = await singaporeMastery(sql, userId, climbId, climb.subject);
  const reportLabel = climb.subject === "sp" || climb.subject === "pa" ? climb.standardLabel : levelTitle(climb.subject, climb.level, climb.standardStep);
  const letter = academicLetter({
    firstName: climb.childName,
    age: climb.age ?? 0,
    subject: climb.subject,
    level: climb.level,
    mastery,
    performanceLevel: climb.performanceLevel,
    startGrade: climb.startGrade,
    standardCode: climb.standardCode,
    standardLabel: reportLabel,
    asked: reportEvents.length,
    rightCount: reportEvents.filter((event) => event.correct).length,
    parentEmail: facts.email,
    registeredAt: facts.registeredAt,
    moved: climb.subject === "sp" || climb.subject === "pa" ? null : moved,
    sheet: built?.prompts,
    trial: { startedAt: climb.startedAt, endsAt: climb.endsAt, daysLeft: climb.daysLeft, expired: climb.expired },
    events: reportEvents,
    session: { reason, sittingSeconds: sittingSecondsValue, totalSeconds: climb.onlineSeconds },
    spellingReport,
  });
  try {
    const { postSessionEndReport } = await import("@/lib/session-report.server");
    await postSessionEndReport(
      {
        name: climb.childName,
        email: facts.email,
        engine: `VKOLE/${subjectMeta(climb.subject).code}`,
        subject: climb.subject,
        startedAt: Date.parse(startedAt),
        untimed: true,
        startingGrade: climb.startGrade ?? climb.level,
        grade: climb.level,
        code: climb.standardCode,
        label: reportLabel,
        reached: reportEvents.filter((event) => event.correct).length,
        missed: reportEvents.filter((event) => !event.correct).length,
        trialEndsAt: Date.parse(climb.endsAt),
        lines: reportEvents.map((event) => reportLine(event)),
        sheet: climb.subject === "gen" ? (built?.prompts ?? []) : [],
        ...(climb.subject === "sg" && mastery ? { masteryText: mastery } : {}),
      },
      { userId },
    );
  } catch {
    /* The progress letter still sends if the website report is refused. */
  }
  let sent = false;
  let error = "";
  try {
    const { sendAcademicMail } = await import("@/lib/assignment-mail");
    const result = await sendAcademicMail(letter.recipient, letter.subject, letter.body, [], letter.html);
    sent = result.ok;
    if (!result.ok) {
      const raw = result.errorMessage ?? "";
      error = /connector|gate|token|not connected|none/i.test(raw)
        ? "The report is written. Mail is not connected on this server yet, so it was not sent."
        : "The report was not sent. Try again when the sitting ends.";
    }
  } catch {
    error = "The report was not sent. Try again when the sitting ends.";
  }
  if (sent) {
    await sql`
      insert into academic_mail (id, user_id, climb_id, recipient, subject, body, end_reason, sent_at, send_error)
      values (${crypto.randomUUID()}, ${userId}, ${climbId}, ${letter.recipient}, ${letter.subject}, ${letter.body}, ${reason}, now(), ${""})
    `;
  }
  return {
    ...empty,
    sent,
    recipient: letter.recipient,
    subject: letter.subject,
    body: letter.body,
    error,
    sheetNote: built ? "" : "The level stays. The assignment should be tried again.",
    sheetKeys: built?.prompts ?? [],
    spellingReport,
  };
}

export const beginSitting = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(idSchema, data))
  .middleware([schoolMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const stale = await openSitting(sql, context.userId, data.id);
    if (stale) {
      await sql`update climb_sittings set last_seen_at = now() where id = ${stale.id} and user_id = ${context.userId}`;
      return { sittingId: stale.id, startedAt: asIso(stale.started_at), resumed: true };
    }
    const id = crypto.randomUUID();
    await sql`insert into climb_sittings (id, climb_id, user_id) values (${id}, ${data.id}, ${context.userId})`;
    return { sittingId: id, startedAt: new Date().toISOString(), resumed: false };
  });

export const touchSitting = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(idSchema, data))
  .middleware([schoolMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      update climb_sittings set last_seen_at = now()
      where climb_id = ${data.id} and user_id = ${context.userId} and ended_at is null
    `;
    return { ok: true };
  });

export const endChildSession = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(endSchema, data))
  .middleware([schoolMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const climb = await selectOwned(sql, context.userId, data.id);
    await sql`alter table climb_sittings add column if not exists letter_sent integer not null default 0`;
    const { disarmStudentClock } = await import("@/lib/day-clock");
    if (data.reason === "inactivity") await disarmStudentClock(sql, context.userId, data.id);
    const open = await openSitting(sql, context.userId, data.id);
    if (!open) {
      return { sent: false, recipient: "", reason: data.reason, sittingSeconds: 0, totalSeconds: 0, subject: "", body: "", error: "", sheetNote: "", spellingReport: "", alreadyClosed: true as const };
    }
    const checked = await sql<{ n: number | string }>`
      select count(*) as n from climb_events
      where climb_id = ${data.id} and user_id = ${context.userId} and created_at >= ${asIso(open.started_at)}
    `;
    if (!finishSendsReport(data.reason, Number(checked[0]?.n ?? 0))) {
      const closed = await closeSitting(sql, context.userId, data.id, data.reason);
      return { sent: false, recipient: "", reason: data.reason, sittingSeconds: closed?.seconds ?? 0, totalSeconds: climb.onlineSeconds + (closed?.seconds ?? 0), subject: "", body: "", error: "", sheetNote: "", spellingReport: "", alreadyClosed: false as const };
    }
    const claim = await sql<{ id: string }>`
      update climb_sittings set letter_sent = 1
      where id = ${open.id} and user_id = ${context.userId} and ended_at is null and letter_sent = 0
      returning id
    `;
    if (!claim[0]) {
      return { sent: false, recipient: "", reason: data.reason, sittingSeconds: 0, totalSeconds: 0, subject: "", body: "", error: "", sheetNote: "", spellingReport: "", alreadyClosed: true as const };
    }
    const mail = await deliverLetter(sql, context.userId, data.id, data.reason, sittingSeconds(open, data.reason), asIso(open.started_at));
    if (!mail.sent) {
      await sql`update climb_sittings set letter_sent = 0 where id = ${open.id} and user_id = ${context.userId} and ended_at is null`;
      return { ...mail, alreadyClosed: false as const };
    }
    for (const prompt of mail.sheetKeys) await rememberPrompt(sql, context.userId, (await selectOwned(sql, context.userId, data.id)).childName, prompt);
    await closeSitting(sql, context.userId, data.id, data.reason);
    return { ...mail, alreadyClosed: false as const };
  });

export const academicReport = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(idSchema, data))
  .middleware([schoolMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const climb = await selectOwned(sql, context.userId, data.id);
    const facts = await registrationFacts(sql, context.userId, climb.childName);
    const events = await sql<{ created_at: unknown; detail: string; level_after: number | string; correct: boolean | number | string }>`
      select created_at, detail, level_after, correct from climb_events
      where climb_id = ${data.id} and user_id = ${context.userId}
      order by created_at asc limit 40
    `;
    return academicLetter({
      firstName: climb.childName,
      age: climb.age ?? 0,
      subject: climb.subject,
      level: climb.level,
      mastery: await singaporeMastery(sql, context.userId, data.id, climb.subject),
      performanceLevel: climb.performanceLevel,
      startGrade: climb.startGrade,
      standardCode: climb.standardCode,
      standardLabel: climb.subject === "sp" || climb.subject === "pa" ? climb.standardLabel : levelTitle(climb.subject, climb.level, climb.standardStep),
      asked: climb.asked,
      rightCount: climb.rightCount,
      parentEmail: facts.email,
      registeredAt: facts.registeredAt,
      trial: { startedAt: climb.startedAt, endsAt: climb.endsAt, daysLeft: climb.daysLeft, expired: climb.expired },
      events: events.map((event) => ({ at: asIso(event.created_at), detail: event.detail, levelAfter: Number(event.level_after), correct: flag(event.correct) })),
    });
  });

async function appsForChild(sql: Sql, userId: string, childName: string): Promise<AppTime[]> {
  const rows = await sql<{ subject: string; level: number | string; performance_level: number | string | null; online_seconds: number | string; sittings: number | string }>`
    select c.subject, c.level, c.performance_level, c.online_seconds,
           (select count(*) from climb_sittings s where s.climb_id = c.id) as sittings
    from climbs c
    where c.user_id = ${userId} and lower(c.child_name) = lower(${childName})
  `;
  const bySubject = new Map(rows.map((row) => [row.subject, row]));
  return SUBJECTS.map((program) => {
    const row = bySubject.get(program.id);
    return {
      subject: program.id,
      level: row ? Number(row.level) : null,
      earnedLevel: row ? Number(row.performance_level ?? row.level) : null,
      onlineSeconds: Number(row?.online_seconds ?? 0),
      loggedIn: Number(row?.sittings ?? 0) > 0 || Number(row?.online_seconds ?? 0) > 0,
    };
  });
}

export const notifyParentSignedOut = createServerFn({ method: "POST" })
  .middleware([schoolMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const parents = await sql.query<{ name: string; email: string }>('select "name", "email" from "user" where "id" = $1', [accountIdOf(context.userId)]);
    const parent = parents[0];
    const email = parent?.email?.trim() ?? "";
    const names = await sql<{ child_name: string }>`select distinct child_name from climbs where user_id = ${context.userId} order by child_name`;
    const children = [];
    for (const row of names) children.push({ firstName: row.child_name, apps: await appsForChild(sql, context.userId, row.child_name) });
    if (!email) return { sent: false, recipient: "", subject: "", body: "", error: "This parent account has no email address." };
    const letter = parentLogoutLetter({ parentName: parent?.name?.trim() || "Parent", parentEmail: email, children });
    const { sendAppMail } = await import("@/lib/app-mail");
    const mailed = await sendAppMail(letter.recipient, letter.subject, letter.body);
    return { sent: mailed === "sent", recipient: letter.recipient, subject: letter.subject, body: letter.body, error: mailed === "sent" ? "" : "The record was saved, but the email was not sent." };
  });
