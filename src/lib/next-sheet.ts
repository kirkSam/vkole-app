import type { Sql } from "@/lib/db";

const ORDER = [0, 1, 2, 3, 0, 1, 2, 3, 0, 1] as const;
const MEMORY = 400;

/** Dedupe key. Operators + - x / = stay, so 3 + 4 and 3 - 4 are different questions. */
export function questionKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[×✕✖*]/g, "x")
    .replace(/÷/g, "/")
    .replace(/[−–—]/g, "-")
    .replace(/[^a-z0-9+\-/=]+/g, "")
    .trim();
}

function at<T>(items: readonly T[], index: number): T {
  return items[Math.abs(index) % items.length]!;
}

function science(grade: number, n: number): string {
  if (grade > 12) return science(12, n + (grade - 12));
  if (grade <= 1) {
    const living = ["a tree", "a bird", "a fish", "a flower", "a dog", "a child"];
    const not = ["a rock", "a spoon", "a shoe", "a cup", "a brick", "a pencil"];
    const forms = [
      (a: string, b: string) => `Which one is a living thing? ${a} / ${b}`,
      (a: string, b: string) => `Which one needs food and water? ${a} / ${b}`,
      (a: string, b: string) => `Which one can grow? ${a} / ${b}`,
    ];
    return at(forms, n)(at(living, Math.floor(n / 3)), at(not, Math.floor(n / 18)));
  }
  if (grade <= 3) {
    const samples = ["water", "juice", "chocolate", "butter", "ice", "wax"];
    const forms = [
      (s: string) => `Ice and liquid ${s} are the same material. What kind of change is that?`,
      (s: string) => `${s[0]?.toUpperCase()}${s.slice(1)} can be a solid or a liquid. What changes, the material or the state?`,
      (s: string) => `Heating can melt solid ${s}. What change is that?`,
    ];
    return at(forms, n)(at(samples, Math.floor(n / 3)));
  }
  if (grade <= 5) {
    const plants = ["grass", "algae", "oak leaves", "corn", "kelp", "clover", "wheat", "moss"];
    const animals = ["rabbit", "minnow", "deer", "cricket", "mouse", "sparrow", "tadpole", "snail"];
    const plant = at(plants, Math.floor(n / 4));
    const animal = at(animals, Math.floor(n / 32));
    const forms = [
      `If the ${plant} are gone from a food chain, the ${animal} has less to eat. What does the ${animal} lose?`,
      `A food chain that includes ${plant} and a ${animal} gets its energy from the sun first. Which comes first, the ${plant} or the ${animal}?`,
      `Which comes first in this food chain, the ${plant} or the ${animal} that eats it?`,
      `The ${animal} eats the ${plant}. Where does the energy in that food chain start?`,
    ];
    return at(forms, n);
  }
  if (grade <= 8) {
    const elements = ["carbon", "oxygen", "iron", "helium", "sodium", "gold"];
    const forms = [
      (e: string) => `An atom of ${e} is identified mainly by which particle count?`,
      (e: string) => `What stays the same when an atom of ${e} is still ${e}?`,
      (e: string) => `Two atoms are both ${e} only if they have the same number of which particle?`,
    ];
    return at(forms, n)(at(elements, Math.floor(n / 3)));
  }
  if (grade <= 12) {
    const traits = ["a thicker coat", "a longer beak", "a darker shell", "faster legs"];
    const forms = [
      (t: string) => `Natural selection can spread ${t} when that trait changes what?`,
      (t: string) => `A population keeps ${t} more often when that trait helps what?`,
      (t: string) => `${t[0]?.toUpperCase()}${t.slice(1)} becomes more common only if it is passed on and affects what?`,
    ];
    return at(forms, n)(at(traits, Math.floor(n / 3)));
  }
  return science(12, n);
}

function numbers(grade: number, n: number): string {
  const a = (n % 30) + 1;
  const b = (Math.floor(n / 30) % 30) + 1;
  if (grade <= 1) return `${a} + ${b} =`;
  if (grade <= 2) return `${20 + a} + ${20 + b} =`;
  if (grade <= 3) return `${a + 2} × ${b + 2} =`;
  if (grade === 4) return `${a}/${a + b + 1} + ${b}/${a + b + 1} =`;
  if (grade === 5) return `${a}.5 + ${b}.5 =`;
  if (grade === 6) return `The ratio ${a}:${a + b} equals what ratio with a first term of 1?`;
  if (grade === 7) return `${a}x = ${a * (b + 1)}. x =`;
  if (grade === 8) return `${a}^2 =`;
  return `${a}x + ${b} = ${a * 2 + b}. x =`;
}

function civics(grade: number, n: number): string {
  if (grade <= 2) {
    const rules = ["walk in the hall", "take turns", "keep hands to yourself", "listen when someone speaks"];
    const forms = [
      (r: string) => `A classroom rule to ${r} is mainly for what?`,
      (r: string) => `Who is helped when the class agrees to ${r}?`,
      (r: string) => `Why does a class keep a rule to ${r}?`,
    ];
    return at(forms, n)(at(rules, Math.floor(n / 3)));
  }
  if (grade <= 4) {
    const jobs = ["serving on a jury when called", "following a law", "voting when of age", "telling the truth in class"];
    const forms = [
      (j: string) => `Which is a responsibility, not only a right? ${j} / ignoring a rule`,
      (j: string) => `${j[0]?.toUpperCase()}${j.slice(1)} is a duty. What do we call that kind of duty?`,
      (j: string) => `A right can be used freely. ${j[0]?.toUpperCase()}${j.slice(1)} is asked of a person. Which one is the responsibility?`,
    ];
    return at(forms, n)(at(jobs, Math.floor(n / 3)));
  }
  const branches = [
    ["legislative branch", "makes the laws", "make"],
    ["executive branch", "carries out the laws", "carry out"],
    ["judicial branch", "decides what the laws mean", "decide"],
  ] as const;
  const scenes = ["a statute", "a veto", "a verdict", "an amendment", "a hearing", "a ballot", "a treaty", "a tax"];
  const [name, does, verb] = at(branches, Math.floor(n / 4));
  const scene = at(scenes, Math.floor(n / 12));
  const forms = [
    `The ${name} ${does}. What does that branch ${verb}?`,
    `Which branch ${does} when the matter is ${scene}?`,
    `Name the branch that ${does}.`,
    `If the question is who ${does} in a case about ${scene}, which branch is it?`,
  ];
  return at(forms, n);
}

function vocabulary(grade: number, n: number): string {
  const early: readonly (readonly [string, string, string])[] = [
    ["children", "child", "spoon"],
    ["cold", "hot", "pencil"],
    ["before", "after", "bucket"],
    ["many", "few", "marble"],
    ["large", "tiny", "ladder"],
    ["empty", "full", "napkin"],
  ];
  const middle: readonly (readonly [string, string, string])[] = [
    ["because", "table", "blue"],
    ["although", "chair", "green"],
    ["since", "pencil", "round"],
    ["unless", "window", "loud"],
    ["while", "basket", "soft"],
    ["until", "candle", "sharp"],
    ["whether", "marble", "quiet"],
    ["if", "bucket", "heavy"],
  ];
  const later: readonly (readonly [string, string, string])[] = [
    ["empirical", "rhyming", "royal"],
    ["hypothesis", "pronoun", "continent"],
    ["variable", "stanza", "ballot"],
    ["precise", "sleepy", "lateral"],
    ["inference", "carpet", "marble"],
    ["evidence", "kitchen", "purple"],
  ];
  const bank = grade < 4 ? early : grade < 8 ? middle : later;
  const [right, wrongA, wrongB] = at(bank, Math.floor(n / 3));
  const place = at(["in a sentence", "in a paragraph", "in a report", "in a claim", "in a reason", "in a question"], Math.floor(n / 18));
  const prompts = [
    `Which word fits this academic question ${place}? ${right} / ${wrongA} / ${wrongB}`,
    `Which word names the idea, not the object, ${place}? ${right} / ${wrongA}`,
    `Choose the academic word ${place}. ${wrongA} / ${right} / ${wrongB}`,
  ];
  if (grade >= 4 && grade < 8) {
    const joins = [
      `Which word is a conjunction ${place}? ${right} / ${wrongA} / ${wrongB}`,
      `Which word connects two ideas ${place}? ${right} / ${wrongA}`,
      `Which word can join two thoughts ${place}? ${wrongB} / ${right}`,
    ];
    return at(joins, n);
  }
  return at(prompts, n);
}

function compose(step: number, grade: number, n: number): string {
  const level = Math.max(1, Math.round(grade));
  if (step === 1) return numbers(level, n);
  if (step === 2) return civics(level, n);
  if (step === 3) return vocabulary(level, n);
  return science(level, n);
}

export function fillSheet(grade: number, used: Set<string>): { prompts: string[]; keys: string[] } | null {
  const prompts: string[] = [];
  const keys: string[] = [];
  const local = new Set(used);
  for (const step of ORDER) {
    let found = "";
    let key = "";
    for (let n = 0; n < 240; n += 1) {
      const line = compose(step, grade, n).replace(/\s+/g, " ").trim();
      const next = questionKey(line);
      if (!next || local.has(next)) continue;
      found = line;
      key = next;
      break;
    }
    if (!found) return null;
    local.add(key);
    prompts.push(found);
    keys.push(key);
  }
  return prompts.length === 10 ? { prompts, keys } : null;
}

export async function ensureSeen(sql: Sql) {
  await sql`
    create table if not exists seen_prompts (
      user_id text not null,
      child_key text not null,
      prompt_key text not null,
      seen_at timestamptz not null default now(),
      primary key (user_id, child_key, prompt_key)
    )
  `;
}

function childKey(name: string) {
  return name.trim().toLowerCase();
}

export async function seenKeys(sql: Sql, userId: string, childName: string): Promise<Set<string>> {
  await ensureSeen(sql);
  const rows = await sql<{ prompt_key: string }>`
    select prompt_key from seen_prompts
    where user_id = ${userId} and child_key = ${childKey(childName)}
  `;
  return new Set(rows.map((row) => row.prompt_key));
}

const POOL_VARIANT_ID = /^(m|ela|ss|gen|sg):\d+:\d+:\d+$/;

/**
 * Text the website uses as a practice-sheet key.
 * Sight words use the word, phonemic awareness the spoken line,
 * Math Game the generator prompt, and alphabet the bare letter.
 */
export function practicePromptText(
  subject: string,
  fields: { word?: string; say?: string; letter?: string; question?: string; prompt?: string },
): string {
  const clean = (value: string | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
  if (subject === "sw") return clean(fields.word) || clean(fields.question);
  if (subject === "pa") return clean(fields.say) || clean(fields.question);
  if (subject === "mg") return clean(fields.prompt) || clean(fields.question);
  if (subject === "sp") {
    const letter = clean(fields.letter);
    return /^[A-Za-z]$/.test(letter) ? letter.toUpperCase() : "";
  }
  const question = clean(fields.question) || clean(fields.prompt);
  if (!question || POOL_VARIANT_ID.test(question)) return "";
  return question;
}

/** Prompt text from one saved answer. A pool variant id is not a prompt. */
export function practicePromptFromDetail(subject: string, detail: string): string {
  let row: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(detail) as unknown;
    if (parsed && typeof parsed === "object") row = parsed as Record<string, unknown>;
  } catch {
    row = null;
  }
  if (!row) return practicePromptText(subject, { question: detail });
  const text = (key: string) => (typeof row?.[key] === "string" ? String(row[key]) : "");
  return practicePromptText(subject, {
    word: text("word"),
    say: text("say"),
    letter: text("letter"),
    question: text("question"),
    prompt: text("prompt"),
  });
}

/** The prompt to send. Stored variant ids are not prompts. */
export function seenWirePrompt(item: { key?: string; text?: string }): string {
  const text = (item.text ?? "").replace(/\s+/g, " ").trim();
  if (!text || POOL_VARIANT_ID.test(text)) return "";
  return text;
}

/**
 * Newest local prompts, up to 400. Stored rows come first by time, then
 * answer history, so the first sync still carries past play.
 */
export function mergeLocalSeen(
  stored: { at?: unknown; key?: string; text?: string }[],
  events: { at?: unknown; subject: string; detail: string }[],
): { key: string; text: string }[] {
  const rows: { at: number; text: string }[] = [];
  const stamp = (value: unknown) => {
    if (value instanceof Date) return value.getTime();
    const parsed = Date.parse(String(value ?? ""));
    return Number.isNaN(parsed) ? 0 : parsed;
  };
  for (const row of stored) {
    const text = seenWirePrompt({ key: row.key, text: row.text });
    if (text) rows.push({ at: stamp(row.at), text });
  }
  for (const event of events) {
    const text = practicePromptFromDetail(event.subject, event.detail);
    if (text) rows.push({ at: stamp(event.at), text });
  }
  rows.sort((a, b) => b.at - a.at);
  const unique: { key: string; text: string }[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const dedupe = row.text.toLowerCase();
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    unique.push({ key: dedupe, text: row.text });
    if (unique.length >= MEMORY) break;
  }
  return unique;
}

export async function rememberPrompt(sql: Sql, userId: string, childName: string, prompt: string, variantId?: string) {
  const key = variantId?.trim() || questionKey(prompt);
  if (!key) return;
  await ensureSeen(sql);
  await sql`alter table seen_prompts add column if not exists prompt_text text`;
  const name = childKey(childName);
  await sql`
    insert into seen_prompts (user_id, child_key, prompt_key, prompt_text)
    values (${userId}, ${name}, ${key}, ${prompt})
    on conflict (user_id, child_key, prompt_key) do update
      set seen_at = now(), prompt_text = ${prompt}
  `;
  await sql`
    delete from seen_prompts
    where user_id = ${userId} and child_key = ${name}
      and prompt_key in (
        select prompt_key from seen_prompts
        where user_id = ${userId} and child_key = ${name}
        order by seen_at desc
        offset ${MEMORY}
      )
  `;
}
