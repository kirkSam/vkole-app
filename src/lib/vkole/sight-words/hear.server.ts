import "@tanstack/react-start/server-only";
import { VEKOLE_SETTINGS } from "@kirkpatrick/vekole-engine";
import { anySightAlternativeMatches } from "@kirkpatrick/vekole-engine/server";
import { isSightBand } from "@/lib/vkole/constants";
import { bandWords, entryFor } from "@/lib/vkole/sight-words/words";

/** Pronunciation matching stays on the server. The dictionary is not for the phone bundle. */
export function matchSightHearing(word: string, band: string, alternatives: readonly string[]): boolean {
  if (!isSightBand(band)) return false;
  const list = bandWords(band).map((item) => item.trim()).filter(Boolean);
  const wanted = word.trim();
  if (!list.some((item) => item.toLowerCase() === wanted.toLowerCase())) return false;
  const also = entryFor(band, 0, wanted).also;
  const heard = alternatives.slice(0, VEKOLE_SETTINGS.recognitionAlternatives);
  return anySightAlternativeMatches(wanted, heard, list, also);
}
