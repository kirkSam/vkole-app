import { HEURISTICS, STRANDS, parseSgCode, type HeuristicId, type StrandId } from "./vkole-singapore.ts";

export type Tally = { asked: number; correct: number };

export type SgMastery = {
  strands: Partial<Record<StrandId, Tally>>;
  heuristics: Partial<Record<HeuristicId, Tally>>;
};

function emptyTally(): Tally {
  return { asked: 0, correct: 0 };
}

export function emptyMastery(): SgMastery {
  return { strands: {}, heuristics: {} };
}

function bump(bucket: Partial<Record<string, Tally>>, id: string, correct: boolean) {
  const current = bucket[id] ?? emptyTally();
  current.asked += 1;
  if (correct) current.correct += 1;
  bucket[id] = current;
}

function asTally(value: unknown): Tally | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { correct?: unknown; asked?: unknown };
  const asked = Number(row.asked);
  let correct = Number(row.correct);
  if (!Number.isInteger(asked) || !Number.isInteger(correct) || asked < 1 || correct < 0) return null;
  if (correct > asked) correct = asked;
  return { asked, correct };
}

export function masteryFromUnknown(value: unknown): SgMastery | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as { strands?: unknown; heuristics?: unknown };
  const mastery = emptyMastery();
  const strands = row.strands && typeof row.strands === "object" ? (row.strands as Record<string, unknown>) : {};
  const heuristics = row.heuristics && typeof row.heuristics === "object" ? (row.heuristics as Record<string, unknown>) : {};
  for (const strand of STRANDS) {
    const tally = asTally(strands[strand.id]);
    if (tally) mastery.strands[strand.id] = tally;
  }
  for (const heuristic of HEURISTICS) {
    const tally = asTally(heuristics[heuristic.id]);
    if (tally) mastery.heuristics[heuristic.id] = tally;
  }
  return mastery;
}

export function masteryAsked(mastery: SgMastery | null | undefined): number {
  if (!mastery) return 0;
  const strandAsked = Object.values(mastery.strands).reduce((sum, tally) => sum + (tally?.asked ?? 0), 0);
  const heuristicAsked = Object.values(mastery.heuristics).reduce((sum, tally) => sum + (tally?.asked ?? 0), 0);
  return strandAsked + heuristicAsked;
}

/** Keep the record that has seen more work, so a fresh device does not wipe the website account. */
export function richerMastery(left: SgMastery | null | undefined, right: SgMastery | null | undefined): SgMastery | undefined {
  const leftAsked = masteryAsked(left);
  const rightAsked = masteryAsked(right);
  if (leftAsked === 0 && rightAsked === 0) return undefined;
  return leftAsked >= rightAsked ? left ?? undefined : right ?? undefined;
}

export function masteryFromDetails(rows: readonly { detail: string; correct: boolean }[]): SgMastery {
  const mastery = emptyMastery();
  for (const row of rows) {
    let code = "";
    try {
      const parsed = JSON.parse(row.detail) as { code?: unknown };
      code = String(parsed.code ?? "");
    } catch {
      code = "";
    }
    const skill = parseSgCode(code);
    if (!skill) continue;
    bump(mastery.strands, skill.strand, row.correct);
    if (skill.heuristic) bump(mastery.heuristics, skill.heuristic, row.correct);
  }
  return mastery;
}

export function masteryFromReport(events: readonly { detail: string; correct?: boolean | null }[]): SgMastery {
  return masteryFromDetails(
    events.map((event) => ({
      detail: event.detail,
      correct: event.correct === true,
    })),
  );
}

export function formatMasteryReport(mastery: SgMastery | null | undefined): string {
  const record = mastery ?? emptyMastery();
  const lines = ["Mastery by strand"];
  for (const strand of STRANDS) {
    const tally = record.strands[strand.id] ?? emptyTally();
    lines.push(`${strand.name}: ${tally.correct} of ${tally.asked} correct`);
  }
  lines.push("Heuristics");
  for (const heuristic of HEURISTICS) {
    const tally = record.heuristics[heuristic.id] ?? emptyTally();
    lines.push(`${heuristic.name}: ${tally.correct} of ${tally.asked} correct`);
  }
  return lines.join("\n");
}
