import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { accountsVisibleTo, mayAllowAppMail, normalizeAccountEmail } from "@/lib/account-scope";
import { getSql, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { isSchoolAccountId } from "@/lib/school-account";

/** The Gmail form is the mail operator. It is not a list of other families. */
export function canAllowAppMail(email: string): boolean {
  return mayAllowAppMail(email, process.env.VKOLE_MASTER_EMAIL);
}

async function mailer() {
  return import("@/lib/app-mail");
}

async function emailFor(sql: Sql, userId: string): Promise<string> {
  const rows = await sql.query<{ email: string }>('select "email" from "user" where "id" = $1', [userId]);
  const email = rows[0]?.email?.trim();
  if (!email) throw new Error("This account has no email address.");
  return email;
}

/**
 * A brand-new open website account wins over leftover local climbs and login rows.
 * A closed family, or one that already has a saved student or level, keeps them.
 */
async function trustFreshWebsite(sql: Sql, userId: string): Promise<void> {
  if (!isSchoolAccountId(userId)) return;
  try {
    const { clearsLocalProgress } = await import("@/lib/school-account");
    const { readSchoolAccount } = await import("@/lib/school-account.server");
    const { readSchoolMirror } = await import("@/lib/school-mirror.server");
    const profile = await readSchoolAccount(userId);
    if (!clearsLocalProgress(profile, await readSchoolMirror(sql, userId))) return;
    const { clearFreshLocalRows } = await import("@/lib/account-purge.server");
    await clearFreshLocalRows(sql, userId);
  } catch {
    /* The student check reports a failed read. The login count stays local until then. */
  }
}

async function summary(sql: Sql, userId: string, email: string) {
  const logins = await sql<{ n: number | string }>`
    select count(*) as n from parent_logins where user_id = ${userId}
  `;
  const payments = await sql<{ n: number | string }>`
    select count(*) as n from payments where user_id = ${userId}
  `;
  const own = accountsVisibleTo(email, [{ email }]);
  return {
    email: own[0]?.email ?? normalizeAccountEmail(email),
    loginCount: Number(logins[0]?.n ?? 0),
    paymentCount: Number(payments[0]?.n ?? 0),
    notice: { sent: false, error: "", pending: false },
    mailAllowed: canAllowAppMail(email) ? await (await mailer()).appMailReady(sql) : false,
    mailDesk: canAllowAppMail(email),
  };
}

export const noteAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await trustFreshWebsite(sql, context.userId);
    const email = await emailFor(sql, context.userId);
    const existing = await sql<{ id: string }>`
      select id from parent_logins where user_id = ${context.userId} limit 1
    `;
    if (!existing[0]) {
      await sql`
        insert into parent_logins (id, user_id, email, kind)
        values (${crypto.randomUUID()}, ${context.userId}, ${email}, 'open')
      `;
    }
    return summary(sql, context.userId, email);
  });

export const recordLogin = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const parsed = z.object({ kind: z.enum(["sign-in", "sign-up"]) }).safeParse(data);
    if (!parsed.success) throw new Error("Check the sign-in and try again.");
    return parsed.data;
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await trustFreshWebsite(sql, context.userId);
    const email = await emailFor(sql, context.userId);
    await sql`
      insert into parent_logins (id, user_id, email, kind)
      values (${crypto.randomUUID()}, ${context.userId}, ${email}, ${data.kind})
    `;
    await sql`
      insert into app_trials (user_id, subject, started_at)
      values (${context.userId}, 'app', now())
      on conflict (user_id, subject) do nothing
    `;
    return summary(sql, context.userId, email);
  });

export const allowGmail = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const parsed = z.object({ password: z.string().min(8).max(64) }).safeParse(data);
    if (!parsed.success) throw new Error("Paste the app password from Google.");
    return parsed.data;
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const email = await emailFor(sql, context.userId);
    if (!canAllowAppMail(email)) throw new Error("This account cannot change the mail password.");
    const { saveAppMailPassword, sendAppMail } = await mailer();
    await saveAppMailPassword(sql, email, data.password);
    const sent = await sendAppMail(
      email,
      "VKOLE/ZPD - Space XSI Integrated Learning Engine: Gmail is allowed",
      "Gmail is allowed for this app. Student reports can be sent from this account. This note names only this account.",
    );
    if (sent !== "sent") throw new Error("That app password was not accepted. Create a new one and try again.");
    return summary(sql, context.userId, email);
  });
