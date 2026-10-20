/**
 * School website account contract. Safe to import from the browser:
 * no secret, no network call.
 *
 * The app server calls https://www.dotheimpossible.ai/api/account/*
 * with no cookies. Sign-in and register return a token. Later reads and
 * saves send Authorization: Bearer. The browser never sends a shared secret.
 * The account id is the lowercase parent email.
 */

import { normalizeAccountEmail, sameAccount } from "./account-scope.ts";
import { DAY_LIMIT_SECONDS } from "./day-clock-math.ts";
import { heuristicIdOf, strandIdOf, HEURISTICS, STRANDS, type HeuristicId, type StrandId } from "./vkole-singapore.ts";
import { BAND_LABELS, isSightBand, SIGHT_WORD_BANDS, startBandForGrade, type SightBand } from "./vkole/constants.ts";
import { bandMeta, cardFromAccount as spCardFromAccount, isSpBand, letterView, SPELLING_BANDS, spCard, type SpBand } from "./vkole/spelling/items.ts";
import { cardFromAccount as paCardFromAccount, migratePaBand, PA_BANDS, type PaBand } from "./vkole/phonemic-awareness/items.ts";
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

/** Default day cap. A `clock.limit` from the website replaces this for that account. */
export const CLOCK_LIMIT_SECONDS = DAY_LIMIT_SECONDS;

export const ENGINE_IDS = ["m", "ela", "ss", "gen", "sg", "sw", "sp", "pa"] as const;
export type EngineId = (typeof ENGINE_IDS)[number];

/**
 * Level keys on the website family. `mg` is stored and sent back with the
 * others. It is not one of this app's eight engines. `sp` is spelling.
 */
export const LEVEL_KEYS = ["m", "ela", "ss", "gen", "sg", "sw", "pa", "mg", "sp"] as const;
export type LevelKey = (typeof LEVEL_KEYS)[number];

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
  /** Sight words, spelling, and phonemic awareness. `index` is the item in `band`. `step` stays 0. */
  band?: string;
  index?: number;
  word?: string;
};

export type SeenQuestion = { key: string; text: string };

export type SchoolProfile = {
  access: "open" | "closed";
  studentName: string;
  level: Partial<Record<LevelKey, EngineLevel>>;
  freeWeekStart: string | null;
  clockSeconds: number;
  seen: SeenQuestion[];
  plan: "month" | "year" | null;
  /** Day cap in seconds. The website clock limit wins; otherwise this is 8 hours. */
  clockLimit?: number;
  /** Missing or non-boolean website values stay false. */
  officePurchased: boolean;
  /** A single path segment, or null when the website sent nothing usable. */
  officeSlug: string | null;
};

export type SchoolFailure =
  | "offline"
  | "wait"
  | "unknown"
  | "password"
  | "exists"
  | "rejected"
  | "gone"
  | "unauthorized";

/** A sign-in or register response. The token is the only credential for later calls. */
export type AccountSession = {
  id: string;
  profile: SchoolProfile;
  token: string;
  expiresAt: string;
};

export type FamilyWrite = {
  levels: Partial<Record<LevelKey, EngineLevel>>;
  clock: { seconds: number };
  /** The website rebuilds its practice-sheet key from this prompt text. */
  seenQuestions: { prompt: string }[];
  /** Set on the first child-name save. The website ignores a bare studentName field. */
  student?: { name: string; age: number | null; startingGrade: number | null };
};

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

export function clockToWrite(localSeconds: number, remoteSeconds: number, limit = CLOCK_LIMIT_SECONDS): number {
  const cap = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : CLOCK_LIMIT_SECONDS;
  const value = Math.max(0, Math.floor(localSeconds) || 0, Math.floor(remoteSeconds) || 0);
  return Math.min(cap, value);
}

/** Seconds in a website clock payload. `limit` is preferred. Missing or unusable values stay at 8 hours. */
export function clockLimitFrom(clock: unknown): number {
  const row = asRecord(clock);
  const raw = row?.limit ?? row?.limitSeconds ?? row?.maxSeconds ?? row?.dayLimit;
  const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() ? Number(raw) : Number.NaN;
  if (!Number.isFinite(n) || n <= 0) return CLOCK_LIMIT_SECONDS;
  return Math.floor(n);
}

export function isLevelKey(value: string): value is LevelKey {
  return (LEVEL_KEYS as readonly string[]).includes(value);
}

/**
 * The website token lasts 12 hours. There is no refresh URL.
 * Past `expiresAt`, an ordinary call stops. An open engine still sends the token.
 * A later family response may carry a replacement, which is stored with no sign-in screen.
 */
export function accountTokenExpired(expiresAt: string, now = Date.now()): boolean {
  const at = Date.parse(expiresAt);
  return Number.isNaN(at) || at <= now;
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

export function normalizeEngineLevel(value: unknown, engine: LevelKey = "m"): EngineLevel | null {
  return asLevel(value, engine);
}

function asMgLevel(value: unknown): EngineLevel | null {
  const base = asLevel(value, "m");
  if (!base) return null;
  const row = asRecord(value);
  if (!row) return base;
  const kept: EngineLevel = { ...base };
  const extra = kept as unknown as Record<string, unknown>;
  for (const [key, item] of Object.entries(row)) {
    if (key === "grade" || key === "level" || key === "step" || key === "stage") continue;
    if (item == null) continue;
    extra[key] = item;
  }
  return kept;
}

function asIndex(value: unknown): number | undefined {
  const index = Number(value);
  if (!Number.isInteger(index) || index < 0 || index > 100000) return undefined;
  return index;
}

/**
 * Bands the website keeps on level.sp. Any other band is dropped.
 * Alphabet progress is stored as `cvc` so the letter is not dropped.
 */
export const WEBSITE_SP_BANDS = ["cvc", "blends", "vowels", "patterns", "affixes"] as const;
export type WebsiteSpBand = (typeof WEBSITE_SP_BANDS)[number];

/** A website spelling word: lowercase letters and at most one apostrophe. */
const WEBSITE_SP_WORD = /^[a-z]+(?:'[a-z]+)?$/;

function isWebsiteSpBand(value: string | undefined | null): value is WebsiteSpBand {
  return !!value && (WEBSITE_SP_BANDS as readonly string[]).includes(value);
}

function websiteSpWordOk(word: string): boolean {
  return WEBSITE_SP_WORD.test(word);
}

function websiteSpGrade(grade: number): number {
  const rounded = Math.round(grade);
  if (!Number.isFinite(rounded)) return 1;
  return Math.min(12, Math.max(1, rounded));
}

function plainSpWord(word: string | undefined): string {
  return (word ?? "").trim().toLowerCase().replace(/’/g, "'");
}

/** Item index. A prompt id such as lk-next-m or lk-cue-5-m still names its letter when no index is stored. */
function alphabetIndex(level: Pick<EngineLevel, "index" | "word">): number {
  const count = Math.max(1, bandMeta("LK").count);
  const index = level.index;
  if (typeof index === "number" && Number.isInteger(index)) return Math.min(count - 1, Math.max(0, index));
  const word = plainSpWord(level.word);
  if (word === "lk-first") return 0;
  if (/^[a-z]$/.test(word)) return word.charCodeAt(0) - 97;
  const tail = word.match(/-([a-z])$/);
  if (tail?.[1]) return tail[1].charCodeAt(0) - 97;
  return 0;
}

/**
 * The spelling engine tracks alphabet letters as band LK and a prompt id.
 * The website drops LK and refuses a word that is not letters.
 * Alphabet progress is sent as band cvc, grade 1-12, and word set to the letter.
 * index, streak, and missStreak stay so a cue in progress can be restored.
 */
export function toWebsiteSpLevel(level: EngineLevel): EngineLevel {
  const grade = websiteSpGrade(level.grade);
  const bandRaw = (level.band ?? "").trim().toLowerCase();
  const wordRaw = plainSpWord(level.word);
  const internal = isSpBand(level.band) || isSpBand(level.levelCode);
  if (!internal && isWebsiteSpBand(bandRaw) && websiteSpWordOk(wordRaw)) {
    return { ...level, grade, step: 0, band: bandRaw, word: wordRaw, levelCode: bandRaw };
  }
  const index = alphabetIndex(level);
  const answer = letterView({ index, silence: 0, wrong: 0 }).answer;
  const letter = (answer || "abcdefghijklmnopqrstuvwxyz"[Math.min(25, index)] || "a").toLowerCase();
  return { ...level, grade, step: 0, band: "cvc", index, word: letter, levelCode: "cvc" };
}

function savedSpBand(row: Record<string, unknown>): SpBand | undefined {
  const nested = asRecord(row.sp);
  const candidates = [row.band, nested?.band, row.levelCode, nested?.levelCode];
  for (const value of candidates) {
    if (typeof value === "string" && isSpBand(value)) return value;
  }
  return undefined;
}

function websiteSpBandOf(row: Record<string, unknown>): WebsiteSpBand | undefined {
  const nested = asRecord(row.sp);
  for (const value of [row.band, nested?.band]) {
    if (typeof value !== "string") continue;
    const band = value.trim().toLowerCase();
    if (isWebsiteSpBand(band)) return band;
  }
  return undefined;
}

function asSpLevel(row: Record<string, unknown>, level: EngineLevel): EngineLevel {
  const rounded = Math.round(level.grade);
  level.grade = Number.isFinite(rounded) ? rounded : 0;
  const nested = asRecord(row.sp);
  const saved = savedSpBand(row);
  const storedWordRaw = copyText(row, "word") ?? (nested ? copyText(nested, "word") : undefined);
  const storedWord = storedWordRaw ? plainSpWord(storedWordRaw) : undefined;
  const websiteBand = websiteSpBandOf(row);
  if (!saved && websiteBand && storedWord && websiteSpWordOk(storedWord) && storedWord.length > 1) {
    return keptWebsiteSp(row, nested, level, websiteBand, storedWord);
  }
  const alphabetAt =
    !saved && websiteBand === "cvc" && storedWord && /^[a-z]$/.test(storedWord) ? storedWord.charCodeAt(0) - 97 : undefined;
  const band =
    alphabetAt != null
      ? "LK"
      : (saved ?? spCardFromAccount({ grade: Number.isFinite(rounded) ? rounded : Number.NaN }, level.grade).band);
  const explicit = asIndex(row.index) ?? (nested ? asIndex(nested.index) : undefined);
  let index = explicit ?? 0;
  if (alphabetAt != null && explicit == null) index = alphabetAt;
  if (saved && alphabetAt == null && asIndex(row.index) == null && !(nested && asIndex(nested.index) != null) && storedWord) {
    const found = spCardFromAccount({ grade: level.grade, band, word: storedWord }, level.grade);
    if (found.id === storedWord) index = found.index;
  }
  const card = spCard(band, index, level.grade);
  const silence = wholeNumber(row.streak) ?? (nested ? wholeNumber(nested.streak) : null) ?? 0;
  const wrong = wholeNumber(row.missStreak) ?? (nested ? wholeNumber(nested.missStreak) : null) ?? 0;
  const view = card.band === "LK" ? letterView({ index: card.index, silence, wrong }) : null;
  level.step = 0;
  level.band = card.band;
  level.index = view?.index ?? card.index;
  level.word = view?.id ?? (storedWord || card.id);
  level.streak = view?.silence ?? Math.max(0, silence);
  level.missStreak = view?.wrong ?? Math.max(0, wrong);
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
  if (earnedGrade != null) level.earnedGrade = earnedGrade;
  if (reached != null) level.reached = reached;
  if (missed != null) level.missed = missed;
  if (updatedAt != null) level.updatedAt = updatedAt;
  if (startingGrade != null) level.startingGrade = startingGrade;
  level.levelCode = alphabetAt != null ? card.band : levelCode || card.band;
  level.levelLabel = levelLabel || card.name;
  return level;
}

function keptWebsiteSp(
  row: Record<string, unknown>,
  nested: Record<string, unknown> | null,
  level: EngineLevel,
  band: WebsiteSpBand,
  word: string,
): EngineLevel {
  level.grade = websiteSpGrade(level.grade);
  level.step = 0;
  level.band = band;
  level.word = word;
  level.levelCode = band;
  const index = asIndex(row.index) ?? (nested ? asIndex(nested.index) : undefined);
  if (index != null) level.index = index;
  const streak = wholeNumber(row.streak) ?? (nested ? wholeNumber(nested.streak) : null);
  const missStreak = wholeNumber(row.missStreak) ?? (nested ? wholeNumber(nested.missStreak) : null);
  if (streak != null) level.streak = streak;
  if (missStreak != null) level.missStreak = missStreak;
  const id = copyText(row, "id");
  const name = copyText(row, "name");
  const enteredBy = copyText(row, "enteredBy");
  const levelLabel = copyText(row, "levelLabel") ?? (nested ? copyText(nested, "levelLabel") : undefined);
  if (id) level.id = id;
  if (name) level.name = name;
  if (enteredBy) level.enteredBy = enteredBy;
  if (levelLabel) level.levelLabel = levelLabel;
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
  return level;
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
    if (typeof value === "string") {
      const band = migratePaBand(value);
      if (band) return band;
    }
  }
  return undefined;
}

function asPaLevel(row: Record<string, unknown>, level: EngineLevel): EngineLevel {
  const rounded = Math.round(level.grade);
  level.grade = Number.isFinite(rounded) ? rounded : 0;
  const nested = asRecord(row.pa);
  const age = wholeNumber(row.age) ?? (nested ? wholeNumber(nested.age) : null);
  const storedWord = copyText(row, "word") ?? (nested ? copyText(nested, "word") : undefined);
  const explicit = asIndex(row.index) ?? (nested ? asIndex(nested.index) : undefined);
  const card = paCardFromAccount(
    {
      grade: Number.isFinite(rounded) ? rounded : Number.NaN,
      age,
      band: savedPaBand(row),
      index: explicit,
      word: storedWord,
      levelCode: copyText(row, "levelCode") ?? (nested ? copyText(nested, "levelCode") : undefined),
    },
    level.grade,
  );
  level.step = 0;
  level.band = card.band;
  level.index = card.index;
  const namesThisCard = !!storedWord && (storedWord === card.id || storedWord.trim().toLowerCase() === card.say.trim().toLowerCase());
  level.word = !storedWord || namesThisCard ? card.id : storedWord;
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

function asLevel(value: unknown, engine: LevelKey): EngineLevel | null {
  if (engine === "mg") return asMgLevel(value);
  if (engine === "sp") {
    if (typeof value === "number") return asSpLevel({}, { grade: value, step: 0 });
    const row = asRecord(value);
    if (!row) return null;
    const raw = row.grade ?? row.level;
    const grade = raw == null || raw === "" ? Number.NaN : Number(raw);
    return asSpLevel(row, { grade, step: 0 });
  }
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

function expiresAtOf(value: unknown): string | null {
  const parsed = typeof value === "string" ? Date.parse(value) : typeof value === "number" ? value : Number.NaN;
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

/**
 * Read `{ family }` from a sign-in, register, or family response.
 * The old `{ ok, id, profile }` shape is not an account.
 * Missing access stays closed.
 */
export function parseSchoolProfile(body: unknown, knownEmail?: string): { id: string; profile: SchoolProfile } | null {
  const root = asRecord(body);
  const family = asRecord(root?.family);
  if (!family) return null;
  const id = String(family.email ?? family.id ?? knownEmail ?? "").trim().toLowerCase();
  if (!isSchoolAccountId(id)) return null;
  if (knownEmail && !sameAccount(id, knownEmail)) return null;
  const student = family.student;
  const studentName =
    typeof student === "string"
      ? student.trim()
      : String(family.studentName ?? asRecord(student)?.name ?? "").trim();
  const levelSource = asRecord(family.levels) ?? asRecord(family.level) ?? {};
  const level: Partial<Record<LevelKey, EngineLevel>> = {};
  for (const [key, value] of Object.entries(levelSource)) {
    if (!isLevelKey(key)) continue;
    const parsed = asLevel(value, key);
    if (parsed) level[key] = parsed;
  }
  const freeRaw = family.freeWeekStart ?? family.freeWeek ?? family.trialStartedAt ?? null;
  const freeWeekStart = typeof freeRaw === "string" && !Number.isNaN(Date.parse(freeRaw)) ? new Date(freeRaw).toISOString() : null;
  const clockRow = asRecord(family.clock);
  const clockNumber = typeof family.clock === "number" ? family.clock : undefined;
  const clockLimit = clockLimitFrom(clockRow ?? family.clock);
  const clockSeconds = clockToWrite(
    Number(family.clockSeconds ?? clockNumber ?? clockRow?.seconds ?? clockRow?.usedSeconds ?? 0),
    0,
    clockLimit,
  );
  const plan = asPlan(family.subscription ?? family.plan);
  return {
    id,
    profile: {
      access: asAccess(family.access, plan),
      studentName,
      level,
      freeWeekStart,
      clockSeconds,
      clockLimit,
      seen: asSeen(family.seen ?? family.seenQuestions),
      plan,
      officePurchased: family.officePurchased === true,
      officeSlug: officeSlugOf(family.officeSlug),
    },
  };
}

/** A family or sign-in body that includes a replacement token. Missing either field is not a grant. */
export function rotatedGrant(body: unknown): { token: string; expiresAt: string } | null {
  const root = asRecord(body);
  if (!root) return null;
  const token = typeof root.token === "string" ? root.token.trim() : "";
  const expiresAt = expiresAtOf(root.expiresAt);
  if (!token || !expiresAt) return null;
  return { token, expiresAt };
}

/** Sign-in and register: token, expiresAt, and family. A missing token is not a session. */
export function parseAccountSession(body: unknown, knownEmail?: string): AccountSession | null {
  const root = asRecord(body);
  if (!root) return null;
  const token = typeof root.token === "string" ? root.token.trim() : "";
  const expiresAt = expiresAtOf(root.expiresAt);
  const parsed = parseSchoolProfile(body, knownEmail);
  if (!token || !expiresAt || !parsed) return null;
  return { id: parsed.id, profile: parsed.profile, token, expiresAt };
}

/**
 * A brand-new website account has an empty student name and no engines.
 * Local climbs and login rows are not part of that check.
 * A closed family can look the same after a lapse. That is not a new account.
 */
export function isFreshSchoolProfile(profile: Pick<SchoolProfile, "studentName" | "level">): boolean {
  return profile.studentName.trim().length === 0 && Object.keys(profile.level).length === 0;
}

/** Progress already stored for this family. A lapse read must not throw it away. */
export type StoredSchoolProgress = {
  studentName?: string;
  level?: Partial<Record<LevelKey, EngineLevel>>;
  freeWeekStart?: string | null;
  clockSeconds?: number;
  plan?: "month" | "year" | null;
};

/**
 * Local climbs, seen prompts, and history are cleared only for a brand-new
 * open account that has never stored a student or an engine.
 * A closed family is a finished free week or a lapsed subscription. It keeps
 * its place even when the website omits the student and the levels.
 */
export function clearsLocalProgress(
  profile: Pick<SchoolProfile, "access" | "studentName" | "level">,
  stored?: StoredSchoolProgress | null,
): boolean {
  if (profile.access !== "open") return false;
  if (!isFreshSchoolProfile(profile)) return false;
  if ((stored?.studentName ?? "").trim()) return false;
  if (stored?.level && Object.keys(stored.level).length > 0) return false;
  return true;
}

function bandRank(engine: LevelKey, band: string | undefined): number {
  const id = (band ?? "").trim();
  if (!id) return 0;
  if (engine === "sw") {
    const at = (SIGHT_WORD_BANDS as readonly string[]).indexOf(id);
    return at < 0 ? 0 : at;
  }
  if (engine === "pa") {
    const at = PA_BANDS.indexOf(id);
    return at < 0 ? 0 : at;
  }
  if (engine === "sp") {
    const local = (SPELLING_BANDS as readonly string[]).indexOf(id);
    if (local >= 0) return local;
    const website = (WEBSITE_SP_BANDS as readonly string[]).indexOf(id.toLowerCase());
    return website < 0 ? 0 : website + SPELLING_BANDS.length;
  }
  return 0;
}

/** Alphabet letters share one rank. A later spelling band stays ahead of them. */
function alphabetPlace(level: EngineLevel): number | null {
  const band = (level.band ?? level.levelCode ?? "").trim().toLowerCase();
  if (!band || band === "lk" || band === "ls") return alphabetIndex(level);
  if (band !== "cvc") return null;
  const word = plainSpWord(level.word);
  if (word.length <= 1 || word.startsWith("lk-")) return alphabetIndex(level);
  return null;
}

function levelWork(level: EngineLevel): number {
  let asked = 0;
  const mastery = level.mastery;
  if (mastery) {
    for (const tally of Object.values(mastery.strands)) asked += tally?.asked ?? 0;
    for (const tally of Object.values(mastery.heuristics)) asked += tally?.asked ?? 0;
  }
  return (
    Math.max(0, Math.round(Number(level.reached) || 0)) +
    Math.max(0, Math.round(Number(level.missed) || 0)) +
    Math.max(0, Math.round(Number(level.streak) || 0)) +
    Math.max(0, Math.round(Number(level.missStreak) || 0)) +
    asked
  );
}

/** Grade, then band, then item, then how much work is on the record. */
function progressTuple(engine: LevelKey, level: EngineLevel): [number, number, number, number] {
  const grade = Math.min(12, Math.max(0, Math.round(Number(level.grade) || 0)));
  const letter = engine === "sp" ? alphabetPlace(level) : null;
  const band = letter == null ? bandRank(engine, level.band || level.levelCode) : 0;
  const pos =
    letter == null
      ? Math.max(0, Math.round(Number(level.index) || 0), Math.round(Number(level.step) || 0))
      : letter;
  return [grade, band, pos, levelWork(level)];
}

function notBehind(engine: LevelKey, incoming: EngineLevel, stored: EngineLevel): boolean {
  const next = progressTuple(engine, incoming);
  const prev = progressTuple(engine, stored);
  for (let i = 0; i < next.length; i += 1) {
    if (next[i] !== prev[i]) return next[i] > prev[i];
  }
  return true;
}

/**
 * Keep the further engine record.
 * An empty level and a starter level do not replace one that has moved.
 * An equal record keeps the incoming fields.
 */
export function keptEngineLevel(
  engine: LevelKey,
  stored: EngineLevel | undefined,
  incoming: EngineLevel | undefined,
): EngineLevel | undefined {
  if (!incoming) return stored;
  if (!stored) return incoming;
  return notBehind(engine, incoming, stored) ? incoming : stored;
}

/** Union of saved engines. A missing or earlier incoming engine leaves the stored one. */
export function keptLevels(
  stored: Partial<Record<LevelKey, EngineLevel>>,
  incoming: Partial<Record<LevelKey, EngineLevel>>,
): Partial<Record<LevelKey, EngineLevel>> {
  const level: Partial<Record<LevelKey, EngineLevel>> = { ...stored };
  for (const key of LEVEL_KEYS) {
    const next = keptEngineLevel(key, stored[key], incoming[key]);
    if (next) level[key] = next;
  }
  return level;
}

/**
 * The family to store after a read.
 * Access follows the website, so a lapse still locks the engines.
 * The student, the levels, the free-week start, the clock, and the plan
 * stay when the website sends an empty or earlier value.
 */
export function profileKeepingProgress(stored: StoredSchoolProgress | null | undefined, incoming: SchoolProfile): SchoolProfile {
  return {
    ...incoming,
    studentName: incoming.studentName.trim() || stored?.studentName?.trim() || "",
    level: keptLevels(stored?.level ?? {}, incoming.level),
    freeWeekStart: incoming.freeWeekStart ?? stored?.freeWeekStart ?? null,
    clockSeconds: clockToWrite(incoming.clockSeconds || 0, stored?.clockSeconds || 0, incoming.clockLimit),
    plan: incoming.plan ?? stored?.plan ?? null,
  };
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

const POOL_VARIANT_ID = /^(m|ela|ss|gen|sg):\d+:\d+:\d+$/;

/** The displayed prompt. A pool variant id is not a prompt. */
function seenWirePrompt(item: { key?: string; text?: string }): string {
  const text = (item.text ?? "").replace(/\s+/g, " ").trim();
  if (!text || POOL_VARIANT_ID.test(text)) return "";
  return text;
}

/** Body for POST /api/account/family. Levels include alphabet on `sp`. */
export function schoolWriteBody(
  level: Partial<Record<LevelKey, EngineLevel>>,
  localClock: number,
  remoteClock: number,
  seen: SeenQuestion[],
  student?: { name: string; age?: number | null; startingGrade?: number | null },
  limit = CLOCK_LIMIT_SECONDS,
): FamilyWrite {
  const seenQuestions: { prompt: string }[] = [];
  const prompts = new Set<string>();
  for (const item of seen) {
    const prompt = seenWirePrompt(item);
    const dedupe = prompt.toLowerCase();
    if (!prompt || prompts.has(dedupe)) continue;
    prompts.add(dedupe);
    seenQuestions.push({ prompt });
    if (seenQuestions.length >= 400) break;
  }
  const levels: FamilyWrite["levels"] = { ...level };
  if (levels.sp) levels.sp = toWebsiteSpLevel(levels.sp);
  const name = student?.name.trim() ?? "";
  const age = student?.age;
  const starting = student?.startingGrade;
  return {
    levels,
    clock: { seconds: clockToWrite(localClock, remoteClock, limit) },
    seenQuestions,
    ...(name
      ? {
          student: {
            name,
            age: Number.isInteger(age) ? (age as number) : null,
            startingGrade: Number.isInteger(starting) && (starting as number) >= 1 && (starting as number) <= 12 ? (starting as number) : null,
          },
        }
      : {}),
  };
}

/**
 * The sentence to show. A sentence from the website is kept, including on
 * register and sign-in. The canned mismatch is only the fallback when the
 * website sent no sentence.
 */
export function schoolFailureMessage(signing: boolean, reason: SchoolFailure, spoken: string): string {
  if (spoken) return spoken;
  if (reason === "unauthorized") return "Sign in again.";
  if (reason === "unknown") return "The school website has no password for that email.";
  if (signing) return "Email or password did not match.";
  return "The school website did not accept that request.";
}

/**
 * A deleted website account. A lapsed subscription can say "removed" or
 * "deleted" without the account itself being gone, and that must not match.
 */
function accountIsGone(text: string): boolean {
  return (
    /account[\s_-]*(is[\s_-]+)?(gone|deleted|removed)/.test(text) ||
    /account[\s_-]+was[\s_-]+(gone|deleted|removed)/.test(text)
  );
}

export function failureKind(status: number, body: unknown): SchoolFailure {
  if (status === 429) return "wait";
  const row = asRecord(body);
  const text = `${row?.error ?? ""} ${row?.message ?? ""} ${row?.code ?? ""}`.toLowerCase();
  if (row?.wait === true || text.includes("too many") || text.includes("rate")) return "wait";
  if (text.includes("already") || text.includes("exists")) return "exists";
  if (status === 410 || accountIsGone(text)) return "gone";
  if (status === 401) {
    if (text.includes("password") || (text.includes("invalid") && text.includes("email"))) return "password";
    return "unauthorized";
  }
  if (text.includes("not found") || text.includes("unknown") || text.includes("no account")) return "unknown";
  if (text.includes("password") || text.includes("match") || text.includes("invalid")) return "password";
  if (status >= 500 || status === 0) return "offline";
  return "rejected";
}
