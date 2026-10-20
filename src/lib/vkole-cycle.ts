import { subjectMeta, type SubjectId } from "@/lib/climb-rules";
import { capVkoleGrade, moveVkoleRung } from "@/lib/vkole-cap";
import { poolCount, poolQuestion } from "@/lib/question-pool";
import { studentFacingReply } from "@/lib/space-xsi";

const SUBJECT_NAME: Record<SubjectId, string> = {
  m: "Mathematics",
  ela: "English Language Arts",
  ss: "Social Studies",
  gen: "General",
  sg: "Singapore mathematics",
  sw: "Sight words",
  sp: "Alphabet",
  pa: "Phonemic awareness",
};

export type CycleReply = {
  correct: boolean;
  feedback: string;
  move: "up" | "stay" | "down";
  grade: number;
  code: string;
  label: string;
  nextPrompt: string;
};

export type CycleState = {
  level: number;
  step?: number;
  correctAtLevel: number;
  incorrectStreak: number;
  asked: number;
  rightCount: number;
};

export function clampStoredGrade(level: number): number {
  return capVkoleGrade(level);
}

export function localItem(
  subject: SubjectId,
  level: number,
  step = 0,
): { prompt: string; code: string; label: string; answer: string; aliases: string[]; id: string } {
  const grade = clampStoredGrade(level);
  const rung = Math.min(2, Math.max(0, Math.round(step)));
  const count = poolCount(subject, grade, rung);
  const index = Math.floor(Math.random() * count);
  const question = poolQuestion(subject, grade, rung, index);
  return {
    prompt: question.stem,
    code: question.standard,
    label: question.note,
    answer: question.answer,
    aliases: question.aliases,
    id: question.id,
  };
}

const UNSEEN_TEXT = /\b(the passage|this passage|the excerpt|the article|the story|the poem|the essay|the speech|paragraph \d+|the text above|the reading above)\b/i;

/** If the model points at a text the child cannot see, supply a question that includes its own text. */
export function questionTheChildCanSee(
  prompt: string,
  subject: SubjectId,
  grade: number,
): { prompt: string; code: string; label: string } | null {
  const text = prompt.trim();
  if (!UNSEEN_TEXT.test(text)) return null;
  const showsTheText = /read\s*:/i.test(text) || /[“"][^"”]{40,}[”"]/.test(text);
  if (showsTheText) return null;
  if (subject === "ela") {
    for (let i = 0; i < 8; i += 1) {
      const item = localItem(subject, grade);
      if (/read\s*:/i.test(item.prompt)) return item;
    }
  }
  return localItem(subject, grade);
}

export function childFeedback(text: string): string {
  return childText(text, true);
}

export function childText(text: string, keepBreaks: boolean): string {
  return studentFacingReply(text, keepBreaks);
}

function parseJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    /* A passage or explanation often contains a raw line break, which is not valid JSON. */
  }
  let repaired = "";
  let inString = false;
  let escaped = false;
  for (const ch of slice) {
    if (inString) {
      if (escaped) {
        repaired += ch;
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        repaired += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        repaired += ch;
        inString = false;
        continue;
      }
      if (ch === "\n") {
        repaired += "\\n";
        continue;
      }
      if (ch === "\r") continue;
      repaired += ch;
      continue;
    }
    if (ch === '"') inString = true;
    repaired += ch;
  }
  try {
    return JSON.parse(repaired);
  } catch {
    return null;
  }
}

export function parseCycle(text: string): CycleReply | null {
  const raw = parseJsonObject(text);
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const grade = Number(row.grade);
  const correct = row.correct === true || row.correct === "true";
  const incorrect = row.correct === false || row.correct === "false";
  if (!correct && !incorrect) return null;
  const move = row.move === "up" || row.move === "down" || row.move === "stay" ? row.move : "stay";
  if (typeof row.feedback !== "string" || !row.feedback.trim()) return null;
  if (typeof row.nextPrompt !== "string" || !row.nextPrompt.trim()) return null;
  if (typeof row.code !== "string" || !row.code.trim()) return null;
  if (typeof row.label !== "string" || !row.label.trim()) return null;
  if (!Number.isInteger(grade)) return null;
  const feedback = childFeedback(row.feedback);
  const nextPrompt = childText(row.nextPrompt, true);
  if (!feedback || !nextPrompt) return null;
  return {
    correct,
    feedback,
    move,
    grade,
    code: row.code.trim(),
    label: row.label.trim(),
    nextPrompt,
  };
}

/** Two correct answers move up one step. The grade changes only after abstract. Two misses move down one step. */
export function applyCycle(current: CycleState, reply: Pick<CycleReply, "correct" | "move">): CycleState & { reached: boolean } {
  const correctStreak = Number(current.correctAtLevel);
  const missStreak = Number(current.incorrectStreak);
  const moved = moveVkoleRung({
    grade: clampStoredGrade(Number(current.level)),
    step: current.step ?? 0,
    correct: reply.correct,
    correctStreak: Number.isFinite(correctStreak) && correctStreak > 0 ? correctStreak : 0,
    missStreak: Number.isFinite(missStreak) && missStreak > 0 ? missStreak : 0,
  });
  return {
    level: moved.grade,
    step: moved.step,
    correctAtLevel: moved.correctAtLevel,
    incorrectStreak: moved.incorrectStreak,
    asked: current.asked + 1,
    rightCount: current.rightCount + (reply.correct ? 1 : 0),
    reached: reply.correct,
  };
}

export function sequenceSentence(beforeLevel: number, applied: CycleState & { reached: boolean }): string {
  const level = clampStoredGrade(applied.level);
  const before = clampStoredGrade(beforeLevel);
  if (level > before) return `Two correct answers on the abstract step. The level moves up to grade ${level}.`;
  if (level < before) return `Two incorrect answers in a row. The level moves down to grade ${level}.`;
  if (applied.reached && applied.correctAtLevel === 0) return "Two correct answers in a row. The next question is one step up.";
  if (!applied.reached && applied.incorrectStreak === 0) return "Two incorrect answers in a row. The next question is one step down.";
  if (applied.reached) return `Correct. ${applied.correctAtLevel} of 2 at this step.`;
  return `Not correct. Miss ${applied.incorrectStreak} of 2 at this step.`;
}

export function cycleInstruction(input: {
  subject: SubjectId;
  startGrade: number;
  grade: number;
  code: string;
  label: string;
  correctStreak: number;
  incorrectStreak: number;
  question: string;
  answer: string;
  recentPrompts?: string[];
}): string {
  const name = SUBJECT_NAME[input.subject] ?? subjectMeta(input.subject).name;
  const recent = (input.recentPrompts ?? []).map((prompt) => prompt.trim()).filter(Boolean).slice(0, 50);
  return [
    "You are VKOLE/ZPD - Space XSI Integrated Learning Engine.",
    "Do only these three jobs: grade the answer correct or incorrect; keep the standard the app already chose; write exactly one next question, with no answer in it.",
    input.subject === "m" || input.subject === "sg"
      ? "A mathematics question must stand alone. Do not refer to a passage."
      : "If the next question depends on something the child must read, put the whole text in nextPrompt. Use exactly this shape: a line that says Read:, then four to six sentences a child at this grade can read, then a blank line, then a line that says Question:, then one question about only those sentences. Never mention a passage, article, story, poem, speech, or paragraph that is not inside Read.",
    "The app moves the standard. Two correct answers in a row rise one standard. One incorrect answer stays. Two incorrect answers in a row fall one standard. The grade number stops at 12. Two correct answers on grade 12, standard 3 stay there, and the grade 12 questions rotate. Do not open grade 13. Echo move as stay and echo the current grade. Write the next question on the current standard only.",
    "Feedback shows the right answer, then a small explanation. Use exactly this shape: a line that says Answer:, the right answer, a blank line, then a line that says Explanation:, then one or two short sentences a child can read. Do this whether the child was correct or incorrect. No sarcasm.",
    'Return only this JSON: {"correct":boolean,"feedback":string,"move":"up"|"stay"|"down","grade":number,"code":string,"label":string,"nextPrompt":string}. Inside the JSON, write line breaks as \\n. Do not put a raw line break inside the JSON.',
    `Subject: ${name}.`,
    `Starting grade: ${input.startGrade}.`,
    `Current grade: ${input.grade}.`,
    `Standard code: ${input.code}.`,
    `Standard label: ${input.label}.`,
    `Correct-in-a-row streak: ${input.correctStreak}.`,
    `Incorrect-in-a-row streak: ${input.incorrectStreak}.`,
    `Question: ${input.question}`,
    `Answer: ${input.answer}`,
    recent.length
      ? `The student has already seen these questions. Do not write a next question that repeats one of them or a near-duplicate:\n${recent.map((prompt, index) => `${index + 1}. ${prompt}`).join("\n")}`
      : "Do not repeat a question this student has already seen.",
  ].join("\n");
}

export type GradeCall =
  | { outcome: "graded"; reply: CycleReply }
  | { outcome: "absent" }
  | { outcome: "unreadable" };

/** A grader reply that cannot be read is marked incorrect. The level rules stay the same. */
export function unreadableReply(input: { grade: number; code: string; label: string; nextPrompt: string }): CycleReply {
  return {
    correct: false,
    feedback: "",
    move: "stay",
    grade: input.grade,
    code: input.code,
    label: input.label,
    nextPrompt: input.nextPrompt,
  };
}

export async function requestCycle(instruction: string): Promise<GradeCall> {
  const key = process.env.XAI_API_KEY?.trim();
  if (!key) return { outcome: "absent" };
  let response: Response;
  try {
    response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4-1-fast-non-reasoning",
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          { role: "system", content: "Return only the JSON object. No markdown." },
          { role: "user", content: instruction },
        ],
      }),
    });
  } catch {
    return { outcome: "absent" };
  }
  if (!response.ok) return { outcome: "absent" };
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { outcome: "absent" };
  }
  const text = (body as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content;
  if (typeof text !== "string") return { outcome: "absent" };
  const reply = parseCycle(text);
  if (!reply) return { outcome: "unreadable" };
  return { outcome: "graded", reply };
}
