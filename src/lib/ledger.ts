import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { publishedOrigin } from "@/lib/published-origin";

const PLANS = {
  year: 7900,
  month: 900,
} as const;

const OWNER_EMAIL = "kirk.sam.alpha@gmail.com";

async function mailer() {
  return import("@/lib/app-mail");
}

async function mailRegistrationNotice(subject: string, body: string): Promise<"sent" | "confirm" | "failed"> {
  const origin = publishedOrigin() || "https://amber-clover-pixel-ember.grok.me";
  try {
    const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(OWNER_EMAIL)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Origin: origin,
        Referer: `${origin}/`,
      },
      body: JSON.stringify({
        _subject: subject,
        _captcha: "false",
        _template: "box",
        message: body,
      }),
    });
    const text = (await response.text()).toLowerCase();
    if (text.includes("activat") || text.includes("confirm your")) return "confirm";
    if (!response.ok) return "failed";
    return "sent";
  } catch {
    return "failed";
  }
}

async function rememberEmail(sql: Sql, email: string, name = "") {
  const address = email.trim().toLowerCase();
  if (!address) return;
  const named = name.trim();
  const stored = named
    ? named
    : (
        await sql.query<{ name: string | null }>('select "name" from "user" where lower("email") = $1 limit 1', [
          address,
        ])
      )[0]?.name ?? "";
  await sql`
    insert into registrations (email, name)
    values (${address}, ${stored.trim()})
    on conflict (email) do nothing
  `;
}

async function notifyOwner(sql: Sql): Promise<{ sent: boolean; error: string; pending: boolean }> {
  try {
    await sql`alter table registrations add column if not exists notified_at timestamptz`;
    const pendingRows = await sql<{ email: string; name: string; created_at: unknown }>`
      select email, name, created_at from registrations
      where notified_at is null
      order by created_at
    `;
    if (!pendingRows.length) return { sent: false, error: "", pending: false };
    const all = await sql<{ email: string; name: string }>`
      select email, name from registrations order by created_at
    `;
    const lines = (rows: { email: string; name: string }[]) =>
      rows.map((row) => (row.name ? `${row.email} · ${row.name}` : row.email)).join("\n");
    const body = [
      pendingRows.length === 1 ? "A registration for VKOLE/ZPD - Space x.AI Supported Learning Engine was saved." : `${pendingRows.length} registrations for VKOLE/ZPD - Space x.AI Supported Learning Engine were saved.`,
      "",
      "New:",
      lines(pendingRows),
      "",
      "All registrations:",
      lines(all),
      "",
      "Academic reports are not sent to this address. They go only to the email the parent entered.",
    ].join("\n");
    const subject =
      pendingRows.length === 1
        ? `VKOLE/ZPD - Space x.AI Supported Learning Engine registration: ${pendingRows[0]?.email}`
        : `VKOLE/ZPD - Space x.AI Supported Learning Engine registrations: ${pendingRows.length} new`;
    const { sendAppMail } = await mailer();
    const mailed = await sendAppMail(OWNER_EMAIL, subject, body);
    if (mailed === "sent") {
      await sql`
        update registrations
        set notified_at = now()
        where notified_at is null
      `;
      return { sent: true, error: "", pending: false };
    }
    return {
      sent: false,
      error:
        mailed === "rejected"
          ? "The registration is saved. The notice could not be sent to kirk.sam.alpha@gmail.com."
          : "The registration is saved. Gmail is not allowed yet, so the notice was not sent.",
      pending: false,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : "The registration email was not sent.";
    console.error("[vkole] registration notice", error);
    return { sent: false, error, pending: false };
  }
}

async function capturedEmails(sql: Sql) {
  await sql`
    insert into registrations (email, name, created_at)
    select lower("email"), "name", "createdAt" from "user"
    on conflict (email) do nothing
  `;
  return sql<{ email: string; name: string; created_at: unknown }>`
    select email, name, created_at from registrations order by created_at desc
  `;
}
async function emailFor(sql: Sql, userId: string): Promise<string> {
  const rows = await sql.query<{ email: string }>('select "email" from "user" where "id" = $1', [userId]);
  const email = rows[0]?.email?.trim();
  if (!email) throw new Error("This account has no email address.");
  return email;
}

async function summary(sql: Sql, userId: string, email: string) {
  const logins = await sql<{ n: number | string }>`
    select count(*) as n from parent_logins where user_id = ${userId}
  `;
  const payments = await sql<{ n: number | string }>`
    select count(*) as n from payments where user_id = ${userId}
  `;
  const owner = email.trim().toLowerCase() === OWNER_EMAIL;
  const rows = owner ? await capturedEmails(sql) : [];
  const notice = await notifyOwner(sql);
  return {
    email,
    loginCount: Number(logins[0]?.n ?? 0),
    paymentCount: Number(payments[0]?.n ?? 0),
    notice,
    mailAllowed: owner ? await (await mailer()).appMailReady(sql) : false,
    registrations: rows.map((row) => ({
      email: row.email,
      name: row.name,
      at: new Date(String(row.created_at)).toISOString(),
    })),
  };
}

export const noteAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const email = await emailFor(sql, context.userId);
    await rememberEmail(sql, email);
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
    const email = await emailFor(sql, context.userId);
    await rememberEmail(sql, email);
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
    const { saveAppMailPassword, sendAppMail } = await mailer();
    await saveAppMailPassword(sql, email, data.password);
    const sent = await sendAppMail(
      OWNER_EMAIL,
      "VKOLE/ZPD - Space x.AI Supported Learning Engine: Gmail is allowed",
      "Gmail is allowed for this app. Registration notices and student reports can be sent from this account.",
    );
    if (sent !== "sent") throw new Error("That app password was not accepted. Create a new one and try again.");
    return summary(sql, context.userId, email);
  });

export const recordPayment = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const parsed = z.object({ plan: z.enum(["year", "month"]) }).safeParse(data);
    if (!parsed.success) throw new Error("Choose a plan and try again.");
    return parsed.data;
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const email = await emailFor(sql, context.userId);
    const open = await sql<{ detail: string }>`
      select detail from app_subscriptions
      where user_id = ${context.userId}
        and subject = 'app'
        and detail in ('month', 'year')
        and expires_at > now()
      limit 1
    `;
    if (open[0]) {
      return { ...(await summary(sql, context.userId, email)), added: 0, keptEnd: true };
    }
    const children = 1;
    await sql`
      insert into payments (id, user_id, email, plan, amount_cents, status)
      values (
        ${crypto.randomUUID()},
        ${context.userId},
        ${email},
        ${data.plan},
        ${PLANS[data.plan] * children},
        'opened'
      )
    `;
    await sql`
      insert into app_subscriptions (user_id, subject, detail, expires_at, seats)
      values (
        ${context.userId},
        'app',
        ${data.plan},
        now() + case when ${data.plan} = 'year' then interval '1 year' else interval '1 month' end,
        ${children}
      )
      on conflict (user_id, subject) do update
      set detail = excluded.detail,
          created_at = now(),
          expires_at = excluded.expires_at,
          seats = excluded.seats,
          renews = true,
          cancelled_at = null
    `;
    return { ...await summary(sql, context.userId, email), added: children, keptEnd: false };
  });
