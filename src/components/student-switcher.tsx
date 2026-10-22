import { useState } from "react";
import { TWO_STUDENTS_LINE, type FamilyStudent } from "@/lib/school-account";
import { switchSchoolStudent } from "@/lib/school-auth";
import { OPEN_ACCT_LABEL, studentCardButtons } from "@/lib/student-card";

/** A tap on this slot does nothing. It is not a sign-in. */
function ignoreOpenAcct() {}

export function StudentSwitcher({
  students,
  activeStudent,
  onSwitched,
}: {
  students: FamilyStudent[];
  activeStudent: number;
  onSwitched: (index: number) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const buttons = studentCardButtons(students);
  const named = buttons.some((button) => button.kind === "student");
  return (
    <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
      <p className="text-base text-ink">{TWO_STUDENTS_LINE}.</p>
      {named ? (
        <>
          <p className="mt-2 text-sm text-muted">Who is using the app?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {buttons.map((button) =>
              button.kind === "open" ? (
                <button
                  key="open-acct"
                  type="button"
                  data-student-action="none"
                  className="min-h-12 rounded-xl border border-line bg-paper px-4 text-base font-semibold text-ink"
                  onClick={ignoreOpenAcct}
                >
                  {OPEN_ACCT_LABEL}
                </button>
              ) : (
                <button
                  key={button.index}
                  type="button"
                  data-student-action="sign-in"
                  data-student-index={button.index}
                  aria-pressed={button.index === activeStudent}
                  className="min-h-12 rounded-xl border border-line bg-paper px-4 text-base font-semibold text-ink"
                  onClick={() => {
                    if (pending) return;
                    setPending(true);
                    setError("");
                    void switchSchoolStudent({ data: { index: button.index } })
                      .then(() => onSwitched(button.index))
                      .catch((err: unknown) => {
                        setError(err instanceof Error ? err.message : "That student could not be opened.");
                      })
                      .finally(() => setPending(false));
                  }}
                >
                  {button.label}
                </button>
              ),
            )}
          </div>
          {students.length < 2 ? (
            <p className="mt-2 text-sm text-muted">Type a new first name on an engine to add the second student.</p>
          ) : null}
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">Type a first name on an engine to add the first student.</p>
      )}
      {error ? <p className="mt-2 text-sm text-miss">{error}</p> : null}
    </div>
  );
}
