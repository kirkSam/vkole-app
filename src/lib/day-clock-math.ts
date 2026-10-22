import { APP_NAME, SCHOOL_EMAIL } from "@/lib/brand";

/**
 * Stored when a website clock omits a limit.
 * It does not cap seconds, reset at midnight, or close an engine.
 */
export const DAY_LIMIT_SECONDS = 8 * 60 * 60;
export const IDLE_STOP_SECONDS = 5 * 60;
export const PACIFIC = "America/Los_Angeles";

export const VKOLE_RULES = `${APP_NAME} uses one short call to grade the answer and write the next question. Price stays: one week free, then $9.00 USD plus tax a month, or $79.00 USD plus tax a year. 2 students per account. It auto-renews until cancelled by email at ${SCHOOL_EMAIL}.`;

export type ClockProjection = {
  used: number;
  remaining: number;
  closed: boolean;
  armed: boolean;
  idleStopped: boolean;
};

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function localDayKey(timeZone: string, now = new Date()): string {
  let zone = timeZone.trim() || "UTC";
  try {
    Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(now);
  } catch {
    zone = "UTC";
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/**
 * Seconds already recorded for this student.
 * A row from another Pacific day still counts. Nothing here closes an engine.
 */
export function projectTodayClock(
  row:
    | { day_key?: string | null; used_seconds?: number | string | null; last_tick_at?: unknown; armed?: unknown }
    | undefined,
  today = localDayKey(PACIFIC),
  now = Date.now(),
  limit = DAY_LIMIT_SECONDS,
): ClockProjection {
  void today;
  return projectClock(row, now, limit);
}

export function projectClock(
  row:
    { used_seconds?: number | string | null; last_tick_at?: unknown; armed?: unknown } | undefined,
  now = Date.now(),
  limit = DAY_LIMIT_SECONDS,
): ClockProjection {
  void limit;
  if (!row) {
    return {
      used: 0,
      remaining: 0,
      closed: false,
      armed: false,
      idleStopped: false,
    };
  }
  let used = Number(row.used_seconds) || 0;
  let armed = row.armed === true || row.armed === 1 || row.armed === "1" || row.armed === "t";
  let idleStopped = false;
  if (armed && row.last_tick_at) {
    const tick = new Date(String(row.last_tick_at)).getTime();
    const gap = Number.isNaN(tick) ? IDLE_STOP_SECONDS : Math.max(0, (now - tick) / 1000);
    if (gap >= IDLE_STOP_SECONDS) {
      armed = false;
      idleStopped = true;
    } else {
      used += gap;
    }
  }
  used = Math.max(0, Math.floor(used));
  return { used, remaining: 0, closed: false, armed, idleStopped };
}
