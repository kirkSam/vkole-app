import { randomBytes } from "node:crypto";
import { setCookie } from "@tanstack/react-start/server";
import { auth, SESSION_TOKEN_COOKIE } from "@/lib/auth/server";
import { getSql, type Sql } from "@/lib/db";
import { isSchoolAccountId } from "@/lib/school-account";

const SESSION_SECONDS = 60 * 60 * 24 * 7;

/** Match Better Auth's signed session cookie: HMAC-SHA256, base64, token.signature. */
export async function signSessionToken(token: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const raw = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(token));
  const signature = btoa(String.fromCharCode(...new Uint8Array(raw)));
  return `${token}.${signature}`;
}

async function moveRows(sql: Sql, fromId: string, toId: string): Promise<void> {
  const plain = [
    "climbs",
    "climb_events",
    "climb_sittings",
    "assignment_sheets",
    "payments",
    "parent_logins",
    "academic_mail",
  ];
  for (const table of plain) {
    await sql.query(`update ${table} set user_id = $1 where user_id = $2`, [toId, fromId]);
  }
  await sql`
    insert into app_trials (user_id, subject, started_at)
    select ${toId}, subject, started_at from app_trials where user_id = ${fromId}
    on conflict (user_id, subject) do update
    set started_at = least(app_trials.started_at, excluded.started_at)
  `;
  await sql`delete from app_trials where user_id = ${fromId}`;
  await sql`
    insert into day_clocks (user_id, child_key, day_key, used_seconds, last_tick_at, armed, time_zone)
    select ${toId}, child_key, day_key, used_seconds, last_tick_at, armed, time_zone
    from day_clocks where user_id = ${fromId}
    on conflict (user_id, child_key, day_key) do update
    set used_seconds = greatest(day_clocks.used_seconds, excluded.used_seconds)
  `;
  await sql`delete from day_clocks where user_id = ${fromId}`;
  await sql`
    insert into seen_prompts (user_id, child_key, prompt_key, seen_at, prompt_text)
    select ${toId}, child_key, prompt_key, seen_at, prompt_text
    from seen_prompts where user_id = ${fromId}
    on conflict (user_id, child_key, prompt_key) do nothing
  `;
  await sql`delete from seen_prompts where user_id = ${fromId}`;
  await sql`
    insert into question_bags (user_id, child_key, pool_key, remaining)
    select ${toId}, child_key, pool_key, remaining
    from question_bags where user_id = ${fromId}
    on conflict (user_id, child_key, pool_key) do nothing
  `;
  await sql`delete from question_bags where user_id = ${fromId}`;
  await sql`
    insert into student_passwords (user_id, child_key, password_hash)
    select ${toId}, child_key, password_hash
    from student_passwords where user_id = ${fromId}
    on conflict (user_id, child_key) do nothing
  `;
  await sql`delete from student_passwords where user_id = ${fromId}`;
  await sql`
    insert into app_subscriptions (user_id, subject, detail, created_at)
    select ${toId}, subject, detail, created_at from app_subscriptions where user_id = ${fromId}
    on conflict (user_id, subject) do nothing
  `;
  await sql`delete from app_subscriptions where user_id = ${fromId}`;
}

/** Point an older app-only user id at the website account id, which is the email. */
export async function adoptLocalAccount(sql: Sql, email: string): Promise<void> {
  const id = email.trim().toLowerCase();
  if (!isSchoolAccountId(id)) return;
  const existing = await sql<{ id: string }>`
    select "id" from "user" where lower("email") = ${id} and "id" <> ${id}
  `;
  for (const row of existing) {
    await moveRows(sql, row.id, id);
    await sql`delete from "session" where "userId" = ${row.id}`;
    await sql`delete from "account" where "userId" = ${row.id}`;
    await sql`delete from "user" where "id" = ${row.id}`;
  }
}

export async function openSchoolSession(email: string, name: string): Promise<string> {
  const id = email.trim().toLowerCase();
  if (!isSchoolAccountId(id)) throw new Error("The school account id has to be the parent email.");
  const sql = await getSql();
  await adoptLocalAccount(sql, id);
  const label = name.trim() || "Parent";
  await sql`
    insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
    values (${id}, ${label}, ${id}, true, now(), now())
    on conflict ("id") do update
    set "name" = excluded."name", "email" = excluded."email", "updatedAt" = now()
  `;
  const linked = await sql<{ id: string }>`
    select "id" from "account" where "userId" = ${id} and "providerId" = 'school' limit 1
  `;
  if (!linked[0]) {
    await sql`
      insert into "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
      values (${crypto.randomUUID()}, ${id}, 'school', ${id}, null, now(), now())
    `;
  }
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
  await sql`
    insert into "session" ("id", "expiresAt", "token", "createdAt", "updatedAt", "userId")
    values (${crypto.randomUUID()}, ${expires}, ${token}, now(), now(), ${id})
  `;
  const ctx = await auth.$context;
  const signed = await signSessionToken(token, ctx.secret);
  const cookie = {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    maxAge: SESSION_SECONDS,
  };
  setCookie(SESSION_TOKEN_COOKIE, signed, cookie);
  setCookie("__Host-grok-auth.session_data", "", { ...cookie, maxAge: 0 });
  return token;
}

export async function localEmailExists(email: string): Promise<boolean> {
  const id = email.trim().toLowerCase();
  const sql = await getSql();
  const rows = await sql<{ id: string }>`
    select "id" from "user" where lower("email") = ${id} limit 1
  `;
  return Boolean(rows[0]);
}

/**
 * CLAUDE: true when this email already has a LOCAL (Better Auth email/password)
 * account -- not just any "user" row (a website-linked row also has one, see
 * `openSchoolSession` above, which is why `localEmailExists` alone isn't
 * precise enough here). Used by `schoolSignIn` to decide whether to check
 * the password locally or ask the website, per Sam's and the App Builder's
 * explicit direction: "look locally first only when that email already has
 * a local password... If the email is not a local account, sign in through
 * the website exactly as today."
 */
export async function localCredentialAccountExists(email: string): Promise<boolean> {
  const id = email.trim().toLowerCase();
  const sql = await getSql();
  const rows = await sql<{ id: string }>`
    select "account"."id"
    from "account"
    join "user" on "user"."id" = "account"."userId"
    where lower("user"."email") = ${id} and "account"."providerId" = 'credential'
    limit 1
  `;
  return Boolean(rows[0]);
}

// CLAUDE: added "local" -- a brand-new Better Auth email/password account.
// Before this, its id (a random Better Auth id, not an email) and its email
// on the "user" row made it indistinguishable from a genuine old leftover
// row, so it was wrongly classified "legacy" and blocked with "Set the
// password through the school reset" -- a real bug fixed by checking for a
// `providerId = 'credential'` account row (how a local email/password
// account is actually marked) BEFORE falling through to the legacy check.
export async function separateSignIn(userId: string): Promise<"school" | "legacy" | "separate" | "dev" | "local"> {
  if (userId === "dev-user") return "dev";
  if (isSchoolAccountId(userId)) return "school";
  const sql = await getSql();
  const accounts = await sql<{ providerId: string }>`
    select "providerId" from "account" where "userId" = ${userId}
  `;
  const separate = accounts.some((row) => row.providerId.startsWith("grok-") || row.providerId === "grok-gate");
  if (separate) return "separate";
  const local = accounts.some((row) => row.providerId === "credential");
  if (local) return "local";
  const users = await sql<{ email: string | null }>`select "email" from "user" where "id" = ${userId} limit 1`;
  if (users[0]?.email) return "legacy";
  return "separate";
}
