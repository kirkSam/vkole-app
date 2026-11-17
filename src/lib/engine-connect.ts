import {
  AGREED_VERSION,
  allowsEarlyStepDown,
  applyRecheck,
  applyReview,
  createMemory,
  freshFatigue,
  mostFaded,
  noteAnswer,
  recheckDue,
  removePersonalDetails,
  reviewSlotOpen,
  VEKOLE_SETTINGS,
  type FatigueState,
  type MemoryRecord,
} from "@kirkpatrick/vekole-engine";

/** The app and the website pin this tag. Neither side points at a branch. */
export const CONNECTED_ENGINE = "v0.1.3" as const;

export function engineTagMatches(): boolean {
  return AGREED_VERSION === CONNECTED_ENGINE;
}

/** The text that may be sent to Grok or stored. Personal details are not kept. */
export function cleanTypedAnswer(answer: string): string {
  return removePersonalDetails(answer);
}

export type ItemMemory = MemoryRecord & { itemKey: string; known?: boolean };

export type EngineSession = {
  itemsServed: number;
  reviewsServed: number;
  itemsSinceNew: number;
  lastNewAt: string;
  fatigue: FatigueState;
  serveKind: "growth" | "review" | "recheck";
  serveItem: string;
  rechecked: string[];
};

export function freshEngineSession(now: Date): EngineSession {
  return {
    itemsServed: 0,
    reviewsServed: 0,
    itemsSinceNew: 0,
    lastNewAt: now.toISOString(),
    fatigue: freshFatigue(),
    serveKind: "growth",
    serveItem: "",
    rechecked: [],
  };
}

export function scoreEngineItem(input: {
  session: EngineSession;
  records: ItemMemory[];
  itemKey: string;
  correct: boolean;
  elapsedMs: number;
  now: Date;
  engine: string;
}): { session: EngineSession; records: ItemMemory[]; holdLevel: boolean; earlyStepDown: boolean } {
  const fatigue = noteAnswer(input.session.fatigue, Math.max(0, input.elapsedMs), !input.correct);
  const kind = input.session.serveKind;
  const holdLevel = kind === "review" || kind === "recheck";
  const earlyStepDown = !holdLevel && !input.correct && allowsEarlyStepDown(input.engine, fatigue.high);
  const records = input.records.map((row) => ({ ...row }));
  const index = input.itemKey ? records.findIndex((row) => row.itemKey === input.itemKey) : -1;
  const known = index >= 0 ? records[index]?.known : undefined;
  if (kind === "review" && index >= 0) {
    records[index] = { ...applyReview(records[index]!, input.correct, input.now), itemKey: input.itemKey, known };
  } else if (kind === "recheck" && index >= 0) {
    records[index] = { ...applyRecheck(records[index]!, input.correct, input.now), itemKey: input.itemKey, known };
  } else if (kind === "growth" && input.correct && input.itemKey && index < 0) {
    records.push({ ...createMemory(input.now), itemKey: input.itemKey });
  } else if (kind === "growth" && !input.correct && index >= 0) {
    records[index] = { ...applyRecheck(records[index]!, false, input.now), itemKey: input.itemKey, known };
  }
  const rechecked =
    kind === "recheck" && input.itemKey && !input.session.rechecked.includes(input.itemKey)
      ? [...input.session.rechecked, input.itemKey]
      : input.session.rechecked;
  return {
    session: {
      ...input.session,
      itemsServed: input.session.itemsServed + 1,
      reviewsServed: input.session.reviewsServed + (kind === "review" ? 1 : 0),
      itemsSinceNew: kind === "growth" ? input.session.itemsSinceNew + 1 : input.session.itemsSinceNew,
      lastNewAt: kind === "growth" ? input.now.toISOString() : input.session.lastNewAt,
      fatigue,
      rechecked,
    },
    records,
    holdLevel,
    earlyStepDown,
  };
}

/** A review or a same-session re-check, or a new growth item. Reviews never change the growth level. */
export function chooseNextServe(input: {
  session: EngineSession;
  records: ItemMemory[];
  now: Date;
  subject: string;
}): { session: EngineSession; itemKey: string | null } {
  const high = input.session.fatigue.high;
  const own = input.records.filter((row) => row.itemKey.startsWith(`${input.subject}:`));
  const elapsed = input.now.getTime() - Date.parse(input.session.lastNewAt);
  if (recheckDue(Number.isFinite(elapsed) ? elapsed : 0, input.session.itemsSinceNew, high)) {
    const fresh = own.find((row) => row.reviews === 0 && row.misses === 0 && !input.session.rechecked.includes(row.itemKey));
    if (fresh) {
      return {
        session: { ...input.session, serveKind: "recheck", serveItem: fresh.itemKey, itemsSinceNew: 0 },
        itemKey: fresh.itemKey,
      };
    }
  }
  if (reviewSlotOpen(input.session.itemsServed, input.session.reviewsServed, high)) {
    const faded = mostFaded(own, input.now);
    if (faded) {
      const match = own.find((row) => row === faded);
      if (match) {
        return { session: { ...input.session, serveKind: "review", serveItem: match.itemKey }, itemKey: match.itemKey };
      }
    }
  }
  return { session: { ...input.session, serveKind: "growth", serveItem: "" }, itemKey: null };
}

/** The package owns this number. The app does not keep its own copy. */
export function sightListAdvances(known: number, listSize: number): boolean {
  if (listSize <= 0 || known <= 0) return false;
  return known / listSize >= VEKOLE_SETTINGS.sightWordsListRule;
}

export function sightItemKey(band: string, index: number): string {
  return `sw:${band}:${index}`;
}

export function parseSightItemKey(key: string): { band: string; index: number } | null {
  const matched = /^sw:(.+):(\d+)$/.exec(key);
  if (!matched || !matched[1]) return null;
  const index = Number(matched[2]);
  if (!Number.isInteger(index) || index < 0) return null;
  return { band: matched[1], index };
}

function withSession(session: EngineSession, kind: EngineSession["serveKind"], now: Date, fatigue: FatigueState, itemKey: string): EngineSession {
  const rechecked =
    kind === "recheck" && itemKey && !session.rechecked.includes(itemKey) ? [...session.rechecked, itemKey] : session.rechecked;
  return {
    ...session,
    itemsServed: session.itemsServed + 1,
    reviewsServed: session.reviewsServed + (kind === "review" ? 1 : 0),
    itemsSinceNew: kind === "growth" ? session.itemsSinceNew + 1 : session.itemsSinceNew,
    lastNewAt: kind === "growth" ? now.toISOString() : session.lastNewAt,
    fatigue,
    rechecked,
  };
}

/** A correct word is known from then on. A miss is remembered and can return as a review. */
export function scoreSightWord(input: {
  session: EngineSession;
  records: ItemMemory[];
  itemKey: string;
  correct: boolean;
  elapsedMs: number;
  now: Date;
}): { session: EngineSession; records: ItemMemory[] } {
  const fatigue = noteAnswer(input.session.fatigue, Math.max(0, input.elapsedMs), !input.correct);
  const kind = input.session.serveKind;
  const records = input.records.map((row) => ({ ...row }));
  const index = records.findIndex((row) => row.itemKey === input.itemKey);
  if (input.correct && index < 0) {
    records.push({ ...createMemory(input.now), itemKey: input.itemKey, known: true });
  } else if (input.correct && index >= 0) {
    const row = records[index]!;
    const next = !row.known ? createMemory(input.now) : kind === "growth" ? row : applyReview(row, true, input.now);
    records[index] = { ...next, itemKey: input.itemKey, known: true };
  } else if (!input.correct && index < 0) {
    records.push({ ...applyRecheck(createMemory(input.now), false, input.now), itemKey: input.itemKey, known: false });
  } else if (!input.correct && index >= 0) {
    const row = records[index]!;
    const next = kind === "growth" ? applyRecheck(row, false, input.now) : applyReview(row, false, input.now);
    records[index] = { ...next, itemKey: input.itemKey, known: row.known === true };
  }
  return { session: withSession(input.session, kind, input.now, fatigue, input.itemKey), records };
}

export function knownOnList(records: readonly ItemMemory[], band: string): number {
  return records.filter((row) => row.known === true && parseSightItemKey(row.itemKey)?.band === band).length;
}

export function nextSightPlace(input: {
  band: string;
  index: number;
  listSize: number;
  known: number;
  bands: readonly string[];
  unknown: ReadonlySet<number>;
}): { band: string; index: number; advanced: boolean } {
  if (sightListAdvances(input.known, input.listSize)) {
    const at = input.bands.indexOf(input.band);
    const next = at >= 0 ? input.bands[at + 1] : undefined;
    if (next) return { band: next, index: 0, advanced: true };
    return { band: input.band, index: 0, advanced: false };
  }
  const size = input.listSize > 0 ? input.listSize : 1;
  for (let step = 1; step <= size; step += 1) {
    const at = (input.index + step) % size;
    if (input.unknown.has(at)) return { band: input.band, index: at, advanced: false };
  }
  return { band: input.band, index: (input.index + 1) % size, advanced: false };
}
