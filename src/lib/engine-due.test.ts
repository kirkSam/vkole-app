import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { dueInDays } from "@kirkpatrick/vekole-engine";
import type { Sql } from "./db.ts";
import { makeMasterReviewsDue } from "./engine-due.ts";
import { ensureEngineStore } from "./engine-store.ts";
import { websiteMasterEmail } from "./school-account.ts";

const DAY_MS = 86_400_000;

async function database(): Promise<{ sql: Sql; pg: PGlite }> {
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
  return { sql, pg };
}

describe("make my reviews due now", () => {
  it("refuses a signed-out request and any other account, and leaves every row", async () => {
    const { sql, pg } = await database();
    const practiced = "2026-11-17T12:00:00.000Z";
    await pg.query(
      `insert into memory_records (user_id, child_key, item_key, strength_days, last_practiced_at, reviews, misses, known)
       values ('other@example.com', 'ada', 'm:3:0:1', 4.5, $1, 2, 1, 0),
              ($2, 'sam', 'm:4:1:2', 11.25, $1, 3, 0, 0)`,
      [practiced, websiteMasterEmail()],
    );
    const signedOut = await makeMasterReviewsDue(sql, "");
    assert.equal(signedOut.ok, false);
    const stranger = await makeMasterReviewsDue(sql, "other@example.com");
    assert.equal(stranger.ok, false);
    const strangerChild = await makeMasterReviewsDue(sql, "other@example.com#student-2");
    assert.equal(strangerChild.ok, false);
    const rows = await pg.query<{ user_id: string; strength_days: number; reviews: number; misses: number; last_practiced_at: string }>(
      "select user_id, strength_days, reviews, misses, last_practiced_at from memory_records order by user_id",
    );
    assert.equal(rows.rows.length, 2);
    for (const row of rows.rows) {
      assert.equal(new Date(row.last_practiced_at).toISOString(), practiced);
    }
    assert.equal(Number(rows.rows.find((row) => row.user_id === "other@example.com")?.strength_days), 4.5);
    assert.equal(Number(rows.rows.find((row) => row.user_id === "other@example.com")?.reviews), 2);
  });

  it("moves only the master account's last-practiced time, not strength or counts", async () => {
    const { sql, pg } = await database();
    const now = new Date("2026-11-17T20:00:00.000Z");
    const practiced = "2026-11-17T12:00:00.000Z";
    const master = websiteMasterEmail();
    await pg.query(
      `insert into memory_records (user_id, child_key, item_key, strength_days, last_practiced_at, reviews, misses, known)
       values ($1, 'sam', 'm:4:1:2', 11.25, $2, 3, 0, 1),
              ('other@example.com', 'ada', 'm:3:0:1', 4.5, $2, 2, 1, 0)`,
      [master, practiced],
    );
    const result = await makeMasterReviewsDue(sql, `${master}#student-2`, now);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.updated, 1);
    const rows = await pg.query<{ user_id: string; strength_days: number; reviews: number; misses: number; known: number; last_practiced_at: string }>(
      "select user_id, strength_days, reviews, misses, known, last_practiced_at from memory_records order by user_id",
    );
    const mine = rows.rows.find((row) => row.user_id === master);
    const other = rows.rows.find((row) => row.user_id === "other@example.com");
    assert.ok(mine);
    assert.equal(Number(mine?.strength_days), 11.25);
    assert.equal(Number(mine?.reviews), 3);
    assert.equal(Number(mine?.misses), 0);
    assert.equal(Number(mine?.known), 1);
    const target = now.getTime() - dueInDays(11.25) * DAY_MS - 1000;
    assert.ok(Math.abs(new Date(mine?.last_practiced_at ?? "").getTime() - target) < 2);
    assert.equal(new Date(other?.last_practiced_at ?? "").toISOString(), practiced);
    assert.equal(Number(other?.strength_days), 4.5);
    assert.equal(Number(other?.reviews), 2);
  });
});
