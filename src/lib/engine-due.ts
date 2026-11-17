import { createServerFn } from "@tanstack/react-start";
import { dueInDays } from "@kirkpatrick/vekole-engine";
import type { Sql } from "@/lib/db";
import { getSql } from "@/lib/db";
import { ensureEngineStore } from "@/lib/engine-store";
import { schoolMiddleware } from "@/lib/school-middleware";
import { accountIdOf, isWebsiteMasterEmail } from "@/lib/school-account";

const DAY_MS = 86_400_000;

export const REVIEWS_DUE_REFUSED = "That request was refused.";

/**
 * Move only the master account's last-practiced times back until each row is due.
 * Strength, counts, and the package rules stay as they are. Any other account,
 * or no account, changes nothing.
 */
export async function makeMasterReviewsDue(
  sql: Sql,
  actor: string | null,
  now = new Date(),
): Promise<{ ok: true; updated: number } | { ok: false }> {
  const email = accountIdOf(String(actor ?? "")).trim().toLowerCase();
  if (!email || !isWebsiteMasterEmail(email)) return { ok: false };
  await ensureEngineStore(sql);
  const rows = await sql<{
    user_id: string;
    child_key: string;
    item_key: string;
    strength_days: number | string;
    last_practiced_at: unknown;
    reviews: number | string;
    misses: number | string;
    known: number | string | null;
  }>`
    select user_id, child_key, item_key, strength_days, last_practiced_at, reviews, misses, known
    from memory_records
    where lower(user_id) = ${email} or lower(user_id) like ${`${email}#student-%`}
  `;
  let updated = 0;
  for (const row of rows) {
    if (accountIdOf(row.user_id).trim().toLowerCase() !== email) continue;
    const strength = Number(row.strength_days);
    if (!Number.isFinite(strength) || strength <= 0) continue;
    const current = new Date(row.last_practiced_at as string);
    const targetMs = now.getTime() - dueInDays(strength) * DAY_MS - 1000;
    if (!Number.isFinite(current.getTime()) || current.getTime() <= targetMs) continue;
    await sql`
      update memory_records
      set last_practiced_at = ${new Date(targetMs).toISOString()}
      where user_id = ${row.user_id} and child_key = ${row.child_key} and item_key = ${row.item_key}
    `;
    updated += 1;
  }
  return { ok: true, updated };
}

export const makeReviewsDueNow = createServerFn({ method: "POST" })
  .middleware([schoolMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const result = await makeMasterReviewsDue(sql, context.userId);
    if (!result.ok) return { ok: false as const, error: REVIEWS_DUE_REFUSED };
    return result;
  });
