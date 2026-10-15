import { createServerFn } from "@tanstack/react-start";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { getSql } from "@/lib/db";

const emailSchema = z.object({
  email: z.string().trim().email().max(160),
});

const resetSchema = emailSchema.extend({
  code: z.string().trim().regex(/^\d{6}$/),
  password: z.string().min(8).max(80),
});

const nameSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error("Check the details and try again.");
  return parsed.data;
}

async function sendMail(to: string, subject: string, body: string) {
  const { callTool } = await import("@/lib/app-data/client.server");
  const { ConnectorType } = await import("@/lib/app-data/types");
  const result = await callTool(
    "gmail_send_message",
    { to: [to], subject, body },
    { connectorType: ConnectorType.Gmail },
  );
  if (!result.ok) {
    throw new Error(result.errorMessage || "The email could not be sent.");
  }
}

export const requestPasswordReset = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(emailSchema, data))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const email = data.email.toLowerCase();
    const users = await sql<{ id: string; email: string }>`
      select "id", "email" from "user" where lower("email") = ${email} limit 1
    `;
    const user = users[0];
    if (!user) return { ok: true as const, delivered: true, code: "" };
    const accounts = await sql<{ id: string }>`
      select "id" from "account" where "userId" = ${user.id} and "providerId" = 'credential' limit 1
    `;
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const ident = `vkole-reset:${email}`;
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await sql`delete from "verification" where "identifier" = ${ident}`;
    await sql`
      insert into "verification" ("id", "identifier", "value", "expiresAt", "createdAt", "updatedAt")
      values (${crypto.randomUUID()}, ${ident}, ${code}, ${expires}, now(), now())
    `;
    const body = accounts[0]
      ? `Your VKOLE/ZPD - Space x.AI Integrated Learning Engine password code is ${code}. It expires in 30 minutes. If you did not ask for this, ignore this email.`
      : "This VKOLE/ZPD - Space x.AI Integrated Learning Engine account signs in with Google or X, not a password. Use those buttons on the sign-in page.";
    try {
      await sendMail(user.email, "VKOLE/ZPD - Space x.AI Integrated Learning Engine password code", body);
      return { ok: true as const, delivered: true, code: "" };
    } catch {
      return { ok: true as const, delivered: false, code: accounts[0] ? code : "" };
    }
  });

export const confirmPasswordReset = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(resetSchema, data))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const email = data.email.toLowerCase();
    const ident = `vkole-reset:${email}`;
    const rows = await sql<{ value: string; expiresAt: string | Date }>`
      select "value", "expiresAt" from "verification" where "identifier" = ${ident} limit 1
    `;
    const row = rows[0];
    const expires = row ? new Date(row.expiresAt).getTime() : 0;
    if (!row || row.value !== data.code || expires < Date.now()) {
      throw new Error("That code did not match. Request a new one.");
    }
    const users = await sql<{ id: string }>`
      select "id" from "user" where lower("email") = ${email} limit 1
    `;
    const user = users[0];
    if (!user) throw new Error("That code did not match. Request a new one.");
    const hashed = await hashPassword(data.password);
    const updated = await sql<{ id: string }>`
      update "account"
      set "password" = ${hashed}, "updatedAt" = now()
      where "userId" = ${user.id} and "providerId" = 'credential'
      returning "id"
    `;
    if (!updated[0]) throw new Error("This account signs in with Google or X.");
    await sql`delete from "verification" where "identifier" = ${ident}`;
    return { ok: true as const };
  });

export const requestUsernameReminder = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(nameSchema, data))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const name = data.name.toLowerCase();
    const users = await sql<{ email: string; name: string }>`
      select "email", "name" from "user"
      where lower(trim("name")) = ${name}
      limit 5
    `;
    const sent: string[] = [];
    const shown: string[] = [];
    for (const user of users) {
      try {
        await sendMail(
          user.email,
          "VKOLE/ZPD - Space x.AI Integrated Learning Engine sign-in email",
          `Your sign-in email for VKOLE/ZPD - Space x.AI Integrated Learning Engine is ${user.email}. The username is that email address.`,
        );
        sent.push(user.email);
      } catch {
        shown.push(user.email);
      }
    }
    return { ok: true as const, delivered: shown.length === 0, emails: shown };
  });
