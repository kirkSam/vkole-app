import { useEffect, useState } from "react";
import { listAlphabetMisses } from "@/lib/climbs";

type MissRow = { letter: string; heard: string; count: number };

/**
 * Master-only counts of words heard when a letter was not scored.
 * The list never adds a pronunciation. It shows no student names.
 */
export function AlphabetMisses() {
  const [rows, setRows] = useState<MissRow[] | null>(null);

  useEffect(() => {
    let live = true;
    void listAlphabetMisses()
      .then((result) => {
        if (!live || !result.allowed) return;
        setRows(result.letters);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  if (!rows) return null;

  return (
    <section className="mt-4 rounded-2xl border border-line bg-surface p-4 text-ink">
      <h2 className="font-display text-2xl">Letters to listen for</h2>
      <p className="mt-2 text-base">
        These are words the app heard when a student had to try a letter again. The list is counts only. It does not add words by itself.
      </p>
      {rows.length === 0 ? (
        <p className="mt-3 text-base">No misses are saved yet.</p>
      ) : (
        <ul className="mt-3 space-y-1 text-base">
          {rows.map((row) => (
            <li key={`${row.letter}:${row.heard}`}>
              {row.letter}: {row.heard} ({row.count})
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
