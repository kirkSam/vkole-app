import type { EngineLevel } from "@/lib/school-account";
import { cardFromAccount, isSpBand, letterView, normalizeCompletedExercises, spCard, type SpBand } from "./items.ts";

export function spAccountLevel(
  remote: EngineLevel | undefined,
  local: {
    name: string;
    grade: number;
    band: string;
    index: number;
    word: string;
    earnedGrade: number;
    reached: number;
    missed: number;
    startingGrade?: number;
    silence?: number;
    wrong?: number;
    completedExercises?: unknown;
    updatedAt: number;
  },
): EngineLevel {
  const name = local.name.trim() || remote?.name || "";
  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "student";
  const band: SpBand = isSpBand(local.band)
    ? local.band
    : isSpBand(remote?.band)
      ? remote.band
      : isSpBand(remote?.levelCode)
        ? remote.levelCode
        : cardFromAccount({ grade: local.grade }, local.grade).band;
  const card = spCard(band, local.index, local.grade);
  const view = letterView({ index: card.index, silence: local.silence ?? 0, wrong: local.wrong ?? 0 });
  const earned = Math.round(local.earnedGrade);
  const level: EngineLevel = {
    id: remote?.id ?? `sp-${slug}`,
    name,
    enteredBy: remote?.enteredBy ?? "parent",
    grade: local.grade,
    step: 0,
    band: card.band,
    index: view.index,
    word: view.id,
    streak: view.silence,
    missStreak: view.wrong,
    earnedGrade: Number.isFinite(earned) ? Math.min(12, Math.max(1, earned)) : 1,
    reached: Math.max(0, Math.round(local.reached) || 0),
    missed: Math.max(0, Math.round(local.missed) || 0),
    updatedAt: local.updatedAt,
    levelCode: card.band,
    levelLabel: view.name,
    completedExercises: normalizeCompletedExercises([
      ...normalizeCompletedExercises(local.completedExercises),
      ...normalizeCompletedExercises(remote?.completedExercises),
    ]),
  };
  const startingGrade = local.startingGrade ?? remote?.startingGrade;
  if (startingGrade != null) {
    const starting = Math.round(startingGrade);
    if (Number.isFinite(starting)) level.startingGrade = Math.min(12, Math.max(1, starting));
  }
  return level;
}
