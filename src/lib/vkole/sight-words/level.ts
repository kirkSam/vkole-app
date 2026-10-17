import type { EngineLevel } from "@/lib/school-account";
import {
  BAND_LABELS,
  GRADE_START_BAND,
  clampSightGrade,
  gradeForBand,
  isSightBand,
  type SightBand,
} from "../constants.ts";
import { sightCard } from "./words.ts";

export function swAccountLevel(
  remote: EngineLevel | undefined,
  local: {
    name: string;
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
  const band: SightBand = isSightBand(local.band)
    ? local.band
    : isSightBand(remote?.band)
      ? remote.band
      : (GRADE_START_BAND[1] ?? "D-PP");
  const card = sightCard(band, local.index);
  const level: EngineLevel = {
    id: remote?.id ?? `sw-${slug}`,
    name,
    enteredBy: remote?.enteredBy ?? "parent",
    grade: gradeForBand(card.band),
    step: 0,
    band: card.band,
    index: card.index,
    word: local.word || card.word,
    earnedGrade: clampSightGrade(local.earnedGrade),
    reached: Math.max(0, Math.round(local.reached) || 0),
    missed: Math.max(0, Math.round(local.missed) || 0),
    updatedAt: local.updatedAt,
    levelCode: remote?.levelCode || card.band,
    levelLabel: remote?.levelLabel || BAND_LABELS[card.band],
  };
  const startingGrade = local.startingGrade ?? remote?.startingGrade;
  if (startingGrade != null) level.startingGrade = clampSightGrade(startingGrade);
  return level;
}
