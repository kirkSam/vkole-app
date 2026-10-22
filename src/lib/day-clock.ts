import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { childAccess, rollRenewals } from "@/lib/subscription";
import { getSql, type Sql } from "@/lib/db";
import { schoolMiddleware } from "@/lib/school-middleware";
import { THIRD_STUDENT_MESSAGE, accountIdOf, isSchoolAccountId } from "@/lib/school-account";
import { TRIAL_MS } from "@/lib/academic-email";
import { dealQuestion } from "@/lib/question-history";
import { practicePromptText, rememberPrompt } from "@/lib/next-sheet";
import { isSubject, type SubjectId } from "@/lib/climb-rules";
import { cardFromAccount as spCardFromAccount, letterView } from "@/lib/vkole/spelling/items";
import { cardFromAccount as paCardFromAccount, paPrompt } from "@/lib/vkole/phonemic-awareness/items";
import { cardFromAccount, sightPrompt } from "@/lib/vkole/sight-words/words";
import { localDayKey, PACIFIC, projectTodayClock, type ClockProjection } from "@/lib/day-clock-math";
import type { ClockFace } from "@/components/vkole-rules";

type ClockRow = {
  used_seconds: number | string | null;
  last_tick_at: unknown;
  armed: unknown;
  day_key?: string | null;
};

const LOGIN_CLOCK = "login";

function childKey(name: string) {
  return name.trim().toLowerCase();
}

async function readLatestRow(sql: Sql, userId: string, key: string) {
  const rows = await sql<ClockRow>`
    select used_seconds, last_tick_at, armed, day_key
    from day_clocks
    where user_id = ${userId} and child_key = ${key}
    order by day_key desc
    limit 1
  `;
  return rows[0];
}

async function writeRow(
  sql: Sql,
  userId: string,
  key: string,
  day: string,
  used: number,
  armed: boolean,
  tick: string | null,
  timeZone: string,
) {
  await sql`
    insert into day_clocks (user_id, child_key, day_key, used_seconds, last_tick_at, armed, time_zone)
    values (${userId}, ${key}, ${day}, ${used}, ${tick}, ${armed ? 1 : 0}, ${timeZone})
    on conflict (user_id, child_key, day_key) do update
    set used_seconds = excluded.used_seconds,
        last_tick_at = excluded.last_tick_at,
        armed = excluded.armed,
        time_zone = excluded.time_zone
  `;
}

async function observe(sql: Sql, userId: string) {
  const day = localDayKey(PACIFIC);
  const latest = await readLatestRow(sql, userId, LOGIN_CLOCK);
  const row = latest?.day_key === day ? latest : undefined;
  const projected = projectTodayClock(latest, day, Date.now());
  const storedArmed = row?.armed === true || row?.armed === 1 || row?.armed === "1" || row?.armed === "t";
  if (row && storedArmed && !projected.armed) {
    await writeRow(sql, userId, LOGIN_CLOCK, day, projected.used, false, null, PACIFIC);
  }
  return { ...projected, day, zone: PACIFIC };
}

async function accessOpen(sql: Sql, userId: string) {
  if (isSchoolAccountId(userId)) {
    const access = await childAccess(sql, userId, "");
    return access === "open";
  }
  await rollRenewals(sql, userId);
  const rows = await sql<{ started_at: unknown; subscribed: boolean | string | number | null }>`
    select t.started_at,
           exists (
             select 1 from app_subscriptions s
             where s.user_id = t.user_id and s.detail in ('month', 'year') and s.expires_at > now()
           ) as subscribed
    from app_trials t
    where t.user_id = ${userId} and t.subject = 'app'
  `;
  const row = rows[0];
  if (!row) return true;
  const started = new Date(String(row.started_at)).getTime();
  const elapsed = Date.now() - started;
  const subscribed = row.subscribed === true || row.subscribed === "t" || row.subscribed === 1;
  return subscribed || elapsed < TRIAL_MS;
}

async function loadName(sql: Sql, userId: string, climbId: string) {
  const rows = await sql<{ child_name: string }>`
    select child_name from climbs where id = ${climbId} and user_id = ${userId}
  `;
  return rows[0]?.child_name ?? null;
}

async function passwordHash(sql: Sql, userId: string, name: string) {
  await sql`
    create table if not exists student_passwords (
      user_id text not null,
      child_key text not null,
      password_hash text not null,
      primary key (user_id, child_key)
    )
  `;
  const rows = await sql<{ password_hash: string }>`
    select password_hash from student_passwords
    where user_id = ${userId} and child_key = ${childKey(name)}
  `;
  return rows[0]?.password_hash ?? "";
}

async function face(sql: Sql, userId: string, name: string, clock: ClockProjection): Promise<ClockFace> {
  const saved = await passwordHash(sql, userId, name);
  return {
    childName: name,
    remainingSeconds: clock.remaining,
    closed: clock.closed,
    armed: clock.armed,
    passwordSet: Boolean(saved),
  };
}

async function acceptStudentPassword(sql: Sql, userId: string, name: string, password: string) {
  const given = password.trim();
  if (given.length < 4) throw new Error("Enter the student password.");
  const saved = await passwordHash(sql, userId, name);
  const { hashPassword, verifyPassword } = await import("better-auth/crypto");
  if (!saved) {
    const hash = await hashPassword(given);
    await sql`
      insert into student_passwords (user_id, child_key, password_hash)
      values (${userId}, ${childKey(name)}, ${hash})
      on conflict (user_id, child_key) do update set password_hash = excluded.password_hash
    `;
    return;
  }
  const ok = await verifyPassword({ hash: saved, password: given });
  if (!ok) throw new Error("That student password does not match.");
}

async function ensureTrial(sql: Sql, userId: string) {
  if (isSchoolAccountId(userId)) return;
  await sql`
    insert into app_trials (user_id, subject, started_at)
    values (${userId}, 'app', now())
    on conflict (user_id, subject) do nothing
  `;
}

async function seedPrompt(sql: Sql, userId: string, id: string, subject: SubjectId, grade: number, childName: string) {
  const rows = await sql<{ current_prompt: string | null; standard_code: string | null; standard_step: number | string | null; level: number | string | null; age: number | string | null }>`
    select current_prompt, standard_code, standard_step, level, age from climbs where id = ${id} and user_id = ${userId}
  `;
  if (rows[0]?.current_prompt) return;
  const stored = rows[0];
  const storedGrade = Number(stored?.level) || grade;
  const storedAge = stored?.age == null ? null : Number(stored.age);
  const storedIndex = Number(stored?.standard_step) || 0;
  let stepIndex: number | null = null;
  let item: { id: string; stem: string; answer: string; aliases: string[]; standard: string; note: string };
  let practice = "";
  if (subject === "sw") {
    const card = cardFromAccount({ grade: storedGrade, band: stored?.standard_code, index: storedIndex }, grade);
    stepIndex = card.index;
    item = sightPrompt(card.band, card.index);
    practice = practicePromptText("sw", { word: item.stem });
  } else if (subject === "sp") {
    const card = spCardFromAccount({ grade: storedGrade, band: stored?.standard_code, index: storedIndex }, grade);
    const view = letterView({ index: storedIndex, silence: 0, wrong: 0 });
    stepIndex = view.index;
    item = {
      id: `sp:${view.band}:${view.id}:s${view.silence}:w${view.wrong}`,
      stem: view.show,
      answer: view.answer,
      aliases: view.also,
      standard: card.band,
      note: view.name,
    };
    practice = practicePromptText("sp", { letter: view.letter });
  } else if (subject === "pa") {
    const card = paCardFromAccount(
      { grade: storedGrade, age: storedAge, band: stored?.standard_code, index: storedIndex },
      grade,
    );
    stepIndex = card.index;
    item = paPrompt(card.band, card.index, storedGrade);
    practice = practicePromptText("pa", { say: item.stem });
  } else {
    item = await dealQuestion(sql, userId, childName, subject, grade, 0);
  }
  if (practice) await rememberPrompt(sql, userId, childName, practice);
  await sql`
    update climbs
    set start_grade = coalesce(start_grade, ${grade}),
        standard_code = ${item.standard},
        standard_label = ${item.note},
        standard_step = coalesce(${stepIndex}, standard_step),
        current_prompt = ${item.stem},
        answer_key = ${item.answer},
        answer_aliases = ${JSON.stringify(item.aliases)},
        answer_note = ${item.note},
        question_id = ${item.id}
    where id = ${id} and user_id = ${userId}
  `;
}

export async function disarmStudentClock(sql: Sql, userId: string, climbId: string) {
  const name = await loadName(sql, userId, climbId);
  if (!name) return;
  const clock = await observe(sql, userId);
  await writeRow(sql, userId, LOGIN_CLOCK, clock.day, clock.used, false, null, PACIFIC);
}

async function placeWebsiteStudent(
  sql: Sql,
  userId: string,
  data: { firstName: string; age?: number; grade?: number },
): Promise<{ status: "extra" | "new" } | { status: "ready"; scopeId: string }> {
  const { readSchoolAccount, saveSchoolStudent } = await import("@/lib/school-account.server");
  const { decideStudent, indexForName, isWebsiteMasterEmail, studentIndexToAdd, studentScopeId } = await import("@/lib/school-account");
  const profile = await readSchoolAccount(userId);
  const roster = profile.students?.length ? profile.students : profile.studentName ? [{ name: profile.studentName }] : [];
  const cap = isWebsiteMasterEmail(userId, process.env.VKOLE_MASTER_EMAIL) ? Number.POSITIVE_INFINITY : 2;
  const gate = decideStudent(profile.studentName, data.firstName, roster, cap);
  if (gate === "extra") return { status: "extra" };
  const account = accountIdOf(userId);
  if (gate === "same") {
    const index = indexForName(profile, data.firstName);
    const scopeId = studentScopeId(account, index);
    if (scopeId !== userId) {
      const { saveActiveStudentIndex, saveSchoolMirror } = await import("@/lib/school-mirror.server");
      await saveActiveStudentIndex(sql, account, index);
      const next = await readSchoolAccount(scopeId);
      await saveSchoolMirror(sql, scopeId, next, false);
    }
    return { status: "ready", scopeId };
  }
  if (data.age == null || data.grade == null || data.grade < 1 || data.grade > 12) return { status: "new" };
  const index = gate === "new" ? 1 : studentIndexToAdd(profile.students ?? [], isWebsiteMasterEmail(account, process.env.VKOLE_MASTER_EMAIL));
  if (index == null) return { status: "extra" };
  const saved = await saveSchoolStudent(account, {
    name: data.firstName.trim(),
    startingGrade: data.grade,
    ...(data.age != null ? { age: data.age } : {}),
    ...(index > 1 ? { studentIndex: index } : {}),
  });
  const scopeId = studentScopeId(account, index);
  const { saveActiveStudentIndex, saveSchoolMirror } = await import("@/lib/school-mirror.server");
  await saveActiveStudentIndex(sql, account, index);
  await saveSchoolMirror(sql, scopeId, { ...saved, studentName: saved.studentName || data.firstName.trim() }, false);
  return { status: "ready", scopeId };
}

const enterSchema = z.object({
  subject: z.enum(["m", "ela", "ss", "gen", "sg", "sw", "sp", "pa"]),
  firstName: z.string().trim().min(1).max(40),
  age: z.number().int().min(4).max(18).optional(),
  grade: z.number().int().min(1).max(12).optional(),
  timeZone: z.string().trim().min(1).max(80).optional(),
});

export const enterEngine = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const parsed = enterSchema.safeParse(data);
    if (!parsed.success) throw new Error("Enter the student’s first name.");
    return parsed.data;
  })
  .middleware([schoolMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureTrial(sql, context.userId);
    if (!(await accessOpen(sql, context.userId))) return { status: "blocked" as const };
    let scopeId = context.userId;
    let websiteStudent: "new" | "same" | "add" | "local" = "local";
    if (isSchoolAccountId(context.userId)) {
      const placed = await placeWebsiteStudent(sql, context.userId, data);
      if (placed.status !== "ready") return { status: placed.status };
      scopeId = placed.scopeId;
      websiteStudent = "same";
    }
    const key = childKey(data.firstName);
    const existing = await sql<{ id: string; level: number | string; subject: string }>`
      select id, level, subject from climbs
      where user_id = ${scopeId} and subject = ${data.subject} and lower(child_name) = ${key}
      limit 1
    `;
    let id = existing[0]?.id;
    let level = existing[0] ? Number(existing[0].level) : data.grade;
    if (!id) {
      if (websiteStudent === "local") {
        const others = await sql<{ name: string }>`
          select distinct lower(child_name) as name from climbs
          where user_id = ${scopeId} and lower(child_name) <> ${key}
        `;
        if (others.length >= 2) {
          throw new Error(THIRD_STUDENT_MESSAGE);
        }
      }
      if (data.age == null || data.grade == null || data.grade < 1 || data.grade > 12) return { status: "new" as const };
      let grade = data.grade;
      let step = 0;
      let siteLevel: { grade?: number; band?: string | null; index?: number | null; step?: number; streak?: number; missStreak?: number } | undefined;
      if (isSchoolAccountId(scopeId)) {
        const { readSchoolMirror } = await import("@/lib/school-mirror.server");
        const mirror = await readSchoolMirror(sql, scopeId);
        const site = mirror?.level[data.subject];
        if (site) {
          grade = site.grade;
          step = site.step;
          siteLevel = site;
        }
      }
      id = crypto.randomUUID();
      const sight = data.subject === "sw" ? cardFromAccount(siteLevel ?? { grade }, grade) : null;
      const spellingCard = data.subject === "sp" ? spCardFromAccount(siteLevel ?? { grade }, grade) : null;
      const spellingView =
        data.subject === "sp"
          ? letterView({ index: siteLevel?.index ?? 0, silence: siteLevel?.streak ?? 0, wrong: siteLevel?.missStreak ?? 0 })
          : null;
      const phonemic =
        data.subject === "pa"
          ? paCardFromAccount({ ...(siteLevel ?? {}), grade, age: data.age }, grade)
          : null;
      if (sight) {
        grade = sight.grade;
        step = sight.index;
      }
      if (spellingCard && spellingView) {
        grade = Math.min(12, Math.max(1, Math.round(spellingCard.grade) || grade));
        step = spellingView.index;
      }
      if (phonemic) {
        grade = Math.min(12, Math.max(1, Math.round(phonemic.grade) || grade));
        step = phonemic.index;
      }
      const item = sight
        ? sightPrompt(sight.band, sight.index)
        : spellingView
          ? {
              id: `sp:${spellingView.band}:${spellingView.id}:s${spellingView.silence}:w${spellingView.wrong}`,
              stem: spellingView.show,
              answer: spellingView.answer,
              aliases: spellingView.also,
              standard: spellingView.band,
              note: spellingView.name,
            }
          : phonemic
            ? paPrompt(phonemic.band, phonemic.index, grade)
            : await dealQuestion(sql, scopeId, data.firstName.trim(), data.subject, grade, step);
      const practice = sight
        ? practicePromptText("sw", { word: item.stem })
        : spellingView
          ? practicePromptText("sp", { letter: spellingView.letter })
          : phonemic
            ? practicePromptText("pa", { say: item.stem })
            : "";
      if (practice) await rememberPrompt(sql, scopeId, data.firstName.trim(), practice);
      level = grade;
      await sql`alter table climbs add column if not exists registration_email text`;
      const prior = await sql<{ email: string | null }>`
        select registration_email as email
        from climbs
        where user_id = ${scopeId}
          and lower(child_name) = ${key}
          and registration_email is not null
          and registration_email <> ''
        order by created_at asc
        limit 1
      `;
      let registrationEmail = prior[0]?.email?.trim() ?? "";
      if (!registrationEmail) {
        const accountId = accountIdOf(scopeId);
        const users = await sql<{ email: string | null }>`select "email" from "user" where "id" = ${accountId}`;
        registrationEmail = users[0]?.email?.trim() || (accountId.includes("@") ? accountId : "");
      }
      await sql`
        insert into climbs (
          id, user_id, child_name, subject, level, performance_level, age,
          start_grade, standard_code, standard_label, current_prompt, registration_email,
          answer_key, answer_aliases, answer_note, question_id, correct_at_level, incorrect_streak
        )
        values (
          ${id}, ${scopeId}, ${data.firstName.trim()}, ${data.subject}, ${grade}, ${grade}, ${data.age},
          ${grade}, ${item.standard}, ${item.note}, ${item.stem}, ${registrationEmail || null},
          ${item.answer}, ${JSON.stringify(item.aliases)}, ${item.note}, ${item.id},
          ${spellingView?.silence ?? 0}, ${spellingView?.wrong ?? 0}
        )
      `;
      await sql`
        update climbs set standard_step = ${step}
        where id = ${id} and user_id = ${scopeId}
      `;
    }
    const access = await childAccess(sql, scopeId, data.firstName);
    if (access === "ended") return { status: "blocked" as const };
    if (access === "extra") return { status: "extra" as const };
    if (!isSubject(data.subject)) return { status: "blocked" as const };
    if (level == null) return { status: "new" as const };
    await seedPrompt(sql, scopeId, id, data.subject, level, data.firstName.trim());
    const clock = await observe(sql, scopeId);
    await writeRow(sql, scopeId, LOGIN_CLOCK, clock.day, clock.used, true, new Date().toISOString(), PACIFIC);
    return { status: "open" as const, id };
  });

export const listDayClocks = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const parsed = z.object({ timeZone: z.string().trim().min(1).max(80) }).safeParse(data);
    if (!parsed.success) throw new Error("Check the local time and try again.");
    return parsed.data;
  })
  .middleware([schoolMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const names = await sql<{ child_name: string }>`
      select distinct child_name from climbs where user_id = ${context.userId} order by child_name
    `;
    const clock = await observe(sql, context.userId);
    const faces: ClockFace[] = [];
    for (const row of names) {
      faces.push(await face(sql, context.userId, row.child_name, clock));
    }
    return faces;
  });

async function clockForClimb(sql: Sql, userId: string, id: string) {
  const name = await loadName(sql, userId, id);
  if (!name) throw new Error("Session not found.");
  const clock = await observe(sql, userId);
  return { name, clock };
}

export const readStudentClock = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const parsed = z
      .object({ id: z.string().trim().min(8).max(80), timeZone: z.string().trim().min(1).max(80) })
      .safeParse(data);
    if (!parsed.success) throw new Error("Check the session and try again.");
    return parsed.data;
  })
  .middleware([schoolMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { name, clock } = await clockForClimb(sql, context.userId, data.id);
    return face(sql, context.userId, name, clock);
  });

export const beatStudentClock = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const parsed = z
      .object({ id: z.string().trim().min(8).max(80), timeZone: z.string().trim().min(1).max(80) })
      .safeParse(data);
    if (!parsed.success) throw new Error("Check the session and try again.");
    return parsed.data;
  })
  .middleware([schoolMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { name, clock } = await clockForClimb(sql, context.userId, data.id);
    await writeRow(sql, context.userId, LOGIN_CLOCK, clock.day, clock.used, true, new Date().toISOString(), PACIFIC);
    const next = await observe(sql, context.userId);
    return face(sql, context.userId, name, next);
  });

export const resumeStudentClock = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const parsed = z
      .object({
        id: z.string().trim().min(8).max(80),
        password: z.string().trim().min(4).max(80),
        timeZone: z.string().trim().min(1).max(80).optional(),
      })
      .safeParse(data);
    if (!parsed.success) throw new Error("Enter the student password.");
    return parsed.data;
  })
  .middleware([schoolMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    if (!(await accessOpen(sql, context.userId))) throw new Error("The 7-day trial for VKOLE/ZPD - Space XSI Integrated Learning Engine has ended.");
    const { name, clock } = await clockForClimb(sql, context.userId, data.id);
    await acceptStudentPassword(sql, context.userId, name, data.password);
    await writeRow(sql, context.userId, LOGIN_CLOCK, clock.day, clock.used, true, new Date().toISOString(), PACIFIC);
    const next = await observe(sql, context.userId);
    return face(sql, context.userId, name, next);
  });

