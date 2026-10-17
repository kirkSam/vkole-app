import type { EngineLevel } from "@/lib/school-account";
import { cardFromAccount, isSpBand, spCard, type SpBand } from "./items.ts";

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
  const earned = Math.round(local.earnedGrade);
  const level: EngineLevel = {
    id: remote?.id ?? `sp-${slug}`,
    name,
    enteredBy: remote?.enteredBy ?? "parent",
    grade: local.grade,
    step: 0,
    band: card.band,
    index: card.index,
    word: local.word || card.id,
    earnedGrade: Number.isFinite(earned) ? Math.min(12, Math.max(1, earned)) : 1,
    reached: Math.max(0, Math.round(local.reached) || 0),
    missed: Math.max(0, Math.round(local.missed) || 0),
    updatedAt: local.updatedAt,
    levelCode: card.band,
    levelLabel: card.name,
  };
  const startingGrade = local.startingGrade ?? remote?.startingGrade;
  if (startingGrade != null) {
    const starting = Math.round(startingGrade);
    if (Number.isFinite(starting)) level.startingGrade = Math.min(12, Math.max(1, starting));
  }
  return level;
}
