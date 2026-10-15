import type { Sql } from "@/lib/db";
import type { SubjectId } from "@/lib/climb-rules";
import { ensureSeen, questionKey, rememberPrompt } from "@/lib/next-sheet";
import {
  type BagState,
  type PoolQuestion,
  RECENT_WINDOW,
  nextVariant,
  parseVariantId,
  poolCount,
  poolQuestion,
} from "@/lib/question-pool";

function childKey(name: string): string {
  return name.trim().toLowerCase();
}

export async function ensureQuestionMemory(sql: Sql) {
  await ensureSeen(sql);
  await sql`alter table seen_prompts add column if not exists prompt_text text`;
  await sql`alter table climbs add column if not exists answer_key text`;
  await sql`alter table climbs add column if not exists answer_aliases text`;
  await sql`alter table climbs add column if not exists answer_note text`;
  await sql`alter table climbs add column if not exists question_id text`;
  await sql`
    create table if not exists question_bags (
      user_id text not null,
      child_key text not null,
      pool_key text not null,
      remaining text not null,
      primary key (user_id, child_key, pool_key)
    )
  `;
}

export async function recentQuestions(
  sql: Sql,
  userId: string,
  childName: string,
  limit = RECENT_WINDOW,
): Promise<{ key: string; text: string }[]> {
  await ensureQuestionMemory(sql);
  const rows = await sql<{ prompt_key: string; prompt_text: string | null }>`
    select prompt_key, prompt_text from seen_prompts
    where user_id = ${userId} and child_key = ${childKey(childName)}
    order by seen_at desc
    limit ${limit}
  `;
  return rows.map((row) => ({ key: row.prompt_key, text: row.prompt_text?.trim() || "" }));
}

export type StoredKey = {
  answer: string;
  aliases: string[];
  note: string;
  id: string;
};

export async function keyedAnswer(sql: Sql, userId: string, climbId: string): Promise<StoredKey | null> {
  await ensureQuestionMemory(sql);
  const rows = await sql<{
    answer_key: string | null;
    answer_aliases: string | null;
    answer_note: string | null;
    question_id: string | null;
  }>`
    select answer_key, answer_aliases, answer_note, question_id
    from climbs
    where id = ${climbId} and user_id = ${userId}
  `;
  const row = rows[0];
  if (!row?.answer_key?.trim()) return null;
  let aliases: string[] = [];
  try {
    const parsed = JSON.parse(row.answer_aliases || "[]");
    if (Array.isArray(parsed)) aliases = parsed.filter((item): item is string => typeof item === "string");
  } catch {
    aliases = [];
  }
  return {
    answer: row.answer_key.trim(),
    aliases,
    note: row.answer_note?.trim() || "",
    id: row.question_id?.trim() || "",
  };
}

function poolKey(subject: SubjectId, grade: number, step: number): string {
  return `${subject}:${grade}:${step}`;
}

/** Draw the next question for this student and standard, then remember it on the account. */
export async function dealQuestion(
  sql: Sql,
  userId: string,
  childName: string,
  subject: SubjectId,
  grade: number,
  step: number,
): Promise<PoolQuestion> {
  await ensureQuestionMemory(sql);
  const level = Math.min(12, Math.max(1, Math.round(grade)));
  const rung = Math.min(2, Math.max(0, Math.round(step)));
  const count = poolCount(subject, level, rung);
  const recent = await recentQuestions(sql, userId, childName, RECENT_WINDOW);
  const recentIds = new Set<number>();
  for (const row of recent) {
    const parsed = parseVariantId(row.key);
    if (parsed && parsed.subject === subject && parsed.grade === level && parsed.step === rung) recentIds.add(parsed.index);
  }
  const name = childKey(childName);
  const key = poolKey(subject, level, rung);
  const saved = await sql<{ remaining: string }>`
    select remaining from question_bags
    where user_id = ${userId} and child_key = ${name} and pool_key = ${key}
  `;
  let state: BagState | null = null;
  if (saved[0]?.remaining) {
    try {
      const order = JSON.parse(saved[0].remaining) as unknown;
      if (Array.isArray(order)) state = { order: order.filter((item): item is number => Number.isInteger(item)) };
    } catch {
      state = null;
    }
  }
  const recentStems = new Set(recent.map((row) => questionKey(row.text)).filter(Boolean));
  let dealt = nextVariant(count, state, recentIds);
  let question = poolQuestion(subject, level, rung, dealt.index);
  let guard = 0;
  while (recentStems.has(questionKey(question.stem)) && recentIds.size < count && guard < count) {
    recentIds.add(dealt.index);
    dealt = nextVariant(count, dealt.state, recentIds);
    question = poolQuestion(subject, level, rung, dealt.index);
    guard += 1;
  }
  const remaining = JSON.stringify(dealt.state.order);
  await sql`
    insert into question_bags (user_id, child_key, pool_key, remaining)
    values (${userId}, ${name}, ${key}, ${remaining})
    on conflict (user_id, child_key, pool_key) do update set remaining = ${remaining}
  `;
  await rememberPrompt(sql, userId, childName, question.stem, question.id);
  return question;
}
