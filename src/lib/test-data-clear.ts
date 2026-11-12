/**
 * Master-only clear of this app's copied family records.
 * Safe to import from the browser: no secret and no database call.
 * The server checks the signed-in account again before it counts or deletes.
 */
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { isWebsiteMasterEmail } from "@/lib/school-account";

/** Typed exactly, as the website asks for CLEAR ACCOUNTS. */
export const CLEAR_TEST_DATA_PHRASE = "CLEAR TEST DATA";

export const ONLY_MASTER_MESSAGE = "Only the master account can clear test data.";

export const TYPE_PHRASE_MESSAGE = "Type CLEAR TEST DATA to confirm.";

/**
 * Family records this clear may count and delete.
 * Names are a fixed list. A request cannot choose a table.
 * Operator settings (`app_settings`) and the operator mailbox (`app_mail`) are not here.
 */
export const CLEAR_TABLES = [
  { key: "users", label: "users", sqlName: '"user"', regclass: '"user"', match: "user" },
  { key: "sessions", label: "sessions", sqlName: '"session"', regclass: '"session"', match: "session" },
  { key: "climbs", label: "climbs", sqlName: "climbs", regclass: "climbs", match: "user_id" },
  { key: "sittings", label: "sittings", sqlName: "climb_sittings", regclass: "climb_sittings", match: "user_id" },
  { key: "day_clocks", label: "day clocks", sqlName: "day_clocks", regclass: "day_clocks", match: "user_id" },
  { key: "seen_prompts", label: "seen prompts", sqlName: "seen_prompts", regclass: "seen_prompts", match: "user_id" },
  { key: "question_bags", label: "question bags", sqlName: "question_bags", regclass: "question_bags", match: "user_id" },
  { key: "mail", label: "mail", sqlName: "academic_mail", regclass: "academic_mail", match: "user_id" },
  { key: "trials", label: "trials", sqlName: "app_trials", regclass: "app_trials", match: "user_id" },
  { key: "assignments", label: "assignments", sqlName: "assignment_sheets", regclass: "assignment_sheets", match: "user_id" },
  { key: "cached_accounts", label: "cached account copies", sqlName: "school_mirror", regclass: "school_mirror", match: "user_id" },
  { key: "events", label: "climb events", sqlName: "climb_events", regclass: "climb_events", match: "user_id" },
  { key: "subscriptions", label: "subscriptions", sqlName: "app_subscriptions", regclass: "app_subscriptions", match: "user_id" },
  { key: "logins", label: "parent logins", sqlName: "parent_logins", regclass: "parent_logins", match: "both" },
  { key: "payments", label: "payments", sqlName: "payments", regclass: "payments", match: "both" },
  { key: "student_passwords", label: "student passwords", sqlName: "student_passwords", regclass: "student_passwords", match: "user_id" },
  { key: "registrations", label: "registrations", sqlName: "registrations", regclass: "registrations", match: "email" },
  { key: "sign_in_accounts", label: "sign-in accounts", sqlName: '"account"', regclass: '"account"', match: "account" },
  { key: "verification", label: "verification", sqlName: '"verification"', regclass: '"verification"', match: "verification" },
] as const;

export type ClearTableKey = (typeof CLEAR_TABLES)[number]["key"];

export type TestDataCounts = Record<ClearTableKey, number> & { students: number };

export type TestDataView =
  | { ok: false }
  | { ok: true; counts: TestDataCounts; students: string[]; at: string };

export type TestDataClear =
  | { ok: false; error: string }
  | {
      ok: true;
      before: TestDataCounts;
      after: TestDataCounts;
      studentsBefore: string[];
      studentsAfter: string[];
      at: string;
    };

export function mayClearTestData(email: string | null | undefined, masterRaw?: string | null): boolean {
  return isWebsiteMasterEmail(email ?? "", masterRaw);
}

export function phraseMatches(typed: string): boolean {
  return typed.trim() === CLEAR_TEST_DATA_PHRASE;
}

/** Clock time in Pacific, the same zone the school day uses. */
export function clearedAt(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")} ${read("hour")}:${read("minute")} PT`;
}

function readPhrase(data: unknown): { confirmation: string } {
  if (!data || typeof data !== "object") return { confirmation: "" };
  const confirmation = (data as { confirmation?: unknown }).confirmation;
  return { confirmation: typeof confirmation === "string" ? confirmation : "" };
}

/** Step 1. Counts only. Does not delete. */
export const readTestDataCounts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<TestDataView> => {
    const { getSql } = await import("./db");
    const { showTestDataCounts } = await import("./test-data-clear.server");
    return showTestDataCounts(await getSql(), context.userId, process.env.VKOLE_MASTER_EMAIL);
  });

/** Step 2. Deletes records only after the master types the phrase. */
export const clearTestData = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(readPhrase)
  .handler(async ({ context, data }): Promise<TestDataClear> => {
    const { getSql } = await import("./db");
    const { confirmClearTestData } = await import("./test-data-clear.server");
    return confirmClearTestData(
      await getSql(),
      context.userId,
      data.confirmation,
      process.env.VKOLE_MASTER_EMAIL,
    );
  });
