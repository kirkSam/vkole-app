import { VEKOLE_SETTINGS, type SpiralWord } from "@kirkpatrick/vekole-engine";
import { parseSightItemKey } from "@/lib/engine-connect";
import { isSightBand } from "@/lib/vkole/constants";
import { bandWords } from "@/lib/vkole/sight-words/words";

/** Master-only diagnosis. Remove this before launch. */
export function sightStatusLine(input: { fatigueHigh: boolean; spirals: readonly SpiralWord[] }): string {
  const fatigue = input.fatigueHigh ? "High" : "Normal";
  const waiting = input.spirals.map((word) => {
    const name = wordText(word.itemKey);
    if (!word.waiting) return `${name} (rested)`;
    const left = Math.max(0, VEKOLE_SETTINGS.spiralGapItems - word.newWords);
    if (left === 0) return `${name} (due now)`;
    const unit = left === 1 ? "new word" : "new words";
    return `${name} (after ${left} more ${unit})`;
  });
  return `Fatigue: ${fatigue} · Waiting to return: ${waiting.length ? waiting.join(", ") : "none"}`;
}

function wordText(itemKey: string): string {
  const parsed = parseSightItemKey(itemKey);
  if (!parsed || !isSightBand(parsed.band)) return itemKey;
  return bandWords(parsed.band)[parsed.index] || itemKey;
}
