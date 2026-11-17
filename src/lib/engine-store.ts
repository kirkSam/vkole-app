import type { Sql } from "@/lib/db";
import { parseVariantId, poolQuestion, type PoolQuestion } from "@/lib/question-pool";
import {
  chooseNextServe,
  freshEngineSession,
  knownOnList,
  nextSightPlace,
  parseSightItemKey,
  scoreEngineItem,
  scoreSightWord,
  sightItemKey,
  type EngineSession,
  type ItemMemory,
} from "@/lib/engine-connect";
import type { FatigueState } from "@kirkpatrick/vekole-engine";

function childKey(name: string): string {
  return name.trim().toLowerCase();
}

function asSession(row: {
  items_served: number | string;
  reviews_served: number | string;
  items_since_new: number | string;
  last_new_at: unknown;
  fatigue: string | null;
  serve_kind: string | null;
  serve_item: string | null;
  rechecked: string | null;
} | undefined, now: Date): EngineSession {
  const fresh = freshEngineSession(now);
  if (!row) return fresh;
  let fatigue: FatigueState = fresh.fatigue;
  try {
    const parsed = JSON.parse(row.fatigue || "") as FatigueState;
    if (parsed && Array.isArray(parsed.timesMs) && typeof parsed.high === "boolean") fatigue = parsed;
  } catch {
    fatigue = fresh.fatigue;
  }
  const kind = row.serve_kind === "review" || row.serve_kind === "recheck" ? row.serve_kind : "growth";
  return {
    itemsServed: Number(row.items_served) || 0,
    reviewsServed: Number(row.reviews_served) || 0,
    itemsSinceNew: Number(row.items_since_new) || 0,
    lastNewAt: row.last_new_at ? new Date(row.last_new_at as string).toISOString() : fresh.lastNewAt,
    fatigue,
    serveKind: kind,
    serveItem: row.serve_item ?? "",
    rechecked: (row.rechecked ?? "").split(",").map((item) => item.trim()).filter(Boolean),
  };
}

export async function ensureEngineStore(sql: Sql): Promise<void> {
  await sql`
    create table if not exists memory_records (
      user_id text not null,
      child_key text not null,
      item_key text not null,
      strength_days double precision not null,
      last_practiced_at timestamptz not null,
      reviews integer not null,
      misses integer not null,
      known integer not null default 0,
      primary key (user_id, child_key, item_key)
    )
  `;
  await sql`
    create table if not exists engine_sessions (
      climb_id text primary key,
      user_id text not null,
      items_served integer not null default 0,
      reviews_served integer not null default 0,
      items_since_new integer not null default 0,
      last_new_at timestamptz not null default now(),
      fatigue text not null default '',
      serve_kind text not null default 'growth',
      serve_item text not null default '',
      rechecked text not null default ''
    )
  `;
  await sql`alter table memory_records add column if not exists known integer not null default 0`;
}

async function loadRecords(sql: Sql, userId: string, childName: string): Promise<ItemMemory[]> {
  const rows = await sql<{
    item_key: string;
    strength_days: number | string;
    last_practiced_at: unknown;
    reviews: number | string;
    misses: number | string;
    known: number | string | null;
  }>`
    select item_key, strength_days, last_practiced_at, reviews, misses, known
    from memory_records
    where user_id = ${userId} and child_key = ${childKey(childName)}
  `;
  return rows.map((row) => ({
    itemKey: row.item_key,
    strengthDays: Number(row.strength_days),
    lastPracticedAt: new Date(row.last_practiced_at as string).toISOString(),
    reviews: Number(row.reviews) || 0,
    misses: Number(row.misses) || 0,
    known: Number(row.known) === 1,
  }));
}

async function saveRecords(sql: Sql, userId: string, childName: string, records: ItemMemory[]): Promise<void> {
  const key = childKey(childName);
  for (const record of records) {
    const known = record.known === true ? 1 : 0;
    await sql`
      insert into memory_records (user_id, child_key, item_key, strength_days, last_practiced_at, reviews, misses, known)
      values (
        ${userId}, ${key}, ${record.itemKey}, ${record.strengthDays},
        ${record.lastPracticedAt}, ${record.reviews}, ${record.misses}, ${known}
      )
      on conflict (user_id, child_key, item_key) do update set
        strength_days = ${record.strengthDays},
        last_practiced_at = ${record.lastPracticedAt},
        reviews = ${record.reviews},
        misses = ${record.misses},
        known = ${known}
    `;
  }
}

async function saveSession(sql: Sql, userId: string, climbId: string, session: EngineSession): Promise<void> {
  const fatigue = JSON.stringify(session.fatigue);
  const rechecked = session.rechecked.join(",");
  await sql`
    insert into engine_sessions (
      climb_id, user_id, items_served, reviews_served, items_since_new, last_new_at,
      fatigue, serve_kind, serve_item, rechecked
    ) values (
      ${climbId}, ${userId}, ${session.itemsServed}, ${session.reviewsServed}, ${session.itemsSinceNew},
      ${session.lastNewAt}, ${fatigue}, ${session.serveKind}, ${session.serveItem}, ${rechecked}
    )
    on conflict (climb_id) do update set
      user_id = ${userId},
      items_served = ${session.itemsServed},
      reviews_served = ${session.reviewsServed},
      items_since_new = ${session.itemsSinceNew},
      last_new_at = ${session.lastNewAt},
      fatigue = ${fatigue},
      serve_kind = ${session.serveKind},
      serve_item = ${session.serveItem},
      rechecked = ${rechecked}
  `;
}

export function questionForItem(itemKey: string): PoolQuestion | null {
  const parsed = parseVariantId(itemKey);
  if (!parsed) return null;
  try {
    return poolQuestion(parsed.subject, parsed.grade, parsed.step, parsed.index);
  } catch {
    return null;
  }
}

/** A new sitting starts a new fatigue clock. A resumed sitting keeps it. */
export async function resetEngineSession(sql: Sql, userId: string, climbId: string, now = new Date()): Promise<void> {
  await ensureEngineStore(sql);
  await saveSession(sql, userId, climbId, freshEngineSession(now));
}

export async function questionShownAt(sql: Sql, userId: string, climbId: string): Promise<number> {
  const rows = await sql<{ updated_at: unknown }>`
    select updated_at from climbs where id = ${climbId} and user_id = ${userId}
  `;
  const shown = rows[0]?.updated_at ? new Date(rows[0].updated_at as string).getTime() : Date.now();
  return Number.isFinite(shown) ? shown : Date.now();
}

/**
 * Update this child's memory in this app's database, then choose the next
 * item. A review or a re-check does not change the growth level.
 */
export async function applyEngineAnswer(
  sql: Sql,
  input: {
    userId: string;
    childName: string;
    climbId: string;
    subject: string;
    itemKey: string;
    correct: boolean;
    elapsedMs: number;
    now?: Date;
  },
): Promise<{ holdLevel: boolean; earlyStepDown: boolean; next: PoolQuestion | null }> {
  await ensureEngineStore(sql);
  const now = input.now ?? new Date();
  const rows = await sql<{
    items_served: number | string;
    reviews_served: number | string;
    items_since_new: number | string;
    last_new_at: unknown;
    fatigue: string | null;
    serve_kind: string | null;
    serve_item: string | null;
    rechecked: string | null;
  }>`
    select items_served, reviews_served, items_since_new, last_new_at, fatigue, serve_kind, serve_item, rechecked
    from engine_sessions
    where climb_id = ${input.climbId} and user_id = ${input.userId}
  `;
  const session = asSession(rows[0], now);
  const records = await loadRecords(sql, input.userId, input.childName);
  const scored = scoreEngineItem({
    session,
    records,
    itemKey: input.itemKey,
    correct: input.correct,
    elapsedMs: input.elapsedMs,
    now,
    engine: input.subject,
  });
  const chosen = chooseNextServe({ session: scored.session, records: scored.records, now, subject: input.subject });
  await saveRecords(sql, input.userId, input.childName, scored.records);
  await saveSession(sql, input.userId, input.climbId, chosen.session);
  const next = chosen.itemKey && chosen.itemKey.startsWith(`${input.subject}:`) ? questionForItem(chosen.itemKey) : null;
  return { holdLevel: scored.holdLevel, earlyStepDown: scored.earlyStepDown, next };
}

/** Sight words use the package's 70% list rule. A miss stays in memory and can return. */
export async function applySightAnswer(
  sql: Sql,
  input: {
    userId: string;
    childName: string;
    climbId: string;
    itemKey: string;
    cursorBand: string;
    cursorIndex: number;
    listSize: number;
    bands: readonly string[];
    correct: boolean;
    elapsedMs: number;
    now?: Date;
  },
): Promise<{ showBand: string; showIndex: number; cursorBand: string; cursorIndex: number; advanced: boolean }> {
  await ensureEngineStore(sql);
  const now = input.now ?? new Date();
  const rows = await sql<{
    items_served: number | string;
    reviews_served: number | string;
    items_since_new: number | string;
    last_new_at: unknown;
    fatigue: string | null;
    serve_kind: string | null;
    serve_item: string | null;
    rechecked: string | null;
  }>`
    select items_served, reviews_served, items_since_new, last_new_at, fatigue, serve_kind, serve_item, rechecked
    from engine_sessions
    where climb_id = ${input.climbId} and user_id = ${input.userId}
  `;
  const session = asSession(rows[0], now);
  const wasReview = session.serveKind === "review" || session.serveKind === "recheck";
  const records = await loadRecords(sql, input.userId, input.childName);
  const scored = scoreSightWord({
    session,
    records,
    itemKey: input.itemKey,
    correct: input.correct,
    elapsedMs: input.elapsedMs,
    now,
  });
  const known = knownOnList(scored.records, input.cursorBand);
  const unknown = new Set<number>();
  for (let index = 0; index < input.listSize; index += 1) {
    const key = sightItemKey(input.cursorBand, index);
    const row = scored.records.find((item) => item.itemKey === key);
    if (!row?.known) unknown.add(index);
  }
  const cursor = wasReview
    ? { band: input.cursorBand, index: input.cursorIndex, advanced: false }
    : nextSightPlace({
        band: input.cursorBand,
        index: input.cursorIndex,
        listSize: input.listSize,
        known,
        bands: input.bands,
        unknown,
      });
  const chosen = chooseNextServe({ session: scored.session, records: scored.records, now, subject: "sw" });
  const review = chosen.itemKey ? parseSightItemKey(chosen.itemKey) : null;
  const show = review ?? { band: cursor.band, index: cursor.index };
  const saved = review ? chosen.session : { ...chosen.session, serveKind: "growth" as const, serveItem: "" };
  await saveRecords(sql, input.userId, input.childName, scored.records);
  await saveSession(sql, input.userId, input.climbId, saved);
  return { showBand: show.band, showIndex: show.index, cursorBand: cursor.band, cursorIndex: cursor.index, advanced: cursor.advanced };
}
