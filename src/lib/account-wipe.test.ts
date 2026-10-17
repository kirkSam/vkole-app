import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  ACCOUNT_WIPE_STORAGE_KEY,
  ACCOUNT_WIPE_VERSION,
  accountDataKeys,
  markWipeFlag,
  versionIsCurrent,
  wipeAccountKeys,
  wipeFlagPending,
} from "./account-wipe.ts";
import { signOutBrowserForWipe, wipeStoredAccountsOnce } from "./account-wipe.server.ts";
import type { Sql } from "./db.ts";

function memoryStore(initial: Record<string, string>) {
  const values = { ...initial };
  const keyList = () => Object.keys(values);
  return {
    get length() {
      return keyList().length;
    },
    key(index: number) {
      return keyList()[index] ?? null;
    },
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
    },
    setItem(key: string, value: string) {
      values[key] = value;
    },
    removeItem(key: string) {
      delete values[key];
    },
    values,
  };
}

describe("device account wipe", () => {
  it("drops tokens and child notes and keeps device settings", () => {
    assert.deepEqual(
      accountDataKeys([
        "grok-auth.bearer-token",
        "vkole-last-mail",
        "vkole-parent-logout",
        "vkole-unpaid",
        "vkole-sw-mic",
        "theme",
        ACCOUNT_WIPE_STORAGE_KEY,
      ]),
      ["grok-auth.bearer-token", "vkole-last-mail", "vkole-parent-logout", "vkole-unpaid"],
    );
  });

  it("clears one store once, then leaves a later token in place", () => {
    const session = memoryStore({
      "grok-auth.bearer-token": "preview-token",
      "vkole-sw-mic": "1",
      "vkole-unpaid": "1",
    });
    assert.equal(wipeFlagPending(session), true);
    assert.deepEqual(wipeAccountKeys(session), ["grok-auth.bearer-token", "vkole-unpaid"]);
    assert.equal(session.values["vkole-sw-mic"], "1");
    assert.equal(session.getItem("grok-auth.bearer-token"), null);
    markWipeFlag(session);
    assert.equal(wipeFlagPending(session), false);
    assert.equal(versionIsCurrent(session.getItem(ACCOUNT_WIPE_STORAGE_KEY)), true);
    session.setItem("grok-auth.bearer-token", "new-sign-in");
    // The flag says this tab already wiped, so a later token stays.
    assert.equal(wipeFlagPending(session), false);
    assert.equal(session.getItem("grok-auth.bearer-token"), "new-sign-in");
    assert.equal(session.values["vkole-sw-mic"], "1");
  });

  it("signs a browser out once", async () => {
    let version: string | undefined;
    let expired = 0;
    const first = await signOutBrowserForWipe({
      readVersion: () => version,
      expireSignIn: async () => {
        expired += 1;
      },
      writeVersion: () => {
        version = ACCOUNT_WIPE_VERSION;
      },
    });
    const second = await signOutBrowserForWipe({
      readVersion: () => version,
      expireSignIn: async () => {
        expired += 1;
      },
      writeVersion: () => {
        version = ACCOUNT_WIPE_VERSION;
      },
    });
    assert.equal(first, true);
    assert.equal(second, false);
    assert.equal(expired, 1);
    assert.equal(version, ACCOUNT_WIPE_VERSION);
  });
});

describe("stored account wipe", () => {
  it("deletes account rows once and keeps the mailbox and settings", async () => {
    const pg = new PGlite();
    await pg.waitReady;
    await pg.exec(`
      create table "user" ("id" text primary key, "email" text, "name" text);
      create table "session" ("id" text primary key, "userId" text, token text);
      create table climbs (id text primary key, user_id text, child_name text, level integer);
      create table student_passwords (user_id text, child_key text, password_hash text);
      create table app_mail (id integer primary key, address text not null, secret text not null);
      create table app_settings (key text primary key, value text not null);
    `);
    await pg.query(
      `insert into "user" ("id", "email", "name") values ('parent@example.com', 'parent@example.com', 'Ada')`,
    );
    await pg.query(
      `insert into "session" ("id", "userId", token) values ('s1', 'parent@example.com', 'session-token')`,
    );
    await pg.query(
      `insert into climbs (id, user_id, child_name, level) values ('c1', 'parent@example.com', 'Ada', 4)`,
    );
    await pg.query(
      `insert into student_passwords (user_id, child_key, password_hash) values ('parent@example.com', 'ada', 'hash')`,
    );
    await pg.query(
      `insert into app_mail (id, address, secret) values (1, 'office@example.com', 'mailbox-secret')`,
    );
    await pg.query(`insert into app_settings (key, value) values ('theme', 'paper')`);

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

    const wiped = await wipeStoredAccountsOnce(sql);
    assert.equal(wiped, true);
    const users = await pg.query<{ n: number }>('select count(*)::int as n from "user"');
    const sessions = await pg.query<{ n: number }>('select count(*)::int as n from "session"');
    const climbs = await pg.query<{ n: number }>("select count(*)::int as n from climbs");
    const passwords = await pg.query<{ n: number }>("select count(*)::int as n from student_passwords");
    assert.equal(Number(users.rows[0]?.n), 0);
    assert.equal(Number(sessions.rows[0]?.n), 0);
    assert.equal(Number(climbs.rows[0]?.n), 0);
    assert.equal(Number(passwords.rows[0]?.n), 0);
    const mail = await pg.query<{ secret: string }>("select secret from app_mail where id = 1");
    assert.equal(mail.rows[0]?.secret, "mailbox-secret");
    const theme = await pg.query<{ value: string }>("select value from app_settings where key = 'theme'");
    assert.equal(theme.rows[0]?.value, "paper");
    const flag = await pg.query<{ value: string }>(
      "select value from app_settings where key = 'account_wipe_version'",
    );
    assert.equal(flag.rows[0]?.value, ACCOUNT_WIPE_VERSION);
    const stillThere = await pg.query<{ name: string | null }>("select to_regclass('climbs') as name");
    assert.equal(Boolean(stillThere.rows[0]?.name), true);

    await pg.query(
      `insert into "user" ("id", "email", "name") values ('new@example.com', 'new@example.com', 'Bea')`,
    );
    await pg.query(
      `insert into climbs (id, user_id, child_name, level) values ('c2', 'new@example.com', 'Bea', 2)`,
    );
    const again = await wipeStoredAccountsOnce(sql);
    assert.equal(again, false);
    const keptUsers = await pg.query<{ n: number }>('select count(*)::int as n from "user"');
    const keptClimbs = await pg.query<{ n: number }>("select count(*)::int as n from climbs");
    assert.equal(Number(keptUsers.rows[0]?.n), 1);
    assert.equal(Number(keptClimbs.rows[0]?.n), 1);
    await pg.close();
  });
});
