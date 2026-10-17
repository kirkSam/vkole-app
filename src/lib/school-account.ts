/**
 * School website account contract. Safe to import from the browser:
 * no secret, no network call.
 *
 * The app server POSTs to https://www.dotheimpossible.ai/api/vkole/*
 * with header X-Vkole-Secret. The browser never calls those routes.
 * The account id is the lowercase parent email.
 */

import { normalizeAccountEmail } from "./account-scope.ts";
import { heuristicIdOf, strandIdOf, HEURISTICS, STRANDS, type HeuristicId, type StrandId } from "./vkole-singapore.ts";
import { BAND_LABELS, isSightBand, startBandForGrade, type SightBand } from "./vkole/constants.ts";
import { cardFromAccount as paCardFromAccount, isPaBand, paCard, type PaBand } from "./vkole/phonemic-awareness/items.ts";
import { sightCard } from "./vkole/sight-words/words.ts";

/**
 * The school site's login field. Trailing newlines come off. The rest of the
 * password, including spaces and capital letters, stays as typed.
 */
export function schoolPassword(raw: string): string {
  return String(raw ?? "").replace(/(?:\r\n|\n|\r)+$/, "");
}

/** Used when the website's VKOLE_MASTER_EMAIL is unset. */
export const DEFAULT_WEBSITE_MASTER_EMAIL = "kirksamalpha@dotheimpossible.ai";

/**
 * The website treats VKOLE_MASTER_EMAIL as one address: trim, then lowercase.
 * An empty value uses the built-in address. A comma-separated teacher list is
 * this app's mail list, not that one address, so it keeps the built-in address.
 */
export function websiteMasterEmail(raw?: string | null): string {
  const value = String(raw ?? "").trim().toLowerCase();
  if (!value || value.includes(",")) return DEFAULT_WEBSITE_MASTER_EMAIL;
  return value;
}

export function isWebsiteMasterEmail(email: string, raw?: string | null): boolean {
  const id = normalizeAccountEmail(email);
  const master = normalizeAccountEmail(websiteMasterEmail(raw));
  return id.includes("@") && id === master;
}

export type SchoolAccessDecision = {
  fullAccess: boolean;
  expired: boolean;
  subscribed: boolean;
  blocked: boolean;
  daysLeft: number | null;
  endsAt: string | null;
  showTrialPage: boolean;
};

/**
 * Whether this sign-in is inside a free week, a paid plan, or the master account.
 * The master email never reaches the trial-finished page, even when the website
 * omits access or sends a free week that already ended.
 */
export function schoolAccessDecision(input: {
  email: string;
  access: "open" | "closed" | null;
  freeWeekStart: string | null;
  masterRaw?: string | null;
  now?: number;
}): SchoolAccessDecision {
  const now = input.now ?? Date.now();
  const week = freeWeek(input.freeWeekStart, now);
  if (isWebsiteMasterEmail(input.email, input.masterRaw)) {
    return {
      fullAccess: true,
      expired: false,
      subscribed: true,
      blocked: false,
      daysLeft: null,
      endsAt: null,
      showTrialPage: false,
    };
  }
  if (input.access !== "open") {
    return {
      fullAccess: false,
      expired: true,
      subscribed: false,
      blocked: true,
      daysLeft: 0,
      endsAt: week.endsAt,
      showTrialPage: true,
    };
  }
  const subscribed = week.expired;
  const blocked = week.expired && !subscribed;
  return {
    fullAccess: false,
    expired: week.expired,
    subscribed,
    blocked,
    daysLeft: week.daysLeft,
    endsAt: week.endsAt,
    showTrialPage: blocked,
  };
}

/** Same 7-day window as trialState. Kept here so this file stays free of server aliases. */
function freeWeek(freeWeekStart: string | null, now: number): { endsAt: string; daysLeft: number; expired: boolean } {
  const start = new Date(freeWeekStart ?? new Date(0).toISOString()).getTime();
  const end = start + 7 * 24 * 60 * 60 * 1000;
  const msLeft = end - now;
  return {
    endsAt: new Date(end).toISOString(),
    daysLeft: msLeft <= 0 ? 0 : Math.ceil(msLeft / (24 * 60 * 60 * 1000)),
    expired: msLeft <= 0,
  };
}

export const SCHOOL_ORIGIN = "https://www.dotheimpossible.ai";
export const SCHOOL_ENGINE_URL = `${SCHOOL_ORIGIN}/engine`;

export const SCHOOL_OFFLINE_MESSAGE =
  "The school website could not be reached. Sign-in, the level, the free week, the clock, and question history stay on the school account. Try again in a moment.";

export const SCHOOL_LEGACY_MESSAGE =
  "This email is already on the app. Set the password through the school reset. A code will be emailed only to that address. Then sign in here with the new password.";

export const SCHOOL_SEPARATE_MESSAGE =
  "Sign in with the parent email and password.";

/** Website checkout for the first-month package, which includes a student office. */
export const SCHOOL_FIRST_MONTH_URL = `${SCHOOL_ORIGIN}/pay/checkout?item=first-month`;

export const SCHOOL_WAIT_MESSAGE =
  "Too many sign-in tries. Wait 15 minutes, then try again.";

export const SCHOOL_ACCOUNT_GONE_MESSAGE =
  "This account is no longer on the school website. Sign in again after it is opened there.";

export const CLOCK_LIMIT_SECONDS = 9000;

export const ENGINE_IDS = ["m", "ela", "ss", "gen", "sg", "sw", "pa"] as const;
export type EngineId = (typeof ENGINE_IDS)[number];

/** Website tally. `asked` is stored first. `correct` is never above `asked`. Asked 0 is omitted. */
export type MasteryTally = { asked: number; correct: number };

/**
 * Singapore mastery on level.sg. Strand ids: number, measurement, geometry, data, algebra, calculus.
 * Heuristic ids keep the website's spaces: "bar model", "work backwards", and the rest of that list.
 * A strand or heuristic with no answers is omitted here. The parent report fills the six strands back in.
 */
export type LevelMastery = {
  strands: Partial<Record<StrandId, MasteryTally>>;
  heuristics: Partial<Record<HeuristicId, MasteryTally>>;
};

export type SgFigure =
  | { kind: "bond"; whole: number; left: number; right: number; missing: "left" | "right" | "whole" }
  | { kind: "bar"; whole: number; parts: { label: string; value: number | null }[] };

/** Optional question waiting on the website. Field names match docs/vkole-shared-api.md. */
export type SgPending = {
  prompt: string;
  code: string;
  label: string;
  grade: number;
  answer?: string;
  also?: string[];
  strand?: StrandId;
  heuristic?: HeuristicId;
  figure?: SgFigure;
};

/**
 * One engine on the shared account. level.sg uses these field names with no renaming.
 * Other engines are read for grade and step. A write of sg replaces the stored sg record,
 * so the app sends the whole object.
 */
export type EngineLevel = {
  grade: number;
  step: number;
  id?: string;
  name?: string;
  enteredBy?: string;
  earnedGrade?: number;
  standardId?: string;
  tier?: string;
  simple?: boolean;
  streak?: number;
  missStreak?: number;
  reached?: number;
  missed?: number;
  updatedAt?: number;
  startingGrade?: number;
  levelCode?: string;
  levelLabel?: string;
  pending?: SgPending;
  mastery?: LevelMastery;
  /** Sight words and phonemic awareness. `index` is the item in `band`. `step` stays 0. */
  band?: string;
  index?: number;
  word?: string;
};

export type SeenQuestion = { key: string; text: string };

export type SchoolProfile = {
  access: "open" | "closed";
  studentName: string;
  level: Partial<Record<EngineId, EngineLevel>>;
  freeWeekStart: string | null;
  clockSeconds: number;
  seen: SeenQuestion[];
  plan: "month" | "year" | null;
  /** Missing or non-boolean website values stay false. */
  officePurchased: boolean;
  /** A single path segment, or null when the website sent nothing usable. */
  officeSlug: string | null;
};

export type SchoolFailure = "offline" | "wait" | "unknown" | "password" | "exists" | "rejected" | "gone";

/**
 * A leftover local user row does not make a website account unrecognized.
 * The website's own reason is what sign-in shows. Reset is a separate step
 * the parent chooses, not a block inserted because this app already stored the email.
 */
export function websiteSignInRefusal(reason: SchoolFailure, localRow: boolean): SchoolFailure {
  void localRow;
  return reason;
}

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

function asTally(value: unknown): MasteryTally | null {
  const row = asRecord(value);
  if (!row) return null;
  const asked = Number(row.asked);
  let correct = Number(row.correct);
  if (!Number.isInteger(asked) || !Number.isInteger(correct) || asked < 1 || correct < 0) return null;
  if (correct > asked) correct = asked;
  return { asked, correct };
}

function asMastery(value: unknown): LevelMastery | undefined {
  const row = asRecord(value);
  if (!row) return undefined;
  const strands: Partial<Record<StrandId, MasteryTally>> = {};
  const heuristics: Partial<Record<HeuristicId, MasteryTally>> = {};
  const strandRow = asRecord(row.strands);
  const heuristicRow = asRecord(row.heuristics);
  for (const strand of STRANDS) {
    const tally = asTally(strandRow?.[strand.id]);
    if (tally) strands[strand.id] = tally;
  }
  for (const heuristic of HEURISTICS) {
    const tally = asTally(heuristicRow?.[heuristic.id]);
    if (tally) heuristics[heuristic.id] = tally;
  }
  if (Object.keys(strands).length === 0 && Object.keys(heuristics).length === 0) return undefined;
  return { strands, heuristics };
}

function wholeNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function readFigure(value: unknown): SgFigure | undefined {
  const row = asRecord(value);
  if (!row) return undefined;
  if (row.kind === "bond") {
    const whole = wholeNumber(row.whole);
    const left = wholeNumber(row.left);
    const right = wholeNumber(row.right);
    const missing = row.missing === "left" || row.missing === "right" || row.missing === "whole" ? row.missing : null;
    if (whole == null || left == null || right == null || !missing) return undefined;
    return { kind: "bond", whole, left, right, missing };
  }
  if (row.kind === "bar") {
    const whole = wholeNumber(row.whole);
    if (whole == null || !Array.isArray(row.parts)) return undefined;
    const parts: { label: string; value: number | null }[] = [];
    for (const part of row.parts) {
      const item = asRecord(part);
      if (!item || typeof item.label !== "string") return undefined;
      const value = item.value == null ? null : wholeNumber(item.value);
      if (item.value != null && value == null) return undefined;
      parts.push({ label: item.label, value });
    }
    return { kind: "bar", whole, parts };
  }
  return undefined;
}

function readPending(value: unknown): SgPending | undefined {
  const row = asRecord(value);
  if (!row) return undefined;
  const prompt = typeof row.prompt === "string" ? row.prompt : "";
  const code = typeof row.code === "string" ? row.code : "";
  const label = typeof row.label === "string" ? row.label : "";
  const grade = wholeNumber(row.grade);
  if (!prompt || !code || !label || grade == null) return undefined;
  const pending: SgPending = { prompt, code, label, grade };
  if (typeof row.answer === "string") pending.answer = row.answer;
  if (Array.isArray(row.also) && row.also.every((item) => typeof item === "string")) pending.also = row.also;
  const strand = typeof row.strand === "string" ? strandIdOf(row.strand) : null;
  if (strand) pending.strand = strand;
  const heuristic = typeof row.heuristic === "string" ? heuristicIdOf(row.heuristic) : null;
  if (heuristic) pending.heuristic = heuristic;
  const figure = readFigure(row.figure);
  if (figure) pending.figure = figure;
  return pending;
}

const STAGE_STEP: Record<string, number> = { concrete: 0, pictorial: 1, abstract: 2 };

function asStep(value: unknown): number {
  if (typeof value === "string") {
    const named = STAGE_STEP[value.trim().toLowerCase()];
    if (named !== undefined) return named;
  }
  const step = Number(value);
  return Math.min(2, Math.max(0, Number.isFinite(step) ? Math.round(step) : 0));
}

export function normalizeEngineLevel(value: unknown, engine: EngineId = "m"): EngineLevel | null {
  return asLevel(value, engine);
}

function asIndex(value: unknown): number | undefined {
  const index = Number(value);
  if (!Number.isInteger(index) || index < 0 || index > 100000) return undefined;
  return index;
}

function savedSightBand(row: Record<string, unknown>): SightBand | undefined {
  const sight = asRecord(row.sight);
  const candidates = [row.band, sight?.band, row.levelCode, sight?.levelCode];
  for (const value of candidates) {
    if (typeof value === "string" && isSightBand(value)) return value;
  }
  return undefined;
}

function asSightLevel(row: Record<string, unknown>, level: EngineLevel): EngineLevel {
  const rounded = Math.round(level.grade);
  level.grade = Number.isFinite(rounded) ? rounded : 0;
  const sight = asRecord(row.sight);
  const saved = savedSightBand(row);
  const band = saved ?? startBandForGrade(Number.isFinite(rounded) ? rounded : Number.NaN);
  const index = saved ? (asIndex(row.index) ?? asIndex(sight?.index) ?? 0) : 0;
  const card = sightCard(band, index, level.grade);
  level.step = 0;
  level.band = card.band;
  level.index = card.index;
  level.word = copyText(row, "word") ?? (sight ? copyText(sight, "word") : undefined) ?? card.word;
  const id = copyText(row, "id");
  const name = copyText(row, "name");
  const enteredBy = copyText(row, "enteredBy");
  const levelCode = copyText(row, "levelCode") ?? (sight ? copyText(sight, "levelCode") : undefined);
  const levelLabel = copyText(row, "levelLabel") ?? (sight ? copyText(sight, "levelLabel") : undefined);
  if (id) level.id = id;
  if (name) level.name = name;
  if (enteredBy) level.enteredBy = enteredBy;
  const earnedGrade = wholeNumber(row.earnedGrade);
  const reached = wholeNumber(row.reached);
  const missed = wholeNumber(row.missed);
  const updatedAt = wholeNumber(row.updatedAt);
  const startingGrade = wholeNumber(row.startingGrade);
  if (earnedGrade != null) level.earnedGrade = earnedGrade;
  if (reached != null) level.reached = reached;
  if (missed != null) level.missed = missed;
  if (updatedAt != null) level.updatedAt = updatedAt;
  if (startingGrade != null) level.startingGrade = startingGrade;
  level.levelCode = levelCode || card.band;
  level.levelLabel = levelLabel || BAND_LABELS[card.band];
  return level;
}

function copyText(row: Record<string, unknown>, key: string): string | undefined {
  return typeof row[key] === "string" && row[key] !== "" ? String(row[key]) : undefined;
}

function savedPaBand(row: Record<string, unknown>): PaBand | undefined {
  const nested = asRecord(row.pa);
  const candidates = [row.band, nested?.band, row.levelCode, nested?.levelCode];
  for (const value of candidates) {
    if (typeof value === "string" && isPaBand(value)) return value;
  }
  return undefined;
}

function asPaLevel(row: Record<string, unknown>, level: EngineLevel): EngineLevel {
  const rounded = Math.round(level.grade);
  level.grade = Number.isFinite(rounded) ? rounded : 0;
  const nested = asRecord(row.pa);
  const saved = savedPaBand(row);
  const age = wholeNumber(row.age) ?? (nested ? wholeNumber(nested.age) : null);
  const band = saved ?? paCardFromAccount({ grade: Number.isFinite(rounded) ? rounded : Number.NaN, age }, level.grade).band;
  let index = saved ? (asIndex(row.index) ?? (nested ? asIndex(nested.index) : undefined) ?? 0) : 0;
  const storedWord = copyText(row, "word") ?? (nested ? copyText(nested, "word") : undefined);
  if (saved && asIndex(row.index) == null && !(nested && asIndex(nested.index) != null) && storedWord) {
    const found = paCardFromAccount({ grade: level.grade, band, word: storedWord }, level.grade);
    if (found.id === storedWord) index = found.index;
  }
  const card = paCard(band, index, level.grade);
  level.step = 0;
  level.band = card.band;
  level.index = card.index;
  level.word = storedWord || card.id;
  const id = copyText(row, "id");
  const name = copyText(row, "name");
  const enteredBy = copyText(row, "enteredBy");
  const levelCode = copyText(row, "levelCode") ?? (nested ? copyText(nested, "levelCode") : undefined);
  const levelLabel = copyText(row, "levelLabel") ?? (nested ? copyText(nested, "levelLabel") : undefined);
  if (id) level.id = id;
  if (name) level.name = name;
  if (enteredBy) level.enteredBy = enteredBy;
  const earnedGrade = wholeNumber(row.earnedGrade);
  const reached = wholeNumber(row.reached);
  const missed = wholeNumber(row.missed);
  const updatedAt = wholeNumber(row.updatedAt);
  const startingGrade = wholeNumber(row.startingGrade);
  const streak = wholeNumber(row.streak);
  const missStreak = wholeNumber(row.missStreak);
  if (earnedGrade != null) level.earnedGrade = earnedGrade;
  if (reached != null) level.reached = reached;
  if (missed != null) level.missed = missed;
  if (updatedAt != null) level.updatedAt = updatedAt;
  if (startingGrade != null) level.startingGrade = startingGrade;
  if (streak != null) level.streak = streak;
  if (missStreak != null) level.missStreak = missStreak;
  level.levelCode = levelCode || card.band;
  level.levelLabel = levelLabel || card.label;
  return level;
}

function asLevel(value: unknown, engine: EngineId): EngineLevel | null {
  if (engine === "pa") {
    if (typeof value === "number") return asPaLevel({}, { grade: value, step: 0 });
    const row = asRecord(value);
    if (!row) return null;
    const raw = row.grade ?? row.level;
    const grade = raw == null || raw === "" ? Number.NaN : Number(raw);
    return asPaLevel(row, { grade, step: 0 });
  }
  if (engine === "sw") {
    if (typeof value === "number") return asSightLevel({}, { grade: value, step: 0 });
    const row = asRecord(value);
    if (!row) return null;
    const raw = row.grade ?? row.level;
    const grade = raw == null || raw === "" ? Number.NaN : Number(raw);
    return asSightLevel(row, { grade, step: 0 });
  }
  if (typeof value === "number" && value >= 1 && value <= 12) {
    const grade = Math.round(value);
    return { grade, step: 0 };
  }
  const row = asRecord(value);
  if (!row) return null;
  const grade = Number(row.grade ?? row.level);
  if (!Number.isInteger(grade) || grade < 1 || grade > 12) return null;
  const level: EngineLevel = {
    grade,
    step: asStep(row.step ?? row.stage ?? row.standardStep ?? 0),
  };
  if (engine !== "sg") return level;
  const id = copyText(row, "id");
  const name = copyText(row, "name");
  const enteredBy = copyText(row, "enteredBy");
  const standardId = copyText(row, "standardId");
  const tier = copyText(row, "tier");
  const levelCode = copyText(row, "levelCode");
  const levelLabel = copyText(row, "levelLabel");
  if (id) level.id = id;
  if (name) level.name = name;
  if (enteredBy) level.enteredBy = enteredBy;
  const earnedGrade = wholeNumber(row.earnedGrade);
  if (earnedGrade != null) level.earnedGrade = earnedGrade;
  if (standardId) level.standardId = standardId;
  if (tier) level.tier = tier;
  if (typeof row.simple === "boolean") level.simple = row.simple;
  const streak = wholeNumber(row.streak);
  const missStreak = wholeNumber(row.missStreak);
  const reached = wholeNumber(row.reached);
  const missed = wholeNumber(row.missed);
  const updatedAt = wholeNumber(row.updatedAt);
  const startingGrade = wholeNumber(row.startingGrade);
  if (streak != null) level.streak = streak;
  if (missStreak != null) level.missStreak = missStreak;
  if (reached != null) level.reached = reached;
  if (missed != null) level.missed = missed;
  if (updatedAt != null) level.updatedAt = updatedAt;
  if (startingGrade != null) level.startingGrade = startingGrade;
  if (levelCode) level.levelCode = levelCode;
  if (levelLabel) level.levelLabel = levelLabel;
  const pending = readPending(row.pending);
  if (pending) level.pending = pending;
  const mastery = asMastery(row.mastery);
  if (mastery) level.mastery = mastery;
  return level;
}

/**
 * Build the sg object the website stores.
 * The example id is "m-alex" and the example standardId is "4-1" for grade 4, step 1.
 * The doc does not define those two patterns, or the other values of tier, enteredBy, and simple.
 * A stored value is kept. A missing id becomes sg- plus the lowercased name.
 * A missing standardId becomes grade-step. tier, enteredBy, and simple default to "on", "parent", and false.
 */
export function sgAccountLevel(
  remote: EngineLevel | undefined,
  local: {
    name: string;
    grade: number;
    step: number;
    earnedGrade: number;
    streak: number;
    missStreak: number;
    reached: number;
    missed: number;
    startingGrade?: number;
    levelCode?: string;
    levelLabel?: string;
    mastery?: LevelMastery;
    updatedAt: number;
  },
): EngineLevel {
  const name = local.name.trim() || remote?.name || "";
  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "student";
  const level: EngineLevel = {
    id: remote?.id ?? `sg-${slug}`,
    name,
    enteredBy: remote?.enteredBy ?? "parent",
    grade: local.grade,
    step: local.step,
    earnedGrade: local.earnedGrade,
    standardId: remote?.standardId ?? `${local.grade}-${local.step}`,
    tier: remote?.tier ?? "on",
    simple: remote?.simple ?? false,
    streak: local.streak,
    missStreak: local.missStreak,
    reached: local.reached,
    missed: local.missed,
    updatedAt: local.updatedAt,
  };
  const startingGrade = local.startingGrade ?? remote?.startingGrade;
  if (startingGrade != null) level.startingGrade = startingGrade;
  const levelCode = local.levelCode || remote?.levelCode;
  if (levelCode) level.levelCode = levelCode;
  const levelLabel = local.levelLabel || remote?.levelLabel;
  if (levelLabel) level.levelLabel = levelLabel;
  if (remote?.pending) level.pending = remote.pending;
  if (local.mastery) level.mastery = local.mastery;
  return level;
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

const OFFICE_SLUG = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,78}[A-Za-z0-9])?$/;

/** A website office slug is one path segment. Anything else is treated as missing. */
export function officeSlugOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const slug = value.trim();
  return OFFICE_SLUG.test(slug) ? slug : null;
}

/**
 * The student office link when the website says it was purchased and names a slug.
 * Otherwise the first-month checkout. Missing fields are not purchased.
 */
export function officeOffer(
  purchased: boolean,
  slug: string | null,
): { kind: "office" | "package"; href: string } {
  const safe = officeSlugOf(slug);
  if (purchased === true && safe) return { kind: "office", href: `${SCHOOL_ORIGIN}/s/${safe}/` };
  return { kind: "package", href: SCHOOL_FIRST_MONTH_URL };
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
    const parsed = asLevel(value, key);
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
      officePurchased: profile.officePurchased === true,
      officeSlug: officeSlugOf(profile.officeSlug),
    },
  };
}

/**
 * A brand-new website account has an empty student name and no engines.
 * Local climbs and login rows are not part of that check.
 */
export function isFreshSchoolProfile(profile: Pick<SchoolProfile, "studentName" | "level">): boolean {
  return profile.studentName.trim().length === 0 && Object.keys(profile.level).length === 0;
}

/**
 * Website sentences that belong on the screen as themselves.
 * None of them means a second student.
 */
export const WEBSITE_ERRORS_NOT_EXTRA = [
  "Add the student before saving a level.",
  "That level could not be saved.",
  "An account already exists for that email. Sign in with it.",
] as const;

/** The text the website sent, when it sent one. */
export function websiteErrorText(body: unknown): string {
  const row = asRecord(body);
  if (!row) return "";
  const raw = typeof row.error === "string" ? row.error : typeof row.message === "string" ? row.message : "";
  return raw.trim();
}

/**
 * `new` when the website has no student yet. `extra` only when that student
 * is a different first name. `same` when the typed name is that student.
 * The parent name, the email, and any local child are not inputs.
 */
export function decideStudent(studentName: string | null | undefined, typedFirstName: string): "new" | "extra" | "same" {
  const enrolled = (studentName ?? "").trim();
  if (!enrolled) return "new";
  if (enrolled.toLowerCase() === typedFirstName.trim().toLowerCase()) return "same";
  return "extra";
}

export function schoolWriteBody(
  id: string,
  level: Partial<Record<EngineId, EngineLevel>>,
  localClock: number,
  remoteClock: number,
  seen: SeenQuestion[],
  studentName = "",
): {
  id: string;
  level: Partial<Record<EngineId, EngineLevel>>;
  clockSeconds: number;
  seen: SeenQuestion[];
  student?: { name: string };
} {
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
  const name = studentName.trim();
  return {
    id,
    level,
    clockSeconds: clockToWrite(localClock, remoteClock),
    seen: unique,
    ...(name ? { student: { name } } : {}),
  };
}

/**
 * The sentence to show. A sentence from the website is kept, including on
 * register and sign-in. The canned mismatch is only the fallback when the
 * website sent no sentence.
 */
export function schoolFailureMessage(signing: boolean, reason: SchoolFailure, spoken: string): string {
  if (spoken) return spoken;
  if (reason === "unknown") return "The school website has no password for that email.";
  if (signing) return "Email or password did not match.";
  return "The school website did not accept that request.";
}

export function failureKind(status: number, body: unknown): SchoolFailure {
  if (status === 429) return "wait";
  const row = asRecord(body);
  const text = `${row?.error ?? ""} ${row?.message ?? ""} ${row?.code ?? ""}`.toLowerCase();
  if (row?.wait === true || text.includes("too many") || text.includes("rate")) return "wait";
  if (text.includes("already") || text.includes("exists")) return "exists";
  if (
    status === 410 ||
    text.includes("account gone") ||
    text.includes("account_gone") ||
    text.includes("deleted") ||
    text.includes("removed")
  ) {
    return "gone";
  }
  if (
    (status === 401 || status === 403) &&
    !text.includes("password") &&
    (text.includes("secret") || text.includes("unauthorized") || text.includes("forbidden"))
  ) {
    return "offline";
  }
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
