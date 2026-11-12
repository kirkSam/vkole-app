import { useState } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  CLEAR_TABLES,
  CLEAR_TEST_DATA_PHRASE,
  ONLY_MASTER_MESSAGE,
  clearTestData,
  mayClearTestData,
  phraseMatches,
  readTestDataCounts,
  type TestDataClear,
  type TestDataCounts,
} from "@/lib/test-data-clear";

function CountList({ counts }: { counts: TestDataCounts }) {
  return (
    <ul className="mt-3 grid gap-1 text-sm text-ink">
      <li>students: {counts.students}</li>
      {CLEAR_TABLES.map((table) => (
        <li key={table.key}>
          {table.label}: {counts[table.key]}
        </li>
      ))}
    </ul>
  );
}

function namesOf(names: string[]): string {
  return names.length > 0 ? names.join(", ") : "none";
}

export function ClearTestData() {
  const { user } = useCurrentUserState();
  const [counts, setCounts] = useState<TestDataCounts | null>(null);
  const [names, setNames] = useState<string[]>([]);
  const [countedAt, setCountedAt] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [report, setReport] = useState<TestDataClear | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  if (!mayClearTestData(user.primaryEmail ?? "") && !mayClearTestData(user.id)) return null;

  async function show() {
    setBusy(true);
    setError("");
    setReport(null);
    try {
      const result = await readTestDataCounts();
      if (!result.ok) {
        setCounts(null);
        setError(ONLY_MASTER_MESSAGE);
        return;
      }
      setCounts(result.counts);
      setNames(result.students);
      setCountedAt(result.at);
    } catch {
      setError("The counts could not be read. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    setError("");
    try {
      const result = await clearTestData({ data: { confirmation } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setReport(result);
      setCounts(result.after);
      setNames(result.studentsAfter);
      setConfirmation("");
    } catch {
      setError("The records could not be cleared. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-line bg-surface p-4 text-sm text-ink">
      <h2 className="font-display text-2xl">Clear test data</h2>
      <p className="mt-2 text-muted">
        This shows how many family records this app has saved. After you confirm, it deletes those
        records for every account except the master account. Tables and operator settings stay.
        Passwords are not shown.
      </p>
      <button
        type="button"
        className="mt-3 inline-flex min-h-11 items-center rounded-full border border-line px-4"
        disabled={busy}
        onClick={() => void show()}
      >
        {busy && !counts ? "Counting…" : "Show what is stored"}
      </button>
      {counts ? (
        <div className="mt-4">
          <p>Students named: {namesOf(names)}</p>
          <CountList counts={counts} />
          {countedAt ? <p className="mt-2 text-muted">Counted at {countedAt}.</p> : null}
        </div>
      ) : null}
      {report?.ok ? (
        <div className="mt-4" role="status">
          <p>Cleared at {report.at}.</p>
          <ul className="mt-2 grid gap-1">
            <li>
              students: {report.before.students} before, {report.after.students} after. Named before:{" "}
              {namesOf(report.studentsBefore)}. Named after: {namesOf(report.studentsAfter)}.
            </li>
            {CLEAR_TABLES.map((table) => (
              <li key={table.key}>
                {table.label}: {report.before[table.key]} before, {report.after[table.key]} after
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {counts ? (
        <>
          <label className="mt-4 block text-muted" htmlFor="clear-test-data-confirmation">
            Type {CLEAR_TEST_DATA_PHRASE} to confirm
            <input
              id="clear-test-data-confirmation"
              className="mt-2 min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-base text-ink"
              value={confirmation}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="mt-3 inline-flex min-h-11 items-center rounded-full bg-ink px-4 text-paper disabled:opacity-60"
            disabled={busy || !phraseMatches(confirmation)}
            onClick={() => void clear()}
          >
            {busy ? "Clearing…" : "Clear test data"}
          </button>
        </>
      ) : null}
      {error ? (
        <p className="mt-3 text-miss" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
