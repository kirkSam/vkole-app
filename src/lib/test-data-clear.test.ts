import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import {
  CLEAR_TABLES,
  CLEAR_TEST_DATA_PHRASE,
  mayClearTestData,
  phraseMatches,
} from "./test-data-clear.ts";
import { confirmClearTestData, showTestDataCounts } from "./test-data-clear.server.ts";

const MASTER = "kirksamalpha@dotheimpossible.ai";

async function database(): Promise<{ sql: Sql; pg: PGlite }> {
  const pg = new PGlite();
  await pg.waitReady;
  await pg.exec(`
    create table "user" ("id" text primary key, "email" text, "name" text);
    create table "session" ("id" text primary key, "userId" text);
    create table climbs (id text primary key, user_id text, child_name text, level integer);
    create table climb_sittings (id text primary key, user_id text, climb_id text);
    create table day_clocks (user_id text, child_key text, day_key text, primary key (user_id, child_key, day_key));
    create table seen_prompts (user_id text, child_key text, prompt_key text, primary key (user_id, child_key, prompt_key));
    create table app_settings (key text primary key, value text not null);
    create table app_mail (id integer primary key, address text, secret text);
  `);
  await pg.query(
    `insert into "user" ("id", "email", "name") values ('m-1', $1, 'Sam'), ('o-1', 'other@example.com', 'Other')`,
    [MASTER],
  );
  await pg.query(
    `insert into "session" ("id", "userId") values ('s-master', 'm-1'), ('s-other', 'o-1')`,
  );
  await pg.query(
    `insert into climbs (id, user_id, child_name, level) values
      ('c-sam', $1, 'Sam', 3),
      ('c-jeff', 'other@example.com', 'Jeff', 2)`,
    [MASTER],
  );
  await pg.query(
    `insert into climb_sittings (id, user_id, climb_id) values ('sit-jeff', 'other@example.com', 'c-jeff')`,
  );
  await pg.query(
    `insert into day_clocks (user_id, child_key, day_key) values ('other@example.com', 'jeff', '2026-11-12')`,
  );
  await pg.query(
    `insert into seen_prompts (user_id, child_key, prompt_key) values ('other@example.com', 'jeff', 'word-1')`,
  );
  await pg.query(`insert into app_settings (key, value) values ('account_wipe_version', '1')`);
  await pg.query(`insert into app_mail (id, address, secret) values (1, 'office@example.com', 'mailbox-secret')`);
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
  return { sql, pg };
}

describe("clear test data", () => {
  it("lets only the master account ask", () => {
    assert.equal(mayClearTestData(MASTER), true);
    assert.equal(mayClearTestData(" KirkSamAlpha@DotHeimpossible.ai "), true);
    assert.equal(mayClearTestData("other@example.com"), false);
    assert.equal(mayClearTestData("kirksamalpha@gmail.com"), false);
    assert.equal(phraseMatches(`  ${CLEAR_TEST_DATA_PHRASE}  `), true);
    assert.equal(phraseMatches("delete-all-accounts"), false);
    assert.equal(CLEAR_TABLES.some((table) => table.sqlName.includes("app_settings")), false);
    assert.equal(CLEAR_TABLES.some((table) => table.sqlName.includes("app_mail")), false);
  });

  it("shows counts, including Jeff, only to the master", async () => {
    const { sql } = await database();
    const refused = await showTestDataCounts(sql, "o-1");
    assert.deepEqual(refused, { ok: false });
    const shown = await showTestDataCounts(sql, "m-1");
    assert.equal(shown.ok, true);
    if (!shown.ok) return;
    assert.equal(shown.counts.climbs, 2);
    assert.equal(shown.counts.sittings, 1);
    assert.equal(shown.counts.day_clocks, 1);
    assert.equal(shown.counts.seen_prompts, 1);
    assert.equal(shown.counts.users, 2);
    assert.equal(shown.counts.sessions, 2);
    assert.equal(shown.counts.students, 2);
    assert.deepEqual(shown.students, ["Jeff", "Sam"]);
    assert.match(shown.at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2} PT$/);
    assert.equal(shown.counts.question_bags, 0);
  });

  it("does not delete until the master types the phrase, then keeps the master and the settings", async () => {
    const { sql, pg } = await database();
    const wrong = await confirmClearTestData(sql, "m-1", "delete-all-accounts");
    assert.equal(wrong.ok, false);
    const still = await pg.query<{ n: number }>("select count(*)::int as n from climbs");
    assert.equal(Number(still.rows[0]?.n), 2);

    const stranger = await confirmClearTestData(sql, "other@example.com", CLEAR_TEST_DATA_PHRASE);
    assert.equal(stranger.ok, false);
    const stillJeff = await pg.query<{ name: string }>(
      "select child_name as name from climbs where child_name = 'Jeff'",
    );
    assert.equal(stillJeff.rows[0]?.name, "Jeff");

    const cleared = await confirmClearTestData(sql, "m-1", CLEAR_TEST_DATA_PHRASE);
    assert.equal(cleared.ok, true);
    if (!cleared.ok) return;
    assert.equal(cleared.before.climbs, 2);
    assert.equal(cleared.before.sittings, 1);
    assert.deepEqual(cleared.studentsBefore, ["Jeff", "Sam"]);
    assert.equal(cleared.after.climbs, 1);
    assert.equal(cleared.after.sittings, 0);
    assert.equal(cleared.after.day_clocks, 0);
    assert.equal(cleared.after.seen_prompts, 0);
    assert.equal(cleared.after.users, 1);
    assert.equal(cleared.after.sessions, 1);
    assert.deepEqual(cleared.studentsAfter, ["Sam"]);
    assert.match(cleared.at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2} PT$/);

    const mail = await pg.query<{ secret: string }>("select secret from app_mail where id = 1");
    assert.equal(mail.rows[0]?.secret, "mailbox-secret");
    const settings = await pg.query<{ value: string }>(
      "select value from app_settings where key = 'account_wipe_version'",
    );
    assert.equal(settings.rows[0]?.value, "1");
    const table = await pg.query<{ name: string | null }>("select to_regclass('climbs') as name");
    assert.equal(Boolean(table.rows[0]?.name), true);

    const again = await confirmClearTestData(sql, MASTER, CLEAR_TEST_DATA_PHRASE);
    assert.equal(again.ok, true);
    if (!again.ok) return;
    assert.equal(again.after.users, 1);
    assert.deepEqual(again.studentsAfter, ["Sam"]);
  });

  it("does not drop tables or call the old purge", () => {
    const source = readFileSync(new URL("./test-data-clear.server.ts", import.meta.url), "utf8");
    const screen = readFileSync(new URL("./test-data-clear.ts", import.meta.url), "utf8");
    assert.doesNotMatch(source, /drop table/i);
    assert.doesNotMatch(source, /purgeAllAccountRows|api\/vkole\/purge/);
    assert.doesNotMatch(screen, /purgeAllAccountRows|api\/vkole\/purge/);
  });
});
