import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { TRIAL_MS } from "@/lib/academic-email";
import { getSql, type Sql } from "@/lib/db";

/** A renewal is not collected here. The card is not charged, so a finished period stays finished. */
export async function rollRenewals(_sql: Sql, _userId: string): Promise<void> {
  void _sql;
  void _userId;
}

export async function childAccess(
  sql: Sql,
  userId: string,
  childName: string,
): Promise<"open" | "ended" | "extra"> {
  const trials = await sql<{ started_at: unknown }>`
    select started_at from app_trials where user_id = ${userId} and subject = 'app'
  `;
  const started = trials[0] ? new Date(String(trials[0].started_at)).getTime() : Date.now();
  if (Date.now() - started < TRIAL_MS) return "open";
  const subs = await sql<{ seats: number | string | null }>`
    select seats from app_subscriptions
    where user_id = ${userId}
      and subject = 'app'
      and detail in ('month', 'year')
      and expires_at > now()
    limit 1
  `;
  const seats = Number(subs[0]?.seats ?? 0);
  if (!subs[0] || seats < 1) return "ended";
  const names = await sql<{ name: string }>`
    select lower(child_name) as name
    from climbs
    where user_id = ${userId}
    group by lower(child_name)
    order by min(created_at), lower(child_name)
  `;
  const key = childName.trim().toLowerCase();
  const index = names.findIndex((row) => row.name === key);
  if (index === -1) return names.length < seats ? "open" : "extra";
  return index < seats ? "open" : "extra";
}

export const cancelRenewal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql`
      update app_subscriptions
      set renews = false, cancelled_at = now()
      where user_id = ${context.userId}
        and detail in ('month', 'year')
        and renews = true
    `;
    return { ok: true as const };
  });
