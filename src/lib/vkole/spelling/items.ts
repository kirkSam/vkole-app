import lists from "./data.json" with { type: "json" };
import { spokenFormsForLetter } from "./match.ts";

export const SPELLING_ENGINE = "sp" as const;

export const SPELLING_LETTER_MS = lists.letterMs;
export const SPELLING_SONG_MS = lists.songMs;
export const SPELLING_HAPPY_FACE_MS = lists.answerFlow.happyFaceMs;
export const SPELLING_RESPONSE_MS = lists.answerFlow.responseMs;
export const SPELLING_MAX_CHANGES_PER_SECOND = lists.maxChangesPerSecond;

/** The opening waits this long, then starts on its own if START was not pressed. */
export const SPELLING_START_MS = 30_000;

/**
 * Chrome ends a SpeechRecognition session often, and start() in that same turn throws.
 * A short pause lets the next listen begin on the same letter.
 */
export const SPELLING_RECOGNIZER_RESTART_MS = 250;

/**
 * The microphone stays closed for this long after the prompt finishes.
 * Opening in the same turn as speech end hears the question itself.
 */
export const SPELLING_LISTEN_GAP_MS = 400;

export const SPELLING_NOTE =
  "Exercise 1 is the alphabet song. Exercise 2 shows a capital letter. Exercise 3 shows a small letter. Exercise 4 asks for the letter, then shows the capital and the small letter. Exercise 5 asks you to say the alphabet. At Z, the app says Good job! The microphone is on only while the app waits for an answer. The sound is not saved. If the app does not hear you, it asks the same letter again.";

/** Whole seconds left before the alphabet starts itself. 0 means start now. */
export function spellingStartSecondsLeft(elapsedMs: number): number {
  const elapsed = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
  const left = SPELLING_START_MS - elapsed;
  if (left <= 0) return 0;
  return Math.ceil(left / 1000);
}

export const SPELLING_BANDS = ["LK", "LS", "CVC", "DOLCH", "FRY"] as const;

export type SpBand = (typeof SPELLING_BANDS)[number];

export type SpItem = {
  id: string;
  kind: string;
  say: string;
  show: string;
  answer: string;
  also: string[];
  letter: string;
  model: string;
};

export type SpCard = SpItem & {
  band: SpBand;
  index: number;
  grade: number;
  name: string;
  label: string;
};

type RawItem = {
  id?: string;
  kind?: string;
  say?: string;
  show?: string;
  answer?: string;
  also?: string[];
  letter?: string;
  model?: string;
};

type RawBand = {
  id?: string;
  name?: string;
  grade?: string;
  kinds?: string[];
  note?: string;
  items?: RawItem[];
};

const BANDS = lists.bands as RawBand[];
const NO_ALSO: string[] = [];

export function isSpBand(value: string | undefined | null): value is SpBand {
  return !!value && (SPELLING_BANDS as readonly string[]).includes(value);
}

export function alphabet(): readonly string[] {
  return lists.letters;
}

export function letterColors(): readonly { letter: string; background: string }[] {
  return lists.colors;
}

export function reviewChangesPerSecond(): number {
  return 1000 / SPELLING_LETTER_MS;
}

/**
 * The alphabet review holds one letter for `letterMs`.
 * At exactly 26 × 1500 ms the song is finished.
 * A change every 1.5 seconds stays under 3 changes per second.
 */
export function letterAtSongTime(ms: number): { index: number; letter: string; done: boolean } {
  const letters = alphabet();
  const last = letters.length - 1;
  if (Number.isFinite(ms) && ms >= SPELLING_SONG_MS) {
    return { index: last, letter: letters[last] ?? "Z", done: true };
  }
  const elapsed = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const index = Math.min(last, Math.floor(elapsed / SPELLING_LETTER_MS));
  return { index, letter: letters[index] ?? "A", done: false };
}

/** The microphone is on only while a question is waiting for an answer. */
export function micListensDuring(phase: string): boolean {
  return phase === "listen";
}

/**
 * A blank spoken line is already finished.
 * Waiting on the speech queue for it never opens the microphone,
 * which is how a card with no letter on screen stays stuck.
 */
export function spellingPromptStartsListen(say: string): "now" | "after-speech" {
  return say.trim() ? "after-speech" : "now";
}

/** True only after the prompt has finished and the listen gap has elapsed. */
export function micOpensAfterPrompt(speechEnded: boolean, sinceEndMs: number): boolean {
  const elapsed = Number.isFinite(sinceEndMs) ? sinceEndMs : 0;
  return speechEnded && elapsed >= SPELLING_LISTEN_GAP_MS;
}

/**
 * Chrome drops a prompt when cancel() and the next speak overlap, which is the handoff
 * onto the first "What letter comes next?" card. An end that fast means the line did not play.
 */
export const SPELLING_PROMPT_MIN_MS = 200;

export function promptPlayedLongEnough(elapsedMs: number): boolean {
  const elapsed = Number.isFinite(elapsedMs) ? elapsedMs : 0;
  return elapsed >= SPELLING_PROMPT_MIN_MS;
}

/**
 * A miss in the first moments of listening is the previous card or the prompt tail, not a new answer.
 * A correct letter in that window still counts.
 */
export function earlyHandoffMiss(elapsedMs: number, judgment: "correct" | "miss" | "wait"): boolean {
  const elapsed = Number.isFinite(elapsedMs) ? elapsedMs : 0;
  return judgment === "miss" && elapsed < SPELLING_LISTEN_GAP_MS;
}

export function bandMeta(band: SpBand): { name: string; label: string; count: number; kinds: string[]; note: string } {
  const row = BANDS.find((entry) => entry.id === band);
  return {
    name: row?.name ?? band,
    label: row?.grade ?? "",
    count: row?.items?.length ?? 0,
    kinds: row?.kinds ?? [],
    note: row?.note ?? "",
  };
}

function asItem(raw: RawItem | undefined): SpItem {
  const answer = raw?.answer ?? "";
  const listed = Array.isArray(raw?.also) ? raw.also : NO_ALSO;
  const also = [...listed];
  for (const form of spokenFormsForLetter(answer)) {
    if (!also.some((item) => item.toLowerCase() === form.toLowerCase())) also.push(form);
  }
  return {
    id: raw?.id ?? "",
    kind: raw?.kind ?? "",
    say: raw?.say ?? "",
    show: raw?.show ?? "",
    answer,
    also,
    letter: raw?.letter ?? "",
    model: raw?.model ?? raw?.answer ?? "",
  };
}

function bandItems(band: SpBand): RawItem[] {
  return BANDS.find((entry) => entry.id === band)?.items ?? [];
}

/** Bands with items, in file order. Empty later bands stay in the file and are skipped. */
export function filledBands(): SpBand[] {
  return SPELLING_BANDS.filter((band) => bandMeta(band).count > 0);
}

export function itemAt(band: SpBand, index: number): SpItem & { index: number } {
  const items = bandItems(band);
  const count = items.length;
  const at = count === 0 ? 0 : ((Math.trunc(index) % count) + count) % count;
  return { ...asItem(items[at]), index: at };
}

export function spCard(band: SpBand, index: number, grade: number): SpCard {
  const resolved = bandMeta(band).count > 0 ? band : (filledBands()[0] ?? "LK");
  const entry = itemAt(resolved, index);
  const meta = bandMeta(resolved);
  return { ...entry, band: resolved, index: entry.index, grade, name: meta.name, label: meta.label };
}

/** Letter knowledge is the start until the owner specifies later placement. */
export function startBand(): SpBand {
  return filledBands()[0] ?? "LK";
}

export function startCard(grade: number): SpCard {
  const rounded = Math.round(grade);
  const stored = Number.isFinite(rounded) ? rounded : 0;
  return spCard(startBand(), 0, stored);
}

/**
 * A saved band wins, including a levelCode that is a band id.
 * An empty band falls back to the first band that has items.
 * Otherwise the student starts at the first letter question.
 */
export function cardFromAccount(
  input: {
    grade?: number;
    band?: string | null;
    index?: number | null;
    levelCode?: string | null;
    word?: string | null;
  } | null | undefined,
  fallbackGrade: number,
): SpCard {
  const raw = input?.grade ?? fallbackGrade;
  const rounded = Math.round(Number(raw));
  const grade = Number.isFinite(rounded) ? rounded : 0;
  const named = isSpBand(input?.band) ? input.band : isSpBand(input?.levelCode) ? input.levelCode : undefined;
  const band = named && bandMeta(named).count > 0 ? named : startBand();
  let index = named && Number.isInteger(input?.index) && (input?.index ?? 0) >= 0 ? Number(input?.index) : 0;
  if (band === "LK") {
    index = migrateAlphabetIndex({
      index: Number.isInteger(input?.index) ? Number(input?.index) : null,
      word: input?.word,
    });
  } else if (named && bandMeta(named).count > 0 && !Number.isInteger(input?.index) && input?.word) {
    const found = bandItems(band).findIndex((item) => item.id === input.word);
    if (found >= 0) index = found;
  }
  return spCard(band, index, grade);
}

export type LetterProgress = {
  index: number;
  silence: number;
  wrong: number;
};

export type LetterOutcome = "correct" | "miss" | "timeout";

export type LetterView = {
  id: string;
  index: number;
  letter: string;
  silence: number;
  wrong: number;
  kind: "ask" | "cue";
  exercise: 2 | 3 | 4 | 5;
  itemKind: string;
  cue: string[];
  say: string;
  show: string;
  answer: string;
  also: string[];
  shown: string;
  /** Upper and lower together, such as "A a", after a recall answer. */
  pair: string;
  band: SpBand;
  name: string;
};

type FlowWrong = { times?: number; action?: string; letters?: number; letter?: string };

/** Item index in letter knowledge. 0 is the first card. The last card and 0 are the walls. */
export function clampLetterIndex(index: number): number {
  const count = Math.max(1, bandMeta("LK").count);
  const at = Number.isInteger(index) ? index : 0;
  return Math.min(count - 1, Math.max(0, at));
}

export function normalizeLetterProgress(input: Partial<LetterProgress> | null | undefined): LetterProgress {
  return {
    index: clampLetterIndex(input?.index ?? 0),
    silence: Math.max(0, Math.trunc(Number(input?.silence) || 0)),
    wrong: Math.max(0, Math.trunc(Number(input?.wrong) || 0)),
  };
}

/**
 * Exercise 2 and 3 show one letter. Exercise 3 is lowercase.
 * Exercise 4 and the final recitation leave the screen blank until the answer.
 * An empty glyph on a showing card uses the answer, so a handoff cannot go blank by mistake.
 */
export function letterOnScreen(kind: string, letter: string, answer: string): string {
  if (kind === "recall" || kind === "recite" || kind === "letter-name") return "";
  const listed = (letter || "").trim();
  if (/^[a-z]$/.test(listed)) return listed;
  if (/^[A-Z]$/.test(listed)) return listed;
  const fallback = (answer || "").trim();
  if (kind === "lower-letter" || kind === "lower-next") {
    const lower = fallback.toLowerCase();
    return /^[a-z]$/.test(lower) ? lower : "";
  }
  const upper = fallback.toUpperCase();
  return /^[A-Z]$/.test(upper) ? upper : "";
}

/**
 * Exercise 1 is the song and has no card.
 * 2 shows uppercase, 3 shows lowercase, 4 asks with nothing shown, 5 is the recitation.
 */
export function letterExercise(index: number): 2 | 3 | 4 | 5 {
  const kind = itemAt("LK", clampLetterIndex(index)).kind;
  if (kind === "recite") return 5;
  if (kind === "recall") return 4;
  if (kind === "lower-letter" || kind === "lower-next") return 3;
  return 2;
}

/** The old hidden-letter prompt. Exercise 4 asks a different question on purpose. */
export const MEMORY_LETTER_PROMPT = "What letter is this?";

const OLD_MEMORY_START = 51;
const OLD_MEMORY_END = 76;

function recallSlot(letter: string): number {
  const at = letter.toLowerCase().charCodeAt(0) - 97;
  const start = bandItems("LK").findIndex((item) => item.kind === "recall");
  const base = start >= 0 ? start : 52;
  return base + Math.min(25, Math.max(0, at));
}

/**
 * Old saves used indexes 51-76 and ids lk-name-a for the hidden "What letter is this?" cards.
 * Those places move to exercise 4. A new card in that index range keeps its own id or answer letter.
 */
export function migrateAlphabetIndex(input: {
  index?: number | null;
  word?: string | null;
  prompt?: string | null;
}): number {
  const word = (input.word ?? "").trim().toLowerCase();
  const index = Number.isInteger(input.index) ? Number(input.index) : null;
  const named = word.match(/(?:^|:)lk-name-([a-z])(?:$|:)/);
  if (named?.[1]) return recallSlot(named[1]);
  const after = word.match(/^lk-after-([a-z])$/);
  if (after?.[1]) {
    const found = bandItems("LK").findIndex((item) => item.id === `lk-lower-${after[1]}`);
    if (found >= 0) return found;
  }
  if ((input.prompt ?? "").trim() === MEMORY_LETTER_PROMPT) {
    const known = word ? bandItems("LK").some((item) => item.id === word) : false;
    // A live card already has a current id. A leftover memory prompt must not slide that card forward.
    if (!known) {
      if (index != null && index >= OLD_MEMORY_START && index <= OLD_MEMORY_END) {
        return recallSlot(String.fromCharCode(97 + index - OLD_MEMORY_START));
      }
      return recallSlot("a");
    }
  }
  if (index != null && index >= OLD_MEMORY_START && index <= OLD_MEMORY_END) {
    const oldLetter = String.fromCharCode(97 + (index - OLD_MEMORY_START));
    if (!word || word === oldLetter) return recallSlot(oldLetter);
  }
  if (index == null && word) {
    const found = bandItems("LK").findIndex((item) => item.id === word);
    if (found >= 0) return found;
  }
  return clampLetterIndex(index ?? 0);
}

/**
 * Lines the alphabet song speaks, in order.
 * The stage says the first letter at once, then one letter each `letterMs` until the song is done.
 */
export function songSpokenLines(): string[] {
  const letters = alphabet();
  const lines = [letters[0] ?? "A"];
  for (let ticks = 1; ticks < letters.length + 2; ticks += 1) {
    const frame = letterAtSongTime(ticks * SPELLING_LETTER_MS);
    if (frame.done) break;
    lines.push(frame.letter);
  }
  return lines;
}

/**
 * The question that follows the song.
 * Exercise 1 is the song. A saved place in exercise 4 or 5 stays on that exercise.
 * The old hidden prompt is never what the song opens.
 */
export function progressAfterSong(
  input: (Partial<LetterProgress> & { word?: string | null; prompt?: string | null }) | null | undefined,
): LetterProgress {
  const migrated = migrateAlphabetIndex({ index: input?.index, word: input?.word, prompt: input?.prompt });
  const state = normalizeLetterProgress({ ...input, index: migrated });
  const view = letterView(state);
  if (view.say.trim() === MEMORY_LETTER_PROMPT) {
    return { index: recallSlot("a"), silence: 0, wrong: 0 };
  }
  if (letterExercise(state.index) === 5) {
    return { index: state.index, silence: 0, wrong: 0 };
  }
  return state;
}

function exerciseGroup(kind: string | undefined): string {
  if (kind === "first-letter" || kind === "next-letter") return "upper";
  if (kind === "lower-letter" || kind === "lower-next") return "lower";
  if (kind === "recall") return "recall";
  if (kind === "recite") return "recite";
  return kind || "upper";
}

/** A step backward stays inside the current exercise, so the memory round does not fall back to A. */
function retreatIndex(index: number, count: number): number {
  const items = bandItems("LK");
  let start = clampLetterIndex(index);
  const group = exerciseGroup(items[start]?.kind);
  while (start > 0 && exerciseGroup(items[start - 1]?.kind) === group) start -= 1;
  const step = Math.max(0, Math.trunc(count) || 0);
  return Math.max(start, index - step);
}

function cueForLetter(letter: string, count: number): string[] {
  const letters = alphabet();
  const at = letters.indexOf(letter);
  if (at <= 0) return [];
  const start = Math.max(0, at - Math.max(0, Math.trunc(count) || 0));
  return letters.slice(start, at);
}

/**
 * Letter-phase answers. The rules come from `answerFlow` in the data file.
 * One miss stays on the letter. The second miss steps back by the small `back` count.
 * A miss never restarts at A. Silence asks the same card again and never moves the index.
 */
export function applyLetterAnswer(input: LetterProgress, outcome: LetterOutcome): LetterProgress {
  const state = normalizeLetterProgress(input);
  if (outcome === "correct") {
    const current = itemAt("LK", state.index);
    if (current.kind === "recite") return { index: state.index, silence: 0, wrong: 0 };
    const count = Math.max(1, bandMeta("LK").count);
    const next = state.index + 1 >= count ? 0 : state.index + 1;
    return { index: next, silence: 0, wrong: 0 };
  }
  const wrongRules = lists.answerFlow.wrong as FlowWrong[];
  if (outcome === "miss") {
    const step = state.wrong + 1;
    const rule = wrongRules.find((row) => row.times === step) ?? wrongRules[wrongRules.length - 1];
    if (rule?.action === "back") {
      return { index: retreatIndex(state.index, rule.letters ?? 1), silence: 0, wrong: 0 };
    }
    return { index: state.index, silence: 0, wrong: step };
  }
  // Silence re-asks this card. It must not step back: a second miss of speech on the D card
  // used to land on the card that shows A.
  return { index: state.index, silence: state.silence + 1, wrong: 0 };
}

/** What the student sees and says for the current letter, including the prior-letter cue after a miss. */
export function letterView(input: LetterProgress): LetterView {
  const progress = normalizeLetterProgress(input);
  const letters = alphabet();
  const meta = bandMeta("LK");
  const item = itemAt("LK", progress.index);
  const letter = (item.answer || letters[progress.index] || "A").trim().toUpperCase() || "A";
  const answer = item.answer || letter;
  if (progress.wrong > 0) {
    const cueRules = (lists.answerFlow.wrong as FlowWrong[]).filter((row) => row.action === "cue");
    const rule = [...cueRules].reverse().find((row) => (row.times ?? 1) <= progress.wrong) ?? cueRules[0];
    const cue = cueForLetter(letter, rule?.letters ?? 0);
    if (cue.length > 0) {
      return {
        id: `lk-cue-${cue.length}-${letter.toLowerCase()}`,
        index: progress.index,
        letter,
        silence: progress.silence,
        wrong: progress.wrong,
        kind: "cue",
        exercise: letterExercise(progress.index),
        itemKind: item.kind,
        cue,
        say: cue.join(lists.answerFlow.cueSayJoin),
        show: cue.join(lists.answerFlow.cueShowJoin),
        answer,
        also: item.also,
        shown: "",
        pair: "",
        band: "LK",
        name: meta.name,
      };
    }
  }
  return {
    id: item.id || `lk-${letter.toLowerCase()}`,
    index: progress.index,
    letter,
    silence: progress.silence,
    wrong: progress.wrong,
    kind: "ask",
    exercise: letterExercise(progress.index),
    itemKind: item.kind,
    cue: [],
    say: item.say,
    show: item.show,
    answer,
    also: item.also,
    shown: letterOnScreen(item.kind, item.letter, answer),
    pair: item.kind === "recall" ? `${answer} ${answer.toLowerCase()}` : "",
    band: "LK",
    name: meta.name,
  };
}

export function letterMoveNote(before: LetterProgress, outcome: LetterOutcome, after: LetterProgress): string {
  if (outcome === "correct") return "Heard.";
  if (outcome === "timeout" && after.index < before.index) return "No answer. The sequence goes back.";
  if (outcome === "timeout" && after.silence > before.silence) return "No answer. The same letter stays.";
  if (outcome === "miss" && after.index < before.index) return "Not yet. One letter back.";
  if (after.wrong > before.wrong) return "Not yet. The earlier letters are the prompt.";
  if (outcome === "timeout") return "No answer.";
  return "Not yet.";
}

export function spellingPrompt(band: SpBand, index: number, grade = 1): {
  id: string;
  stem: string;
  answer: string;
  aliases: string[];
  standard: string;
  note: string;
} {
  const card = spCard(band, index, grade);
  const stem = card.letter && card.show !== card.letter ? `${card.show} ${card.letter}`.trim() : card.show;
  return {
    id: `sp:${card.band}:${card.index}`,
    stem,
    answer: card.answer,
    aliases: card.also,
    standard: card.band,
    note: card.name,
  };
}

export function openingPrompt(): string {
  return lists.openingSay;
}
