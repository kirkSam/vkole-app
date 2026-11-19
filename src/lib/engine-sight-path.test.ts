import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { VEKOLE_SETTINGS, createMemory, type SpiralWord } from "@kirkpatrick/vekole-engine";
import type { Sql } from "./db.ts";
import { applySightAnswer, ensureEngineStore } from "./engine-store.ts";
import { sightItemKey } from "./engine-connect.ts";
import { sightStatusLine } from "./sight-status.ts";
import { SIGHT_WORD_BANDS, isSightBand } from "./vkole/constants.ts";
import { bandWords, cardFromAccount, sightCard } from "./vkole/sight-words/words.ts";

const NOW = new Date("2026-11-18T18:00:00.000Z");
const USER = "sam@example.com";
const CHILD = "Ada";
const CLIMB = "climb-sight";

async function database(): Promise<Sql> {
  const pg = new PGlite();
  await pg.waitReady;
  const run = async <T>(text: string, params: unknown[] = []): Promise<T[]> => {
    const result = await pg.query<T>(text, params);
    return result.rows;
  };
  const sql = (async <T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    return run<T>(text, values);
  }) as unknown as Sql;
  sql.query = run;
  await ensureEngineStore(sql);
  await sql`
    create table climbs (
      id text primary key,
      user_id text not null,
      child_name text not null,
      subject text not null,
      level integer not null,
      standard_code text,
      standard_step integer,
      current_prompt text,
      question_id text,
      updated_at timestamptz not null default now()
    )
  `;
  return sql;
}

type Stored = { band: string; index: number; questionId: string; prompt: string };
type Card = { key: string; correct: boolean; growth: boolean; kind: string };

async function writeClimb(sql: Sql, place: Stored) {
  await sql`
    insert into climbs (id, user_id, child_name, subject, level, standard_code, standard_step, current_prompt, question_id)
    values (${CLIMB}, ${USER}, ${CHILD}, 'sw', 0, ${place.band}, ${place.index}, ${place.prompt}, ${place.questionId})
    on conflict (id) do update set
      standard_code = ${place.band},
      standard_step = ${place.index},
      current_prompt = ${place.prompt},
      question_id = ${place.questionId},
      updated_at = now()
  `;
}

async function sessionRow(sql: Sql) {
  const rows = await sql<{ serve_kind: string | null; spirals: string | null; fatigue: string | null }>`
    select serve_kind, spirals, fatigue from engine_sessions where climb_id = ${CLIMB}
  `;
  return rows[0];
}

function waitingKeys(raw: string | null | undefined): Set<string> {
  if (!raw) return new Set();
  const parsed = JSON.parse(raw) as SpiralWord[];
  return new Set(parsed.filter((word) => word.itemKey).map((word) => word.itemKey));
}

/** Read the climb the way markSightWord does, then apply the answer and store the next card. */
async function mark(sql: Sql, correct: boolean, now: Date, elapsedMs: number): Promise<void> {
  const rows = await sql<{ standard_code: string; standard_step: number | string; question_id: string | null }>`
    select standard_code, standard_step, question_id from climbs where id = ${CLIMB}
  `;
  const row = rows[0]!;
  const index = Number(row.standard_step ?? 0);
  const place = cardFromAccount({ grade: 0, band: row.standard_code, index }, 0);
  const storedId = row.question_id ?? "";
  const shownKey = storedId.startsWith("sw:") ? storedId : sightItemKey(place.band, place.index);
  const placed = await applySightAnswer(sql, {
    userId: USER,
    childName: CHILD,
    climbId: CLIMB,
    itemKey: shownKey,
    cursorBand: place.band,
    cursorIndex: place.index,
    listSize: bandWords(place.band).length,
    bands: SIGHT_WORD_BANDS,
    correct,
    elapsedMs,
    now,
  });
  const show = isSightBand(placed.showBand) ? sightCard(placed.showBand, placed.showIndex, 0) : place;
  const cursor = isSightBand(placed.cursorBand) ? sightCard(placed.cursorBand, placed.cursorIndex, 0) : show;
  await writeClimb(sql, {
    band: cursor.band,
    index: cursor.index,
    prompt: show.word,
    questionId: sightItemKey(show.band, show.index),
  });
}

async function showCard(sql: Sql): Promise<{ key: string; growth: boolean; kind: string; spirals: Set<string> }> {
  const peek = await sql<{ question_id: string; standard_code: string; standard_step: number | string }>`
    select question_id, standard_code, standard_step from climbs where id = ${CLIMB}
  `;
  const row = peek[0]!;
  const saved = await sessionRow(sql);
  const growth = row.question_id === sightItemKey(row.standard_code, Number(row.standard_step));
  return {
    key: row.question_id,
    growth,
    kind: saved?.serve_kind || "growth",
    spirals: waitingKeys(saved?.spirals),
  };
}

function assertSchedule(served: Card[]) {
  for (let index = 0; index + 4 <= served.length; index += 1) {
    const mixed = served.slice(index, index + 4).filter((item) => item.kind === "spiral" || item.kind === "review").length;
    assert.ok(mixed <= 1, served.map((item) => item.kind).join(" "));
  }
  const returns = new Map<string, number>();
  for (const item of served) {
    if (item.kind !== "spiral") continue;
    returns.set(item.key, (returns.get(item.key) ?? 0) + 1);
  }
  for (const [key, count] of returns) {
    assert.ok(count <= VEKOLE_SETTINGS.spiralMaxReturns, `${key} spiraled ${count} times`);
  }
}

function assertReturnGap(served: Card[], key: string, from: number) {
  const again = served.findIndex((item, index) => index > from && item.key === key);
  assert.ok(again > from, `${key} did not return`);
  const between = served.slice(from + 1, again);
  const fresh = between.filter((item) => item.growth).length;
  assert.ok(fresh >= VEKOLE_SETTINGS.spiralGapItems, `${key} returned after ${fresh} new words`);
  const interrupted = between.some((item) => !item.growth);
  if (!interrupted) assert.equal(fresh, VEKOLE_SETTINGS.spiralGapItems);
  assert.equal(served[again]?.kind, "spiral");
}

async function seedDue(sql: Sql, count: number) {
  const memory = createMemory(new Date(NOW.getTime() - 20 * 86_400_000));
  for (let index = 0; index < count; index += 1) {
    await sql`
      insert into memory_records (user_id, child_key, item_key, strength_days, last_practiced_at, reviews, misses, known)
      values (
        ${USER}, ${CHILD.toLowerCase()}, ${`sw:D-N:${index}`}, ${memory.strengthDays},
        ${memory.lastPracticedAt}, ${memory.reviews}, ${memory.misses}, 1
      )
    `;
  }
}

async function seedKnown(sql: Sql, band: string, indexes: number[]) {
  const memory = createMemory(NOW);
  for (const index of indexes) {
    await sql`
      insert into memory_records (user_id, child_key, item_key, strength_days, last_practiced_at, reviews, misses, known)
      values (${USER}, ${CHILD.toLowerCase()}, ${sightItemKey(band, index)}, ${memory.strengthDays}, ${memory.lastPracticedAt}, 1, 0, 1)
    `;
  }
}

describe("sight word path through the saved climb", () => {
  it("names fatigue and the words still waiting, for the master line", () => {
    const band = "D-PP";
    const words = bandWords(band);
    const gap = VEKOLE_SETTINGS.spiralGapItems;
    const line = sightStatusLine({
      fatigueHigh: false,
      spirals: [
        { itemKey: sightItemKey(band, 1), newWords: gap - 2, returns: 0, waiting: true },
        { itemKey: sightItemKey(band, 2), newWords: 0, returns: 1, waiting: false },
      ],
    });
    assert.equal(line, `Fatigue: Normal · Waiting to return: ${words[1]} (after 2 more new words), ${words[2]} (rested)`);
    assert.equal(sightStatusLine({ fatigueHigh: true, spirals: [] }), "Fatigue: High · Waiting to return: none");
  });

  it("returns both later misses after three new words, and a long miss is not fatigue", async () => {
    const sql = await database();
    await seedDue(sql, 30);
    const card = cardFromAccount({ grade: 0, band: "D-PP", index: 0 }, 0);
    await writeClimb(sql, { band: card.band, index: card.index, prompt: card.word, questionId: sightItemKey(card.band, card.index) });
    const served: Card[] = [];
    let growthCount = 0;
    let phase: "first" | "wait" | "seven" | "misses" | "tail" = "first";
    let seven = 0;
    let misses = 0;
    let tail = 0;
    const later: string[] = [];
    for (let step = 0; step < 80; step += 1) {
      const cardNow = await showCard(sql);
      if (cardNow.growth) assert.equal(cardNow.spirals.has(cardNow.key), false, cardNow.key);
      let correct = true;
      const elapsed = 1000;
      if (phase === "first" && cardNow.growth && growthCount === 1) correct = false;
      if (phase === "misses" && cardNow.growth && misses < 2) correct = false;
      if (cardNow.growth) growthCount += 1;
      await mark(sql, correct, NOW, elapsed);
      served.push({ key: cardNow.key, correct, growth: cardNow.growth, kind: cardNow.kind });
      if (phase === "first" && !correct) phase = "wait";
      else if (phase === "wait") {
        const first = served.find((item) => !item.correct);
        const back = served.some((item, index) => first && index > served.indexOf(first) && item.key === first.key);
        if (back) phase = "seven";
      } else if (phase === "seven") {
        seven += 1;
        if (seven >= 7) phase = "misses";
      } else if (phase === "misses" && !correct) {
        later.push(cardNow.key);
        misses += 1;
        if (misses >= 2) phase = "tail";
      } else if (phase === "tail") {
        tail += 1;
        const bothBack = later.every((key) => served.some((item, index) => item.key === key && index > served.findIndex((row) => row.key === key && !row.correct)));
        if (tail >= 14 && bothBack) break;
      }
    }
    assert.equal(tail >= 14, true);
    assert.equal(later.length, 2);
    const firstMiss = served.findIndex((item) => !item.correct);
    assertReturnGap(served, served[firstMiss]!.key, firstMiss);
    for (const key of later) {
      const at = served.findIndex((item) => item.key === key && !item.correct);
      assertReturnGap(served, key, at);
    }
    assertSchedule(served);
    const before = await sessionRow(sql);
    const paceBefore = JSON.parse(before?.fatigue || "{}") as { timesMs?: number[]; high?: boolean };
    assert.equal(paceBefore.high, false);
    const samples = paceBefore.timesMs?.length ?? 0;
    await mark(sql, false, NOW, 20000);
    const after = await sessionRow(sql);
    const paceAfter = JSON.parse(after?.fatigue || "{}") as { timesMs?: number[]; high?: boolean };
    assert.equal(paceAfter.high, false, "a long miss turned fatigue high");
    assert.equal(paceAfter.timesMs?.length, samples);
  });

  it("still returns misses after the list moves at 70 percent", async () => {
    const sql = await database();
    const band = "F-1";
    const size = bandWords(band).length;
    const need = Math.ceil(size * VEKOLE_SETTINGS.sightWordsListRule);
    const knownIndexes = Array.from({ length: size }, (_, index) => index).slice(2, 2 + (need - 1));
    await seedKnown(sql, band, knownIndexes);
    const card = cardFromAccount({ grade: 1, band, index: 0 }, 1);
    await writeClimb(sql, { band: card.band, index: 0, prompt: card.word, questionId: sightItemKey(band, 0) });
    const served: Card[] = [];
    let missesLeft = 2;
    let moved = false;
    for (let step = 0; step < 40; step += 1) {
      const cardNow = await showCard(sql);
      if (cardNow.growth) assert.equal(cardNow.spirals.has(cardNow.key), false, cardNow.key);
      const place = await sql<{ standard_code: string }>`select standard_code from climbs where id = ${CLIMB}`;
      let correct = true;
      if (!moved && cardNow.growth && missesLeft > 0 && place[0]?.standard_code === band) {
        correct = false;
        missesLeft -= 1;
      }
      const before = place[0]?.standard_code;
      await mark(sql, correct, NOW, 1000);
      const after = await sql<{ standard_code: string }>`select standard_code from climbs where id = ${CLIMB}`;
      if (before === band && after[0]?.standard_code === "F-2") moved = true;
      served.push({ key: cardNow.key, correct, growth: cardNow.growth, kind: cardNow.kind });
      const misses = served.filter((item) => !item.correct);
      if (moved && misses.length === 2 && misses.every((item) => served.some((later, index) => served.indexOf(item) < index && later.key === item.key))) break;
    }
    assert.equal(served.filter((item) => !item.correct).length, 2);
    assert.ok(served.length > 0);
    const cursor = await sql<{ standard_code: string }>`select standard_code from climbs where id = ${CLIMB}`;
    assert.equal(cursor[0]?.standard_code, "F-2");
    for (const item of served.filter((row) => !row.correct)) {
      const at = served.indexOf(item);
      assertReturnGap(served, item.key, at);
    }
    assertSchedule(served);
  });
});
