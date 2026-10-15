/**
 * School website account contract. Safe to import from the browser:
 * no secret, no network call.
 *
 * The app server POSTs to https://www.dotheimpossible.ai/api/vkole/*
 * with header X-Vkole-Secret. The browser never calls those routes.
 * The account id is the lowercase parent email.
 */

export const SCHOOL_ORIGIN = "https://www.dotheimpossible.ai";
export const SCHOOL_ENGINE_URL = `${SCHOOL_ORIGIN}/engine`;

export const SCHOOL_OFFLINE_MESSAGE =
  "The school website could not be reached. Sign-in, the level, the free week, the clock, and question history stay on the school account. Try again in a moment.";

export const SCHOOL_LEGACY_MESSAGE =
  "This email is already on the app. Set the password through the school reset. A code will be emailed only to that address. Then sign in here with the new password.";

export const SCHOOL_SEPARATE_MESSAGE =
  "Google and X are separate from the school account. Sign in with the parent email and password.";

export const SCHOOL_WAIT_MESSAGE =
  "Too many sign-in tries. Wait 15 minutes, then try again.";

export const CLOCK_LIMIT_SECONDS = 9000;

export const ENGINE_IDS = ["m", "ela", "ss", "gen"] as const;
export type EngineId = (typeof ENGINE_IDS)[number];

export type EngineLevel = { grade: number; step: number };

export type SeenQuestion = { key: string; text: string };

export type SchoolProfile = {
  access: "open" | "closed";
  studentName: string;
  level: Partial<Record<EngineId, EngineLevel>>;
  freeWeekStart: string | null;
  clockSeconds: number;
  seen: SeenQuestion[];
  plan: "month" | "year" | null;
};

export type SchoolFailure = "offline" | "wait" | "unknown" | "password" | "exists" | "rejected";

export function isSchoolAccountId(id: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id) && id === id.toLowerCase();
}

export function schoolScreen(message: string): "offline" | "legacy" | "separate" | "wait" | null {
  if (message === SCHOOL_OFFLINE_MESSAGE) return "offline";
  if (message === SCHOOL_LEGACY_MESSAGE) return "legacy";
  if (message === SCHOOL_SEPARATE_MESSAGE) return "separate";
  if (message === SCHOOL_WAIT_MESSAGE) return "wait";
  return null;
}

export function clockToWrite(localSeconds: number, remoteSeconds: number): number {
  const value = Math.max(0, Math.floor(localSeconds) || 0, Math.floor(remoteSeconds) || 0);
  return Math.min(CLOCK_LIMIT_SECONDS, value);
}

function isEngine(value: string): value is EngineId {
  return (ENGINE_IDS as readonly string[]).includes(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asLevel(value: unknown): EngineLevel | null {
  if (typeof value === "number" && value >= 1 && value <= 12) {
    return { grade: Math.round(value), step: 0 };
  }
  const row = asRecord(value);
  if (!row) return null;
  const grade = Number(row.grade ?? row.level);
  const step = Number(row.step ?? row.standardStep ?? 0);
  if (!Number.isInteger(grade) || grade < 1 || grade > 12) return null;
  return { grade, step: Math.min(2, Math.max(0, Number.isFinite(step) ? Math.round(step) : 0)) };
}

function asSeen(value: unknown): SeenQuestion[] {
  if (!Array.isArray(value)) return [];
  const seen: SeenQuestion[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      const text = item.trim();
      if (text) seen.push({ key: text, text });
      continue;
    }
    const row = asRecord(item);
    if (!row) continue;
    const key = String(row.key ?? row.id ?? row.prompt ?? "").trim();
    const text = String(row.text ?? row.prompt ?? row.question ?? key).trim();
    if (!key && !text) continue;
    seen.push({ key: key || text, text: text || key });
  }
  return seen.slice(0, 400);
}

function asPlan(value: unknown): "month" | "year" | null {
  const row = asRecord(value);
  const raw = typeof value === "string" ? value : String(row?.plan ?? row?.detail ?? row?.status ?? "");
  if (raw === "year" || raw === "month") return raw;
  return null;
}

function asAccess(value: unknown, plan: "month" | "year" | null): "open" | "closed" {
  if (value === "open" || value === "closed") return value;
  return plan ? "open" : "closed";
}

/** Read a register, sign-in, or read payload. Missing access stays closed. */
export function parseSchoolProfile(body: unknown): { id: string; profile: SchoolProfile } | null {
  const root = asRecord(body);
  if (!root || root.ok === false) return null;
  const profile = asRecord(root.profile) ?? root;
  const id = String(root.id ?? profile.id ?? profile.email ?? "").trim().toLowerCase();
  if (!isSchoolAccountId(id)) return null;
  const student = profile.student;
  const studentName =
    typeof student === "string"
      ? student.trim()
      : String(asRecord(student)?.name ?? profile.studentName ?? "").trim();
  const levelSource = asRecord(profile.level) ?? asRecord(profile.levels) ?? {};
  const level: Partial<Record<EngineId, EngineLevel>> = {};
  for (const [key, value] of Object.entries(levelSource)) {
    if (!isEngine(key)) continue;
    const parsed = asLevel(value);
    if (parsed) level[key] = parsed;
  }
  const freeRaw = profile.freeWeekStart ?? profile.freeWeek ?? profile.trialStartedAt ?? null;
  const freeWeekStart = typeof freeRaw === "string" && !Number.isNaN(Date.parse(freeRaw)) ? new Date(freeRaw).toISOString() : null;
  const clockRow = asRecord(profile.clock);
  const clockSeconds = clockToWrite(
    Number(profile.clockSeconds ?? clockRow?.seconds ?? clockRow?.usedSeconds ?? 0),
    0,
  );
  const plan = asPlan(profile.subscription ?? profile.plan);
  return {
    id,
    profile: {
      access: asAccess(profile.access, plan),
      studentName,
      level,
      freeWeekStart,
      clockSeconds,
      seen: asSeen(profile.seen ?? profile.seenQuestions),
      plan,
    },
  };
}

export function schoolWriteBody(
  id: string,
  level: Partial<Record<EngineId, EngineLevel>>,
  localClock: number,
  remoteClock: number,
  seen: SeenQuestion[],
): { id: string; level: Partial<Record<EngineId, EngineLevel>>; clockSeconds: number; seen: SeenQuestion[] } {
  const unique: SeenQuestion[] = [];
  const keys = new Set<string>();
  for (const item of seen) {
    const key = item.key.trim();
    const text = item.text.trim();
    if (!key || keys.has(key)) continue;
    keys.add(key);
    unique.push({ key, text: text || key });
    if (unique.length >= 400) break;
  }
  return {
    id,
    level,
    clockSeconds: clockToWrite(localClock, remoteClock),
    seen: unique,
  };
}

export function failureKind(status: number, body: unknown): SchoolFailure {
  if (status === 429) return "wait";
  const row = asRecord(body);
  const text = `${row?.error ?? ""} ${row?.message ?? ""} ${row?.code ?? ""}`.toLowerCase();
  if (row?.wait === true || text.includes("too many") || text.includes("rate")) return "wait";
  if (text.includes("already") || text.includes("exists")) return "exists";
  if (text.includes("not found") || text.includes("unknown") || text.includes("no account")) return "unknown";
  if (text.includes("password") || text.includes("match") || text.includes("invalid")) return "password";
  if (status >= 500 || status === 0) return "offline";
  return "rejected";
}

export function resetCode(body: unknown): { code: string; expiresAt: string } | null {
  const row = asRecord(body);
  if (!row || row.ok === false) return null;
  const code = String(row.code ?? "").trim();
  if (!/^\d{6}$/.test(code)) return null;
  const raw = row.expiresAt ?? row.expiry ?? row.expires;
  const parsed = typeof raw === "string" ? Date.parse(raw) : typeof raw === "number" ? raw : NaN;
  const expiresAt = Number.isNaN(parsed)
    ? new Date(Date.now() + 30 * 60 * 1000).toISOString()
    : new Date(parsed).toISOString();
  return { code, expiresAt };
}
