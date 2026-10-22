import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import { localDayKey, PACIFIC } from "./day-clock-math.ts";
import { pullSchoolAccount, pushSchoolAccount } from "./school-sync.server.ts";
import { saveAccountGrant, saveSchoolMirror, readSchoolMirror } from "./school-mirror.server.ts";
import type { SchoolProfile } from "./school-account.ts";

const EMAIL = "parent@example.com";
const TOKEN = "lapse-token";
const EXPIRES = "2099-01-01T00:00:00.000Z";

function toSql(pg: PGlite): Sql {
  const query = async <T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> => {
    const result = await pg.query<T>(text, params);
    return result.rows;
  };
  const sql = (async <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> => {
    let text = strings[0] ?? "";
    values.forEach((value, index) => {
      text += `$${index + 1}${strings[index + 1] ?? ""}`;
    });
    return query<T>(text, values);
  }) as Sql;
  sql.query = query;
  return sql;
}

async function database(): Promise<{ pg: PGlite; sql: Sql }> {
  const pg = new PGlite();
  await pg.waitReady;
  await pg.exec(`
    create table climbs (
      id text primary key,
      user_id text not null,
      child_name text not null,
      subject text not null,
      level integer not null,
      age integer,
      start_grade integer,
      standard_step integer not null default 0,
      standard_code text not null default '',
      correct_at_level integer not null default 0,
      incorrect_streak integer not null default 0,
      asked integer not null default 0,
      right_count integer not null default 0,
      performance_level integer,
      current_prompt text,
      alphabet_completed text not null default '',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table climb_events (
      id text primary key,
      climb_id text not null,
      user_id text not null,
      subject text not null,
      child_name text not null,
      age integer,
      correct boolean not null,
      level_before integer not null,
      level_after integer not null,
      detail text not null,
      created_at timestamptz not null default now()
    );
    create table seen_prompts (
      user_id text not null,
      child_key text not null,
      prompt_key text not null,
      prompt_text text,
      seen_at timestamptz not null default now(),
      primary key (user_id, child_key, prompt_key)
    );
    create table day_clocks (
      user_id text not null,
      child_key text not null,
      day_key text not null,
      used_seconds integer not null default 0,
      last_tick_at timestamptz,
      armed integer not null default 0,
      time_zone text,
      primary key (user_id, child_key, day_key)
    );
    create table app_trials (
      user_id text not null,
      subject text not null,
      started_at timestamptz not null default now(),
      primary key (user_id, subject)
    );
  `);
  return { pg, sql: toSql(pg) };
}

function family(access: "open" | "closed", levels: Record<string, unknown> = {}): unknown {
  return {
    family: {
      email: EMAIL,
      access,
      student: "",
      levels,
      clock: { seconds: 0 },
      seen: [],
    },
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

const saved: SchoolProfile = {
  access: "open",
  studentName: "Ada",
  level: {
    m: { grade: 4, step: 2 },
    sp: { grade: 1, step: 0, band: "LK", index: 12, word: "lk-next-m" },
  },
  freeWeekStart: "2026-01-01T00:00:00.000Z",
  clockSeconds: 120,
  seen: [],
  plan: "month",
  officePurchased: false,
  officeSlug: null,
};

describe("keep progress after a lapse", () => {
  it("locks a closed family without deleting levels, seen prompts, or history, and posts them again when access opens", async () => {
    const { pg, sql } = await database();
    const posts: unknown[] = [];
    const previous = globalThis.fetch;
    let access: "open" | "closed" = "closed";
    let levels: Record<string, unknown> = {};
    globalThis.fetch = (async (input: string, init?: RequestInit) => {
      const method = String(init?.method ?? "GET");
      if (method === "POST") {
        posts.push(init?.body ? JSON.parse(String(init.body)) : null);
        return jsonResponse(family("open", levels));
      }
      assert.equal(method, "GET");
      assert.equal(String(input), "https://www.dotheimpossible.ai/api/account/family");
      return jsonResponse(family(access, levels));
    }) as typeof fetch;
    try {
      await saveAccountGrant(sql, EMAIL, { token: TOKEN, expiresAt: EXPIRES });
      await saveSchoolMirror(sql, EMAIL, saved, true);
      await pg.query(
        `insert into climbs (id, user_id, child_name, subject, level, standard_step)
         values ('c1', $1, 'Ada', 'm', 4, 2)`,
        [EMAIL],
      );
      await pg.query(
        `insert into seen_prompts (user_id, child_key, prompt_key, prompt_text)
         values ($1, 'ada', 'sw:the', 'the')`,
        [EMAIL],
      );
      await pg.query(
        `insert into climb_events (id, climb_id, user_id, subject, child_name, correct, level_before, level_after, detail)
         values ('e1', 'c1', $1, 'm', 'Ada', true, 4, 4, $2)`,
        [EMAIL, JSON.stringify({ prompt: "4 + 4 = ?" })],
      );

      const closed = await pullSchoolAccount(sql, EMAIL);
      assert.equal(closed.access, "closed");
      assert.equal(closed.studentName, "Ada");
      assert.equal(closed.level.m?.grade, 4);
      assert.equal(closed.level.m?.step, 2);
      assert.equal(closed.level.sp?.index, 12);
      assert.equal(posts.length, 0);
      await pushSchoolAccount(sql, EMAIL);
      assert.equal(posts.length, 0);

      const climb = await pg.query<{ level: number; standard_step: number }>(
        "select level, standard_step from climbs where id = 'c1'",
      );
      assert.equal(Number(climb.rows[0]?.level), 4);
      assert.equal(Number(climb.rows[0]?.standard_step), 2);
      const seen = await pg.query<{ n: number }>("select count(*)::int as n from seen_prompts");
      const events = await pg.query<{ n: number }>("select count(*)::int as n from climb_events");
      assert.equal(Number(seen.rows[0]?.n), 1);
      assert.equal(Number(events.rows[0]?.n), 1);

      access = "open";
      levels = { m: { grade: 1, step: 0 }, sp: { grade: 1, step: 0 } };
      const reopened = await pullSchoolAccount(sql, EMAIL);
      assert.equal(reopened.access, "open");
      assert.equal(reopened.studentName, "Ada");
      assert.equal(reopened.level.m?.grade, 4);
      assert.equal(reopened.level.sp?.index, 12);
      const mirror = await readSchoolMirror(sql, EMAIL);
      assert.equal(mirror?.access, "open");
      assert.equal(mirror?.level.m?.grade, 4);
      assert.equal(mirror?.level.sp?.index, 12);
      assert.equal(mirror?.clockSeconds, 120);
      const still = await pg.query<{ level: number }>("select level from climbs where id = 'c1'");
      assert.equal(Number(still.rows[0]?.level), 4);

      await pushSchoolAccount(sql, EMAIL);
      assert.equal(posts.length, 1);
      const body = posts[0] as {
        levels: { m?: { grade?: number; step?: number }; sp?: { index?: number; word?: string; band?: string } };
        seenQuestions: { prompt: string }[];
      };
      assert.equal(body.levels.m?.grade, 4);
      assert.equal(body.levels.m?.step, 2);
      assert.equal(body.levels.sp?.index, 12);
      assert.equal(body.levels.sp?.word, "m");
      assert.deepEqual(
        body.seenQuestions.map((item) => item.prompt).sort(),
        ["4 + 4 = ?", "the"],
      );
      const after = await pg.query<{ n: number }>("select count(*)::int as n from climb_events");
      assert.equal(Number(after.rows[0]?.n), 1);
    } finally {
      globalThis.fetch = previous;
      await pg.close();
    }
  });

  it("still clears leftovers for a brand-new open account and keeps a closed account that has only local climbs", async () => {
    const { pg, sql } = await database();
    const previous = globalThis.fetch;
    let access: "open" | "closed" = "closed";
    globalThis.fetch = (async (_input: string, init?: RequestInit) => {
      assert.equal(String(init?.method ?? "GET"), "GET");
      return jsonResponse(family(access));
    }) as typeof fetch;
    try {
      await saveAccountGrant(sql, EMAIL, { token: TOKEN, expiresAt: EXPIRES });
      await pg.query(
        `insert into climbs (id, user_id, child_name, subject, level, standard_step)
         values ('c1', $1, 'Ada', 'm', 4, 2)`,
        [EMAIL],
      );
      await pg.query(
        `insert into seen_prompts (user_id, child_key, prompt_key, prompt_text)
         values ($1, 'ada', 'm:sum', '3 + 4')`,
        [EMAIL],
      );
      await pg.query(
        `insert into climb_events (id, climb_id, user_id, subject, child_name, correct, level_before, level_after, detail)
         values ('e1', 'c1', $1, 'm', 'Ada', true, 4, 4, $2)`,
        [EMAIL, JSON.stringify({ prompt: "3 + 4" })],
      );

      const closed = await pullSchoolAccount(sql, EMAIL);
      assert.equal(closed.access, "closed");
      assert.equal(closed.level.m?.grade, 4);
      assert.equal(closed.level.m?.step, 2);
      const climbed = await pg.query<{ n: number }>("select count(*)::int as n from climbs");
      const seen = await pg.query<{ n: number }>("select count(*)::int as n from seen_prompts");
      const events = await pg.query<{ n: number }>("select count(*)::int as n from climb_events");
      assert.equal(Number(climbed.rows[0]?.n), 1);
      assert.equal(Number(seen.rows[0]?.n), 1);
      assert.equal(Number(events.rows[0]?.n), 1);

      await pg.query("delete from climbs");
      await pg.query("delete from seen_prompts");
      await pg.query("delete from climb_events");
      await pg.query("delete from school_mirror");
      await saveAccountGrant(sql, EMAIL, { token: TOKEN, expiresAt: EXPIRES });
      await pg.query(
        `insert into climbs (id, user_id, child_name, subject, level, standard_step)
         values ('c2', $1, 'Old', 'm', 2, 0)`,
        [EMAIL],
      );
      await pg.query(
        `insert into seen_prompts (user_id, child_key, prompt_key, prompt_text)
         values ($1, 'old', 'm:old', '1 + 1')`,
        [EMAIL],
      );
      access = "open";
      const fresh = await pullSchoolAccount(sql, EMAIL);
      assert.equal(fresh.access, "open");
      assert.equal(fresh.level.m, undefined);
      const leftClimbs = await pg.query<{ n: number }>("select count(*)::int as n from climbs");
      const leftSeen = await pg.query<{ n: number }>("select count(*)::int as n from seen_prompts");
      assert.equal(Number(leftClimbs.rows[0]?.n), 0);
      assert.equal(Number(leftSeen.rows[0]?.n), 0);
    } finally {
      globalThis.fetch = previous;
      await pg.close();
    }
  });

  it("does not carry yesterday's 8 hours onto today's clock or the website post", async () => {
    const today = localDayKey(PACIFIC);
    const [year, month, date] = today.split("-").map(Number);
    const prior = new Date(Date.UTC(year ?? 2026, (month ?? 1) - 1, date ?? 1));
    prior.setUTCDate(prior.getUTCDate() - 1);
    const yesterday = prior.toISOString().slice(0, 10);
    const { pg, sql } = await database();
    const posts: unknown[] = [];
    const previous = globalThis.fetch;
    globalThis.fetch = (async (_input: string, init?: RequestInit) => {
      const method = String(init?.method ?? "GET");
      if (method === "POST") {
        posts.push(init?.body ? JSON.parse(String(init.body)) : null);
        return jsonResponse(family("open"));
      }
      return jsonResponse({
        family: {
          email: EMAIL,
          access: "open",
          student: "Ada",
          levels: { m: { grade: 4, step: 2 } },
          clock: { seconds: 0, dayKey: today },
          seen: [],
        },
      });
    }) as typeof fetch;
    try {
      await saveAccountGrant(sql, EMAIL, { token: TOKEN, expiresAt: EXPIRES });
      await saveSchoolMirror(sql, EMAIL, { ...saved, clockSeconds: 28800, clockDayKey: yesterday }, true);
      await pg.query(
        `insert into day_clocks (user_id, child_key, day_key, used_seconds, armed, time_zone)
         values ($1, 'login', $2, 28800, 0, 'America/Los_Angeles')`,
        [EMAIL, yesterday],
      );
      const pulled = await pullSchoolAccount(sql, EMAIL);
      assert.equal(pulled.clockDayKey, today);
      assert.equal(pulled.clockSeconds, 0);
      const todayRow = await pg.query<{ used_seconds: number }>(
        "select used_seconds from day_clocks where user_id = $1 and day_key = $2",
        [EMAIL, today],
      );
      assert.equal(todayRow.rows.length, 0);
      const mirror = await readSchoolMirror(sql, EMAIL);
      assert.equal(mirror?.clockDayKey, today);
      assert.equal(mirror?.clockSeconds, 0);
      await pushSchoolAccount(sql, EMAIL);
      assert.equal(posts.length, 1);
      const body = posts[0] as { clock?: { seconds?: number; dayKey?: string } };
      assert.equal(body.clock?.seconds, 0);
      assert.equal(body.clock?.dayKey, today);
    } finally {
      globalThis.fetch = previous;
      await pg.close();
    }
  });
});
