import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { SCHOOL_ACCOUNT_GONE_MESSAGE } from "./school-account.ts";
import {
  ACCOUNT_GONE_FLAG,
  SIGN_IN_COOKIES,
  clearKeyStore,
  expiredCookie,
  isAccountGoneError,
  matchingStaleKeys,
} from "./account-purge.ts";
import {
  adminEmailList,
  forgetLocalAccount,
  handleAccountPurge,
  purgeAllAccountRows,
  secretMatches,
} from "./account-purge.server.ts";
import type { Sql } from "./db.ts";

const SECRET = "unit-test-secret-do-not-ship";

function memoryStore(initial: string[]) {
  const keys = [...initial];
  return {
    get length() {
      return keys.length;
    },
    key(index: number) {
      return keys[index] ?? null;
    },
    removeItem(key: string) {
      const at = keys.indexOf(key);
      if (at >= 0) keys.splice(at, 1);
    },
    keys,
  };
}

function fakeSql(present: string[]) {
  const calls: { text: string; params: unknown[] }[] = [];
  const installed = new Set(present);
  const query = async <T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> => {
    calls.push({ text, params });
    if (text.includes("to_regclass")) {
      const name = String(params[0]);
      return [{ name: installed.has(name) ? name : null }] as T[];
    }
    if (text.includes("count(*)")) return [{ n: 2 }] as T[];
    if (text.includes('from "user" where')) {
      return [{ id: "old-id", email: "parent@example.com" }] as T[];
    }
    return [] as T[];
  };
  const sql = Object.assign(query, { query }) as unknown as Sql;
  return { sql, calls };
}

describe("device sign-in cache", () => {
  it("names the session cookie and the screen flags, and no localStorage account today", () => {
    assert.ok(SIGN_IN_COOKIES.some((cookie) => cookie.name === "__Host-grok-auth.session_token" && cookie.httpOnly));
    assert.ok(SIGN_IN_COOKIES.some((cookie) => cookie.name === "vkole_choose_account" && !cookie.httpOnly));
    assert.deepEqual(matchingStaleKeys(["vkole-unpaid", "grok-auth.bearer-token", "other"]), [
      "vkole-unpaid",
      "grok-auth.bearer-token",
    ]);
    assert.equal(expiredCookie("vkole_choose_account").includes("Max-Age=0"), true);
    assert.equal(ACCOUNT_GONE_FLAG.startsWith("vkole-"), true);
  });

  it("removes cached sign-in keys from a store", () => {
    const store = memoryStore(["vkole-last-mail", "theme", "grok-auth.bearer-token"]);
    assert.deepEqual(clearKeyStore(store), ["vkole-last-mail", "grok-auth.bearer-token"]);
    assert.deepEqual(store.keys, ["theme"]);
  });

  it("recognizes the website-gone error without treating other failures as gone", () => {
    assert.equal(isAccountGoneError(new Error(SCHOOL_ACCOUNT_GONE_MESSAGE)), true);
    assert.equal(isAccountGoneError({ message: SCHOOL_ACCOUNT_GONE_MESSAGE }), true);
    assert.equal(isAccountGoneError(new Error("Email or password did not match.")), false);
    assert.equal(SCHOOL_ACCOUNT_GONE_MESSAGE.includes(SECRET), false);
  });
});

describe("purge guard", () => {
  it("accepts only an exact non-empty secret", () => {
    assert.equal(secretMatches(SECRET, SECRET), true);
    assert.equal(secretMatches(` ${SECRET} `, SECRET), true);
    assert.equal(secretMatches("nope", SECRET), false);
    assert.equal(secretMatches("", SECRET), false);
    assert.equal(secretMatches(SECRET, ""), false);
    assert.equal(secretMatches(SECRET, undefined), false);
    assert.equal(secretMatches("", ""), false);
    assert.deepEqual(adminEmailList(" Sam@School.test, not-an-email, a@b.co "), ["sam@school.test", "a@b.co"]);
  });

  it("does not delete unless the secret or an admin email matches, and the confirm phrase is present", async () => {
    const { sql, calls } = fakeSql(["climbs"]);
    let expired = 0;
    const sessionLookups: number[] = [];
    const refused = await handleAccountPurge(
      new Request("http://local/api/vkole/purge", {
        method: "POST",
        headers: { "x-vkole-secret": "wrong-secret" },
        body: JSON.stringify({ confirm: "delete-all-accounts" }),
      }),
      {
        expectedSecret: SECRET,
        adminEmails: ["sam@school.test"],
        lookupSession: async () => {
          sessionLookups.push(1);
          return "parent@example.com";
        },
        loadSql: async () => sql,
        expireCookies: async () => {
          expired += 1;
        },
      },
    );
    assert.equal(refused.status, 401);
    assert.equal(JSON.stringify(await refused.clone().json()).includes(SECRET), false);
    assert.equal(JSON.stringify(await refused.json()).includes("wrong-secret"), false);
    assert.equal(calls.length, 0);
    assert.equal(expired, 0);
    assert.equal(sessionLookups.length, 1);

    const unconfirmed = await handleAccountPurge(
      new Request("http://local/api/vkole/purge", {
        method: "POST",
        headers: { "x-vkole-secret": SECRET },
        body: JSON.stringify({ confirm: "no" }),
      }),
      {
        expectedSecret: SECRET,
        loadSql: async () => sql,
        lookupSession: async () => {
          throw new Error("session lookup should not run");
        },
      },
    );
    assert.equal(unconfirmed.status, 400);
    assert.equal(calls.length, 0);

    const cleared = await handleAccountPurge(
      new Request("http://local/api/vkole/purge", {
        method: "POST",
        headers: { "x-vkole-secret": SECRET },
        body: JSON.stringify({ confirm: "delete-all-accounts" }),
      }),
      {
        expectedSecret: SECRET,
        loadSql: async () => sql,
        expireCookies: async () => {
          expired += 1;
        },
      },
    );
    assert.equal(cleared.status, 200);
    const body = (await cleared.json()) as { ok: boolean; cleared: Record<string, number> };
    assert.equal(body.ok, true);
    assert.equal(body.cleared.climbs, 2);
    assert.equal(JSON.stringify(body).includes(SECRET), false);
    assert.equal(expired, 1);
    assert.equal(calls.some((call) => call.text.includes("delete from climbs")), true);
    assert.equal(calls.some((call) => call.text.includes("app_mail")), false);
  });

  it("allows a signed-in admin when the secret does not match", async () => {
    const { sql, calls } = fakeSql(["climbs"]);
    const response = await handleAccountPurge(
      new Request("http://local/api/vkole/purge", {
        method: "POST",
        headers: { "x-vkole-secret": "not-the-secret" },
        body: JSON.stringify({ confirm: "delete-all-accounts" }),
      }),
      {
        expectedSecret: SECRET,
        adminEmails: ["sam@school.test"],
        lookupSession: async () => "Sam@School.test",
        loadSql: async () => sql,
        expireCookies: async () => undefined,
      },
    );
    assert.equal(response.status, 200);
    assert.equal(calls.some((call) => call.text.includes("delete from climbs")), true);
    assert.equal(JSON.stringify(await response.json()).includes("not-the-secret"), false);
  });

  it("refuses GET even if the handler is called directly", async () => {
    const response = await handleAccountPurge(new Request("http://local/api/vkole/purge"), {
      expectedSecret: SECRET,
    });
    assert.equal(response.status, 405);
  });
});

describe("row purge", () => {
  it("deletes installed account tables and skips ones that are not there", async () => {
    const { sql, calls } = fakeSql(["climbs", '"user"', "app_trials"]);
    const cleared = await purgeAllAccountRows(sql);
    assert.equal(cleared.climbs, 2);
    assert.equal(cleared.user, 2);
    assert.equal(cleared.app_trials, 2);
    assert.equal(cleared.session, undefined);
    const deletes = calls.filter((call) => call.text.includes("delete from")).map((call) => call.text);
    assert.equal(deletes.some((text) => text.includes("app_mail")), false);
    assert.equal(deletes.at(-1)?.includes('delete from "user"'), true);
  });

  it("deletes one parent by id and email without putting the address into the SQL text", async () => {
    const { sql, calls } = fakeSql(['"user"', "climbs", "school_mirror", '"session"', '"verification"', "registrations"]);
    const cleared = await forgetLocalAccount(sql, "Parent@Example.com");
    assert.ok((cleared.climbs ?? 0) > 0);
    assert.ok((cleared.user ?? 0) > 0);
    assert.equal(
      calls.some((call) => call.text.includes("Parent@Example.com") || call.text.includes("parent@example.com")),
      false,
    );
    assert.ok(calls.some((call) => call.params.includes("parent@example.com")));
    assert.ok(calls.some((call) => call.params.includes("old-id")));
    assert.ok(calls.some((call) => call.params.includes("vkole-reset:parent@example.com")));
  });

  it("clears real rows in an embedded database and leaves the schema in place", async () => {
    const pg = new PGlite();
    await pg.waitReady;
    await pg.exec(`
      create table "user" ("id" text primary key, "email" text, "name" text);
      create table "session" ("id" text primary key, "userId" text);
      create table "account" ("id" text primary key, "userId" text);
      create table "verification" ("id" text primary key, "identifier" text);
      create table climbs (id text primary key, user_id text, child_name text, level integer);
      create table app_trials (user_id text, subject text);
      create table school_mirror (user_id text primary key, levels text);
    `);
    await pg.query(
      `insert into "user" ("id", "email", "name") values ('parent@example.com', 'parent@example.com', 'Ada')`,
    );
    await pg.query(`insert into "session" ("id", "userId") values ('s1', 'parent@example.com')`);
    await pg.query(
      `insert into climbs (id, user_id, child_name, level) values ('c1', 'parent@example.com', 'Ada', 4)`,
    );
    await pg.query(`insert into app_trials (user_id, subject) values ('parent@example.com', 'app')`);
    await pg.query(
      `insert into school_mirror (user_id, levels) values ('parent@example.com', '{"m":{"grade":4,"step":1}}')`,
    );
    await pg.query(
      `insert into "verification" ("id", "identifier") values ('v1', 'vkole-reset:parent@example.com')`,
    );

    const query = async <T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> => {
      const result = await pg.query<T>(text, params);
      return result.rows;
    };
    const sql = Object.assign(query, { query }) as unknown as Sql;

    const one = await forgetLocalAccount(sql, "parent@example.com");
    assert.equal(one.climbs, 1);
    assert.equal(one.user, 1);
    assert.equal(one.app_trials, 1);
    const left = await pg.query<{ n: number }>("select count(*)::int as n from climbs");
    assert.equal(Number(left.rows[0]?.n), 0);
    const users = await pg.query<{ n: number }>('select count(*)::int as n from "user"');
    assert.equal(Number(users.rows[0]?.n), 0);
    const stillThere = await pg.query<{ name: string | null }>("select to_regclass('climbs') as name");
    assert.equal(Boolean(stillThere.rows[0]?.name), true);

    await pg.query(
      `insert into "user" ("id", "email", "name") values ('other@example.com', 'other@example.com', 'Bea')`,
    );
    await pg.query(`insert into climbs (id, user_id, child_name, level) values ('c2', 'other@example.com', 'Bea', 2)`);
    const all = await purgeAllAccountRows(sql);
    assert.equal(all.climbs, 1);
    assert.equal(all.user, 1);
    const after = await pg.query<{ n: number }>("select count(*)::int as n from climbs");
    assert.equal(Number(after.rows[0]?.n), 0);
    await pg.close();
  });
});
