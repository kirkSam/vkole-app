import { APP_NAME, SCHOOL_EMAIL, SCHOOL_NAME } from "@/lib/brand";
import { levelLabel, SUBJECTS, subjectMeta, type SubjectId } from "@/lib/climb-rules";

export const TRIAL_DAYS = 7;
export const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;
export const IDLE_MS = 5 * 60 * 1000;

export type TrialState = {
  startedAt: string;
  endsAt: string;
  daysLeft: number;
  expired: boolean;
};

export function trialState(startedAt: string, now = Date.now()): TrialState {
  const start = new Date(startedAt).getTime();
  const end = start + TRIAL_MS;
  const msLeft = end - now;
  return {
    startedAt: new Date(start).toISOString(),
    endsAt: new Date(end).toISOString(),
    daysLeft: msLeft <= 0 ? 0 : Math.ceil(msLeft / (24 * 60 * 60 * 1000)),
    expired: msLeft <= 0,
  };
}

export type ReportEvent = {
  at: string;
  detail: string;
  levelAfter: number;
  correct?: boolean;
};

export type EndReason = "logout" | "inactivity" | "finished";

export type AppTime = {
  subject: SubjectId;
  level: number | null;
  earnedLevel: number | null;
  onlineSeconds: number;
  loggedIn: boolean;
};

export function formatAppTimes(apps: AppTime[]): string {
  const bySubject = new Map(apps.map((app) => [app.subject, app]));
  return SUBJECTS.map((program) => {
    const app = bySubject.get(program.id);
    const seconds = app?.onlineSeconds ?? 0;
    const time = formatOnline(seconds);
    if (!app?.loggedIn) {
      return `VKOLE/${program.code}: ${time}. The child did not log in.`;
    }
    const standing = app.level == null ? "" : `, ${levelLabel(app.level)}`;
    return `VKOLE/${program.code}${standing}: ${time}`;
  }).join("\n");
}

export function formatOnline(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (minutes) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  if (rem || parts.length === 0) parts.push(`${rem} second${rem === 1 ? "" : "s"}`);
  return parts.join(" ");
}

export function parentLogoutLetter(input: {
  parentName: string;
  parentEmail: string;
  children: { firstName: string; apps: AppTime[] }[];
}): { subject: string; body: string; recipient: string } {
  const lines =
    input.children.length === 0
      ? "No children are enrolled."
      : input.children.map((child) => `${child.firstName}\n${formatAppTimes(child.apps)}`).join("\n\n");
  const subject = `${APP_NAME}: The parent logged out`;
  const body = [
    APP_NAME,
    "",
    "The parent logged out.",
    "",
    `Parent: ${input.parentName}`,
    `Account: ${input.parentEmail}`,
    "",
    "Children on this account:",
    lines,
    "",
    "Respectfully submitted,",
    APP_NAME,
    `Sent to the email given at registration: ${input.parentEmail}.`,
  ].join("\n");
  return { subject, body, recipient: input.parentEmail };
}

export function endReasonSentence(reason: EndReason): string {
  if (reason === "inactivity") return "The student was logged out after 5 minutes of inactivity.";
  if (reason === "finished") return "The child pressed Finished.";
  return "The student left this engine. The other engines stay open.";
}

export function academicLetter(input: {
  firstName: string;
  age: number;
  subject: SubjectId;
  level: number;
  performanceLevel?: number;
  startGrade?: number | null;
  standardCode?: string;
  standardLabel?: string;
  asked: number;
  rightCount: number;
  trial: TrialState;
  events: ReportEvent[];
  parentEmail?: string | null;
  apps?: AppTime[];
  assignments?: string[];
  subscribed?: boolean;
  subscriptionEndsAt?: string | null;
  registeredAt?: string | null;
  moved?: "up" | "down" | null;
  sheet?: string[];
  session?: {
    reason: EndReason;
    sittingSeconds: number;
    totalSeconds: number;
  };
}): { subject: string; body: string; html: string; recipient: string } {
  const meta = subjectMeta(input.subject);
  const name = clean(input.firstName) || "This student";
  const engine = `VKOLE/${meta.code}`;
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const start = input.startGrade ?? input.level;
  const code = clean(input.standardCode ?? "");
  const label = clean(input.standardLabel ?? "");
  const gradeWord = input.level <= 0 ? "Grade K" : `Grade ${input.level}`;
  const current = code
    ? `${gradeWord}, Common Core ${code}${label ? `, ${label}` : ""}`
    : gradeWord;
  const work = input.events.slice(0, 40).map((event) => readWork(event, engine));
  const reached = work.some((item) => item.correct != null)
    ? work.filter((item) => item.correct).length
    : input.rightCount;
  const missed = work.some((item) => item.correct != null)
    ? work.filter((item) => item.correct === false).length
    : Math.max(0, input.asked - input.rightCount);
  const registered = new Date(input.registeredAt || input.trial.startedAt);
  const freeEnd = new Date(registered.getTime() + TRIAL_MS);
  const when = freeEnd.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
  const account = [
    `The free week for ${name} ends ${when}. The free week is 168 hours from the moment that student was registered. Another student does not move it.`,
    `After the free week, the price is $9.00 USD plus tax a month, or $79.00 USD plus tax a year. It auto-renews until cancelled by email at ${SCHOOL_EMAIL}.`,
    "The level and the free week follow the account's login. This email is the same report on a phone or a laptop.",
  ];
  const movement =
    input.moved === "up"
      ? `${name} finished this sitting. Two correct answers moved the work up one Common Core standard. The next assignment is on that standard. A question already given is not used again.`
      : input.moved === "down"
        ? `${name} finished this sitting. Two incorrect answers moved the work down one Common Core standard. The next assignment is on that standard. A question already given is not used again.`
        : "";
  const sheet = (input.sheet ?? []).filter((line) => clean(line)).slice(0, 10);
  const printed = sheet.length === 10 ? sheet : [];
  const ended = input.session ? endReasonSentence(input.session.reason) : "";
  const sittingTime = input.session ? formatOnline(input.session.sittingSeconds) : "";
  const engineTime = input.session ? formatOnline(input.session.totalSeconds) : "";
  const privacy = `This report is sent only to the email used when ${name} was registered. It is not sent to any other address.`;
  const subject = `${APP_NAME} progress report for ${name}`;
  const body = [
    SCHOOL_NAME,
    `Progress report for ${name}`,
    APP_NAME,
    "",
    privacy,
    "",
    "Sitting",
    `Student: ${name}`,
    `Date: ${date}`,
    `Engine: ${engine}`,
    `Starting grade: ${start}`,
    `Current level: ${current}`,
    `This sitting: ${reached} reached, ${missed} missed`,
    ...(ended ? [`How this sitting ended: ${ended}`] : []),
    ...(sittingTime ? [`Time in this sitting: ${sittingTime}`] : []),
    ...(engineTime ? [`Time on this engine: ${engineTime}`] : []),
    ...(movement ? ["", movement] : []),
    "",
    "Account",
    ...account,
    "",
    "Work",
    work.length ? work.map((item, index) => workText(index + 1, item)).join("\n\n") : "No items have been recorded in this period.",
    ...(printed.length
      ? ["", "Print this assignment", "Write each answer on the line. Science, numbers, civics, and academic vocabulary.", ...printed.map((line, index) => `${index + 1}. ${line}\n______________________________`)]
      : []),
    "",
    SCHOOL_EMAIL,
  ].join("\n");
  const html = reportHtml({ name, engine, date, start, current, reached, missed, account, work, sheet: printed, privacy, movement, ended, sittingTime, engineTime });
  return { subject, body, html, recipient: input.parentEmail?.trim() || "" };
}

function clean(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
}

type WorkItem = {
  correct: boolean | null;
  engine: string;
  code: string;
  label: string;
  grade: string;
  question: string;
  answer: string;
  note: string;
};

function readWork(event: ReportEvent, engine: string): WorkItem {
  try {
    const row = JSON.parse(event.detail) as Partial<WorkItem>;
    if (row && typeof row === "object" && (row.question || row.note)) {
      const answer = clean(String(row.answer ?? ""));
      return {
        correct: typeof row.correct === "boolean" ? row.correct : event.correct ?? null,
        engine: clean(row.engine || engine),
        code: clean(row.code || ""),
        label: clean(row.label || ""),
        grade: clean(row.grade || String(event.levelAfter)),
        question: clean(row.question || ""),
        answer: answer || "(blank)",
        note: clean(row.note || ""),
      };
    }
  } catch {
    /* Older records stored a sentence, not a work card. */
  }
  return {
    correct: event.correct ?? null,
    engine,
    code: "",
    label: "",
    grade: String(event.levelAfter),
    question: "",
    answer: "(blank)",
    note: clean(event.detail),
  };
}

function workText(index: number, item: WorkItem): string {
  const title = item.correct === false ? "Not yet" : item.correct ? "Correct" : "Recorded";
  return [
    `${index}. ${title}`,
    `Engine: ${item.engine}`,
    item.code ? `Common Core: ${item.code}` : "",
    item.label ? `Level: ${item.label}` : "",
    `Grade: ${item.grade}`,
    item.question ? `Question: ${item.question}` : "",
    `Answer: ${item.answer || "(blank)"}`,
    item.note ? `Note: ${item.note}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;");
}

function reportHtml(input: {
  name: string;
  engine: string;
  date: string;
  start: number;
  current: string;
  reached: number;
  missed: number;
  account: string[];
  work: WorkItem[];
  sheet: string[];
  privacy: string;
  movement: string;
  ended: string;
  sittingTime: string;
  engineTime: string;
}): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:7px 0;border-bottom:1px solid #e4ebe6;font-family:Georgia,serif;font-size:13px;color:#5c6b63;width:132px;vertical-align:top;">${esc(label)}</td><td style="padding:7px 0;border-bottom:1px solid #e4ebe6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:16px;color:#1d2420;">${esc(value)}</td></tr>`;
  const cards = input.work.length
    ? input.work
        .map((item, index) => {
          const missed = item.correct === false;
          const title = missed ? "Not yet" : item.correct ? "Correct" : "Recorded";
          const color = missed ? "#8f2d2d" : "#2c5e4a";
          const lines = [
            item.engine ? `<div><strong>Engine:</strong> ${esc(item.engine)}</div>` : "",
            item.code ? `<div><strong>Common Core:</strong> ${esc(item.code)}</div>` : "",
            item.label ? `<div><strong>Level:</strong> ${esc(item.label)}</div>` : "",
            `<div><strong>Grade:</strong> ${esc(item.grade)}</div>`,
            item.question ? `<div style="margin-top:8px;"><strong>Question:</strong> ${esc(item.question)}</div>` : "",
            `<div><strong>Answer:</strong> ${esc(item.answer || "(blank)")}</div>`,
            item.note ? `<div style="margin-top:8px;"><strong>Note:</strong> ${esc(item.note)}</div>` : "",
          ].join("");
          return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;border:1px solid #d7e0da;border-left:4px solid ${color};"><tr><td style="padding:12px 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.45;color:#1d2420;"><div style="color:${color};font-weight:700;">${index + 1}. ${title}</div>${lines}</td></tr></table>`;
        })
        .join("")
    : `<p style="margin:0;font-size:15px;color:#1d2420;">No items have been recorded in this period.</p>`;
  const movement = input.movement
    ? `<tr><td style="padding:0 20px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.45;color:#1d2420;">${esc(input.movement)}</td></tr>`
    : "";
  const sheet =
    input.sheet.length === 10
      ? `<tr><td style="padding:12px 20px 4px;font-family:Georgia,serif;font-size:18px;color:#2c5e4a;">Print this assignment</td></tr><tr><td style="padding:0 20px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.45;color:#1d2420;">Write each answer on the line. Science, numbers, civics, and academic vocabulary.</td></tr><tr><td style="padding:0 20px 16px;">${input.sheet
          .map(
            (line, index) =>
              `<div style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.45;color:#1d2420;"><div>${index + 1}. ${esc(line)}</div><div style="margin-top:10px;border-bottom:1px solid #1d2420;height:28px;"></div></div>`,
          )
          .join("")}</td></tr>`
      : "";
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#e7efe9;"><div style="display:none;max-height:0;overflow:hidden;">Progress report for ${esc(input.name)}. ${input.reached} reached, ${input.missed} missed.</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e7efe9;padding:16px 8px;"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffdf8;border:1px solid #d7e0da;"><tr><td style="background:#173028;border-top:4px solid #c6a15a;padding:22px 20px;color:#f6f1e7;"><div style="font-family:Georgia,'Times New Roman',serif;font-size:13px;letter-spacing:0.08em;">${esc(SCHOOL_NAME)}</div><div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.2;margin-top:8px;">Progress report for ${esc(input.name)}</div><div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:1.4;margin-top:8px;color:#e7efe9;">${esc(APP_NAME)}</div></td></tr><tr><td style="padding:18px 20px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.5;color:#1d2420;">${esc(input.privacy)}</td></tr><tr><td style="padding:8px 20px 4px;font-family:Georgia,'Times New Roman',serif;font-size:18px;color:#2c5e4a;">Sitting</td></tr><tr><td style="padding:0 20px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${row("Student", input.name)}${row("Date", input.date)}${row("Engine", input.engine)}${row("Starting grade", String(input.start))}${row("Current level", input.current)}${row("This sitting", `${input.reached} reached, ${input.missed} missed`)}${input.ended ? row("How this sitting ended", input.ended) : ""}${input.sittingTime ? row("Time in this sitting", input.sittingTime) : ""}${input.engineTime ? row("Time on this engine", input.engineTime) : ""}</table></td></tr>${movement}<tr><td style="padding:12px 20px 4px;font-family:Georgia,serif;font-size:18px;color:#2c5e4a;">Account</td></tr><tr><td style="padding:0 20px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.5;color:#1d2420;">${input.account.map((line) => `<p style="margin:0 0 10px;">${esc(line)}</p>`).join("")}</td></tr><tr><td style="padding:12px 20px 8px;font-family:Georgia,serif;font-size:18px;color:#2c5e4a;">Work</td></tr><tr><td style="padding:0 20px 18px;">${cards}</td></tr>${sheet}<tr><td style="background:#173028;padding:16px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#f6f1e7;">${esc(SCHOOL_EMAIL)}</td></tr></table></td></tr></table></body></html>`;
}
