import type { EngineLevel } from "@/lib/school-account";
import { cardFromAccount, migratePaBand, paCard, type PaBand } from "./items.ts";

export function paAccountLevel(
  remote: EngineLevel | undefined,
  local: {
    name: string;
    grade: number;
    age?: number | null;
    band: string;
    index: number;
    word: string;
    earnedGrade: number;
    reached: number;
    missed: number;
    streak: number;
    missStreak: number;
    startingGrade?: number;
    updatedAt: number;
  },
): EngineLevel {
  const name = local.name.trim() || remote?.name || "";
  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "student";
  const band: PaBand =
    migratePaBand(local.band) ??
    migratePaBand(remote?.band) ??
    migratePaBand(remote?.levelCode) ??
    cardFromAccount({ grade: local.grade, age: local.age }, local.grade).band;
  const card = paCard(band, local.index, local.grade);
  const earned = Math.round(local.earnedGrade);
  const level: EngineLevel = {
    id: remote?.id ?? `pa-${slug}`,
    name,
    enteredBy: remote?.enteredBy ?? "parent",
    grade: local.grade,
    step: 0,
    band: card.band,
    index: card.index,
    word: local.word || card.id,
    streak: Math.max(0, Math.round(local.streak) || 0),
    missStreak: Math.max(0, Math.round(local.missStreak) || 0),
    earnedGrade: Number.isFinite(earned) ? Math.min(12, Math.max(1, earned)) : card.grade,
    reached: Math.max(0, Math.round(local.reached) || 0),
    missed: Math.max(0, Math.round(local.missed) || 0),
    updatedAt: local.updatedAt,
    levelCode: card.band,
    levelLabel: card.label,
  };
  const startingGrade = local.startingGrade ?? remote?.startingGrade;
  if (startingGrade != null) {
    const starting = Math.round(startingGrade);
    if (Number.isFinite(starting)) level.startingGrade = Math.min(12, Math.max(1, starting));
  }
  return level;
}
