import { useState } from "react";
import { TWO_STUDENTS_LINE, type FamilyStudent } from "@/lib/school-account";
import { switchSchoolStudent } from "@/lib/school-auth";

export function StudentSwitcher({
  students,
  activeStudent,
  onSwitched,
}: {
  students: FamilyStudent[];
  activeStudent: number;
  onSwitched: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const current = students.find((student) => student.index === activeStudent) ?? students[0];
  return (
    <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
      <p className="text-base text-ink">{TWO_STUDENTS_LINE}.</p>
      {students.length > 1 ? (
        <>
          <p className="mt-2 text-sm text-muted">Who is using the app?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {students.map((student) => (
              <button
                key={student.index}
                type="button"
                disabled={pending || student.index === activeStudent}
                className="min-h-12 rounded-xl border border-line bg-paper px-4 text-base font-semibold text-ink disabled:opacity-60"
                onClick={() => {
                  setPending(true);
                  setError("");
                  void switchSchoolStudent({ data: { index: student.index } })
                    .then(() => onSwitched())
                    .catch((err: unknown) => {
                      setError(err instanceof Error ? err.message : "That student could not be opened.");
                    })
                    .finally(() => setPending(false));
                }}
              >
                {student.name}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">
          {current
            ? `${current.name} is the student on this account. Type a new first name on an engine to add the second student.`
            : "Type a first name on an engine to add the first student."}
        </p>
      )}
      {error ? <p className="mt-2 text-sm text-miss">{error}</p> : null}
    </div>
  );
}
