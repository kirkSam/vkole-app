/**
 * Free math practice for a parent.
 * The printable sheet and the answer key reuse reportHtml, the HTML
 * layout inside academicLetter in src/lib/academic-email.ts. That is
 * the progress report emailed when a student finishes or logs out.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { APP_NAME, SCHOOL_EMAIL, SCHOOL_NAME } from "@/lib/brand";
import { levelLabel } from "@/lib/climb-rules";
import { listClimbs, type Climb } from "@/lib/climbs";
import { makeMathSheet, parsePracticeGrade, PRACTICE_GRADES, type MathQuestion } from "@/lib/practice/common-core-math";
import type { FamilyStudent } from "@/lib/school-account";

export const Route = createFileRoute("/practice")({
  head: () => ({
    meta: [
      { title: "Free Math Practice" },
      {
        name: "description",
        content: "Ten free math questions for a level from kindergarten through grade 12. No payment.",
      },
    ],
  }),
  component: PracticePage,
});

function PracticePage() {
  const [typed, setTyped] = useState("");
  const [nonce, setNonce] = useState(() => (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0);
  const [students, setStudents] = useState<FamilyStudent[]>([]);
  const [climbs, setClimbs] = useState<Climb[]>([]);
  const [rosterReady, setRosterReady] = useState(false);
  const [studentName, setStudentName] = useState("");
  const grade = parsePracticeGrade(typed);
  const sheet = useMemo(() => (grade ? makeMathSheet(grade, nonce) : []), [grade, nonce]);

  useEffect(() => {
    let live = true;
    listClimbs()
      .then((result) => {
        if (!live) return;
        setStudents(result.students ?? []);
        setClimbs(result.climbs ?? []);
        setRosterReady(true);
      })
      .catch(() => {
        if (!live) return;
        setStudents([]);
        setClimbs([]);
        setRosterReady(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const level = grade ? levelLabel(grade === "K" ? 0 : Number(grade)) : "";
  const hint = studentName ? mathHint(climbs, studentName) : "";

  return (
    <Shell>
      <div className="no-print">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">Parent</p>
        <h1 className="mt-1 font-display text-4xl text-ink">Free Math Practice</h1>
        <p className="mt-3 text-muted">
          Type or pick a level from kindergarten through grade 12. The sheet uses the level you type or pick. You get 10 new math questions for that level.
        </p>
        <p className="mt-3 text-ink">This page is free. You do not pay to make these questions.</p>
        {rosterReady && students.length > 0 ? (
          <label className="mt-4 block text-sm text-ink">
            Student, if you want a hint
            <select
              className="mt-1 min-h-11 w-full rounded-xl border border-line bg-[#fffdf8] px-3 text-base"
              value={studentName}
              onChange={(event) => setStudentName(event.target.value)}
            >
              <option value="">No student</option>
              {students.map((student) => (
                <option key={student.index} value={student.name}>
                  {student.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="mt-4 text-sm text-muted">You can make a sheet without signing in.</p>
        )}
        {hint ? <p className="mt-3 rounded-2xl border border-[#d7e0da] bg-[#fffdf8] p-4 text-sm text-ink">{hint}</p> : null}
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block text-sm text-ink">
            Level
            <select
              className="mt-1 min-h-11 rounded-xl border border-line bg-[#fffdf8] px-3 text-base"
              value={grade ?? ""}
              onChange={(event) => setTyped(event.target.value)}
            >
              <option value="">Pick a level</option>
              {PRACTICE_GRADES.map((item) => (
                <option key={item} value={item}>
                  {levelLabel(item === "K" ? 0 : Number(item))}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-40 flex-1 text-sm text-ink">
            Or type a level
            <input
              className="mt-1 min-h-11 w-full rounded-xl border border-line bg-[#fffdf8] px-3 text-base"
              value={typed}
              placeholder="K or 1 to 12"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) => setTyped(event.target.value)}
            />
          </label>
        </div>
        {typed.trim() && !grade ? <p className="mt-2 text-sm text-miss">Use K or a grade from 1 to 12.</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-full bg-[#d9efe4] px-4 font-display text-base text-ink disabled:opacity-50"
            disabled={!grade}
            onClick={() => setNonce((value) => (value + 1) >>> 0)}
          >
            New questions
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-full border border-[#d7e0da] bg-[#fffdf8] px-4 font-display text-base text-ink disabled:opacity-50"
            disabled={!grade}
            onClick={() => window.print()}
          >
            Print
          </button>
        </div>
        {grade ? <p className="mt-3 text-sm text-muted">The answer key prints on the next page.</p> : null}
      </div>
      {grade && level ? (
        <div className="math-print">
          <ReportCard title={studentName ? `Free math practice for ${studentName}` : "Free math practice"} level={level}>
            <h2 className="report-section">Practice</h2>
            <p className="report-intro">Write each answer on the line. Show your work on the line too.</p>
            <ol className="report-items">
              {sheet.map((question, index) => (
                <li key={`${question.code}-${index}`}>
                  <PracticeItem index={index} question={question} />
                </li>
              ))}
            </ol>
          </ReportCard>
          <ReportCard title={studentName ? `Answer key for ${studentName}` : "Answer key"} level={level} answerKey>
            <h2 className="report-section">Answers</h2>
            <div className="report-cards">
              {sheet.map((question, index) => (
                <AnswerCard key={`${question.code}-${index}`} index={index} question={question} />
              ))}
            </div>
          </ReportCard>
        </div>
      ) : (
        <p className="no-print mt-6 text-ink">Type or pick a level. Then you get 10 questions.</p>
      )}
    </Shell>
  );
}

function mathHint(climbs: Climb[], name: string): string {
  const climb = climbs.find((item) => item.subject === "m" && item.childName.trim().toLowerCase() === name.trim().toLowerCase());
  if (!climb) return "This student does not have a saved math level yet. The sheet uses the level you type or pick.";
  return `Working level: ${levelLabel(climb.level)}. Earned level: ${levelLabel(climb.performanceLevel)}. The sheet uses the level you type or pick.`;
}

function ReportCard({
  title,
  level,
  answerKey,
  children,
}: {
  title: string;
  level: string;
  answerKey?: boolean;
  children: ReactNode;
}) {
  return (
    <article className={answerKey ? "report-card math-key" : "report-card"}>
      <div className="report-head">
        <p className="report-school">{SCHOOL_NAME}</p>
        <h2 className="report-title">{title}</h2>
        <p className="report-app">{APP_NAME}</p>
      </div>
      <p className="report-lede">This page is free. You do not pay to make these questions.</p>
      <h2 className="report-section">Sitting</h2>
      <table className="report-sitting">
        <tbody>
          <tr>
            <th scope="row">Student</th>
            <td>
              <span className="report-blank" />
            </td>
          </tr>
          <tr>
            <th scope="row">Date</th>
            <td>
              <span className="report-blank" />
            </td>
          </tr>
          <tr>
            <th scope="row">Level</th>
            <td>{level}</td>
          </tr>
          <tr>
            <th scope="row">Questions</th>
            <td>10</td>
          </tr>
        </tbody>
      </table>
      {children}
      <p className="report-foot">{SCHOOL_EMAIL}</p>
    </article>
  );
}

function PracticeItem({ index, question }: { index: number; question: MathQuestion }) {
  return (
    <div className="report-item">
      <p className="report-code">
        {index + 1}. {question.code}
      </p>
      <p className="report-domain">{question.domain}</p>
      <p className="report-prompt">{question.prompt}</p>
      <div className="report-line" />
    </div>
  );
}

function AnswerCard({ index, question }: { index: number; question: MathQuestion }) {
  return (
    <article className="report-work">
      <p className="report-work-title">
        {index + 1}. Answer
      </p>
      <p>
        <strong>Common Core:</strong> {question.code}
      </p>
      <p>
        <strong>Topic:</strong> {question.domain}
      </p>
      <p className="report-work-question">
        <strong>Question:</strong> {question.prompt}
      </p>
      <p>
        <strong>Answer:</strong> {question.answer}
      </p>
    </article>
  );
}
