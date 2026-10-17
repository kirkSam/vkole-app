import { useState } from "react";
import { engineNavLabel, levelLabel, subjectMeta, type SubjectId } from "@/lib/climb-rules";
import { assignmentFileName, buildAssignmentPdf } from "@/lib/assignment-pdf";
import type { Question } from "@/lib/questions";

export function AssignmentWork({
  questions,
  childName,
  subject,
  level,
  onClose,
  onNew,
}: {
  questions: Question[];
  childName: string;
  subject: SubjectId;
  level: number;
  onClose: () => void;
  onNew: () => void;
}) {
  const meta = subjectMeta(subject);
  const [picks, setPicks] = useState<Array<string | null>>(() => questions.map(() => null));
  const [checked, setChecked] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [saving, setSaving] = useState(false);
  const correctCount = questions.filter((question, index) => picks[index] === question.answer).length;

  async function download() {
    setPdfError("");
    setSaving(true);
    try {
      const bytes = await buildAssignmentPdf({ childName, subject, level, questions });
      const blob = new Blob([Uint8Array.from(bytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = assignmentFileName(childName, subject, level);
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "The PDF could not be made.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-line bg-surface p-5">
      <p className="text-xs tracking-wide text-muted">{engineNavLabel(meta.code)}</p>
      <h2 className="mt-1 font-display text-2xl text-ink">8-question assignment</h2>
      <p className="mt-2 text-sm text-muted">
        {childName}, {levelLabel(level)}. Work these eight items here, or download the same set as a PDF to print.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void download()}
          disabled={saving}
          className="min-h-11 rounded-xl bg-accent px-4 font-semibold text-accent-ink disabled:opacity-50"
        >
          {saving ? "Preparing PDF…" : "Download PDF"}
        </button>
        <button type="button" onClick={onNew} className="min-h-11 rounded-xl border border-line bg-paper px-4 text-ink">
          New set
        </button>
        <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-line bg-paper px-4 text-ink">
          Back to the climb
        </button>
      </div>
      {pdfError ? <p className="mt-3 text-sm text-miss">{pdfError}</p> : null}
      <ol className="mt-5 grid gap-4">
        {questions.map((question, index) => (
          <li key={`${question.stem}-${index}`} className="rounded-2xl border border-line bg-paper p-4">
            <p className="text-xs tracking-wide text-muted uppercase">
              {index + 1} of 8 · {question.standard}
            </p>
            <p className="mt-2 text-base text-ink">{question.stem}</p>
            <div className="mt-3 grid gap-2">
              {question.options.map((option) => {
                const picked = picks[index] === option;
                const showRight = checked && option === question.answer;
                const showMiss = checked && picked && option !== question.answer;
                const tone = showRight
                  ? "border-accent"
                  : showMiss
                    ? "border-miss"
                    : picked
                      ? "border-ink"
                      : "border-line";
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={checked}
                    onClick={() => {
                      setPicks((current) => current.map((value, i) => (i === index ? option : value)));
                    }}
                    className={`min-h-11 rounded-xl border px-3 text-left text-base text-ink disabled:cursor-default ${tone}`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            {checked ? (
              <p className={picks[index] === question.answer ? "mt-3 text-sm text-accent" : "mt-3 text-sm text-miss"}>
                {picks[index] === question.answer ? "Correct." : `Answer: ${question.answer}`}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
      {checked ? (
        <p className="mt-5 font-display text-2xl text-ink">
          {correctCount} of {questions.length} correct.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => setChecked(true)}
          className="mt-5 min-h-12 w-full rounded-xl bg-accent px-5 font-semibold text-accent-ink"
        >
          Check assignment
        </button>
      )}
    </section>
  );
}
