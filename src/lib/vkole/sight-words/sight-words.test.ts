import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { parseSchoolProfile } from "../../school-account.ts";
import { BAND_LABELS, SIGHT_WORD_ADVANCE_MS, SIGHT_WORD_BANDS, SIGHT_WORD_ENGINE, SIGHT_WORD_MAX_SHOW_MS, startBandForGrade, type SightBand } from "../constants.ts";
import lists from "./data.json" with { type: "json" };
import { judgeSpoken, spokenMatches } from "./match.ts";
import { swAccountLevel } from "./level.ts";
import { bandWords, heartLetters, nextCard, sightCard, startCard, wordEntry } from "./words.ts";

const BANDS = ["D-PP", "D-P", "D-1", "D-2", "D-3", "D-N", "F-1", "F-2", "F-3", "F-4", "F-5", "F-6", "F-7", "F-8", "F-9", "F-10"] as const;

const ENDS: Record<(typeof BANDS)[number], [number, string, string]> = {
  "D-PP": [40, "a", "you"],
  "D-P": [52, "all", "yes"],
  "D-1": [41, "after", "when"],
  "D-2": [46, "always", "your"],
  "D-3": [41, "about", "warm"],
  "D-N": [95, "apple", "wood"],
  "F-1": [10, "words", "part"],
  "F-2": [38, "sound", "world"],
  "F-3": [60, "high", "it's"],
  "F-4": [73, "body", "travel"],
  "F-5": [81, "English", "built"],
  "F-6": [93, "can't", "drive"],
  "F-7": [89, "cross", "fingers"],
  "F-8": [93, "row", "feeling"],
  "F-9": [96, "supply", "sharp"],
  "F-10": [95, "company", "view"],
};

type CanonWord = { word: string; heart?: number[]; also?: string[] };

function section(lines: string[], start: string, end: string): string[] {
  const from = lines.findIndex((line) => line.trim() === start);
  const to = lines.findIndex((line, index) => index > from && line.trim() === end);
  if (from < 0 || to < 0) throw new Error(`missing ${start}`);
  return lines.slice(from + 1, to);
}

function heartIndexes(word: string, letters: string[]): number[] {
  const indexes: number[] = [];
  let from = 0;
  for (const letter of letters) {
    const at = word.indexOf(letter, from);
    if (at < 0) throw new Error(`heart ${letter} missing in ${word}`);
    indexes.push(at);
    from = at + 1;
  }
  return indexes;
}

function canonicalLists(): Record<string, CanonWord[]> {
  const text = readFileSync(fileURLToPath(new URL("../../../../docs/sight-words-website-canonical.md", import.meta.url)), "utf8");
  const lines = text.split("\n");
  const bands: Record<string, string[]> = {};
  for (const line of section(lines, "**Bands**", "**Heart words**")) {
    if (!line.trim()) continue;
    const match = line.match(/^(D-PP|D-P|D-1|D-2|D-3|D-N|F-\d+)\s+([^:]+):\s*(.*)$/);
    if (!match) throw new Error(`band line ${line}`);
    assert.equal(BAND_LABELS[match[1] as SightBand], match[2]!.trim());
    bands[match[1]!] = match[3]!.split(", ").map((word) => word.trim()).filter(Boolean);
  }
  const hearts = new Map<string, string[]>();
  for (const line of section(lines, "**Heart words**", "**Constants**")) {
    if (!line.trim()) continue;
    const match = line.match(/^(.+):\s+(.+)$/);
    if (!match) throw new Error(`heart line ${line}`);
    hearts.set(match[1]!, match[2]!.trim().split(/\s+/));
  }
  const homoAt = lines.findIndex((line) => line.includes("Homophones, exactly as stored:"));
  const also = new Map<string, string[]>();
  for (const line of lines.slice(homoAt + 1)) {
    if (!line.trim()) continue;
    const match = line.match(/^(.+):\s+(.+)$/);
    if (!match) throw new Error(`also line ${line}`);
    also.set(match[1]!, match[2]!.split(", ").map((item) => item.trim()).filter(Boolean));
  }
  const data: Record<string, CanonWord[]> = {};
  for (const band of BANDS) {
    data[band] = (bands[band] ?? []).map((word) => {
      const entry: CanonWord = { word };
      if (hearts.has(word)) entry.heart = heartIndexes(word, hearts.get(word)!);
      if (also.has(word)) entry.also = also.get(word)!;
      return entry;
    });
  }
  return data;
}

describe("sight word lists", () => {
  it("uses the sw key, the sixteen bands, and the spoken timings", () => {
    assert.equal(SIGHT_WORD_ENGINE, "sw");
    assert.deepEqual(SIGHT_WORD_BANDS, [...BANDS]);
    assert.equal(SIGHT_WORD_ADVANCE_MS, 2000);
    assert.equal(SIGHT_WORD_MAX_SHOW_MS, 20000);
  });

  it("keeps each band's count and its first and last word", () => {
    for (const band of BANDS) {
      const [count, first, last] = ENDS[band];
      const words = bandWords(band);
      assert.equal(words.length, count, band);
      assert.equal(words[0], first, band);
      assert.equal(words[words.length - 1], last, band);
    }
    assert.equal(bandWords("F-1").length, 10);
  });

  it("matches the canonical words, heart letters, and homophones", () => {
    assert.deepEqual(lists, canonicalLists());
    const come = wordEntry("D-PP", bandWords("D-PP").indexOf("come"));
    const to = wordEntry("D-PP", bandWords("D-PP").indexOf("to"));
    assert.deepEqual(come.heart, [1, 3]);
    assert.equal(heartLetters(come.word, come.heart), "o e");
    assert.deepEqual(wordEntry("D-PP", 0).also, []);
    assert.deepEqual(to.also, ["too", "two"]);
    assert.equal(heartLetters(to.word, to.heart), "o");
    assert.equal(heartLetters("I'll", [2]), "l");
    assert.equal(heartLetters("Christmas", [0, 1, 5]), "C h t");
  });

  it("maps a grade to its start band, and a saved band wins", () => {
    assert.equal(startBandForGrade(Number.NaN), "D-PP");
    assert.equal(startBandForGrade(0), "D-PP");
    assert.equal(startBandForGrade(-2), "D-PP");
    assert.equal(startBandForGrade(0.4), "D-PP");
    assert.equal(startBandForGrade(1), "D-1");
    assert.equal(startBandForGrade(1.2), "D-1");
    assert.equal(startBandForGrade(2), "D-2");
    assert.equal(startBandForGrade(3), "D-3");
    assert.equal(startBandForGrade(4), "F-6");
    assert.equal(startBandForGrade(4.6), "F-8");
    assert.equal(startBandForGrade(5), "F-8");
    assert.equal(startBandForGrade(12), "F-8");
    assert.equal(BAND_LABELS["D-PP"], "Pre-K");
    assert.equal(BAND_LABELS["F-1"], "K-1");
    assert.equal(BAND_LABELS["F-8"], "4th-5th");
  });

  it("moves to the next word and does not stay for a retry", () => {
    const first = startCard(1);
    assert.equal(first.word, "after");
    assert.equal(first.band, "D-1");
    assert.equal(first.label, "1st");
    const second = nextCard(first.band, first.index, first.grade);
    assert.equal(second.word, "again");
    assert.equal(second.band, "D-1");
    const end = sightCard("D-PP", 39, 0);
    const crossed = nextCard(end.band, end.index, 0);
    assert.equal(crossed.band, "D-P");
    assert.equal(crossed.word, "all");
    assert.equal(crossed.index, 0);
    const last = sightCard("F-10", bandWords("F-10").length - 1, 5);
    const again = nextCard(last.band, last.index, 5);
    assert.equal(again.band, "F-10");
    assert.equal(again.index, 0);
    assert.equal(again.word, "company");
    assert.equal(again.grade, 5);
  });
});

describe("spoken match", () => {
  it("accepts case, apostrophes, extra words, and the also list", () => {
    assert.equal(spokenMatches("the", "The"), true);
    assert.equal(spokenMatches("I", "i"), true);
    assert.equal(spokenMatches("don't", "dont"), true);
    assert.equal(spokenMatches("don't", "don’t"), true);
    assert.equal(spokenMatches("it's", "its"), true);
    assert.equal(spokenMatches("its", "it's"), true);
    assert.equal(spokenMatches("Santa Claus", "um santa claus"), true);
    assert.equal(spokenMatches("the", "the word is the"), true);
    assert.equal(spokenMatches("to", "too", ["too", "two"]), true);
    assert.equal(spokenMatches("to", "two", ["too", "two"]), true);
    assert.equal(spokenMatches("there", "they're", ["their", "theyre"]), true);
    assert.equal(spokenMatches("good-bye", "goodbye"), true);
    assert.equal(spokenMatches("good-bye", "good bye"), true);
  });

  it("does not treat a longer word as a shorter one", () => {
    assert.equal(spokenMatches("the", "them"), false);
    assert.equal(spokenMatches("can", "can't"), false);
    assert.equal(spokenMatches("to", "too"), false);
    assert.equal(spokenMatches("the", ""), false);
    assert.equal(spokenMatches("a", "away"), false);
  });

  it("waits on a partial phrase and misses an empty or finished one", () => {
    assert.equal(judgeSpoken("there", "", false), "miss");
    assert.equal(judgeSpoken("there", "th", false), "wait");
    assert.equal(judgeSpoken("there", "the", true), "miss");
    assert.equal(judgeSpoken("them", "the", false), "wait");
    assert.equal(judgeSpoken("there", "there", false), "correct");
  });
});

describe("level.sw", () => {
  it("reads and writes the website field names", () => {
    const parsed = parseSchoolProfile({
      family: {
        email: "ada@school.test",
        access: "open",
        student: { name: "Ada" },
        level: {
          sw: {
            id: "sw-ada",
            name: "Ada",
            enteredBy: "parent",
            grade: 4,
            band: "D-3",
            index: 3,
            word: "carry",
            reached: 8,
            missed: 2,
            earnedGrade: 4,
            levelCode: "D-3",
            levelLabel: "3rd",
          },
        },
      },
    });
    const sw = parsed?.profile.level.sw;
    assert.equal(sw?.band, "D-3");
    assert.equal(sw?.index, 3);
    assert.equal(sw?.word, "carry");
    assert.equal(sw?.step, 0);
    assert.equal(sw?.grade, 4);
    assert.equal(sw?.id, "sw-ada");
    const written = swAccountLevel(sw, {
      name: "Ada",
      grade: 4,
      band: "D-3",
      index: 3,
      word: "carry",
      earnedGrade: 4,
      reached: 9,
      missed: 2,
      startingGrade: 4,
      updatedAt: 10,
    });
    assert.equal(written.id, "sw-ada");
    assert.equal(written.band, "D-3");
    assert.equal(written.index, 3);
    assert.equal(written.word, "carry");
    assert.equal(written.grade, 4);
    assert.equal(written.levelCode, "D-3");
    assert.equal(written.levelLabel, "3rd");
    assert.equal(written.reached, 9);
    assert.equal(written.step, 0);
    assert.equal(written.enteredBy, "parent");
  });

  it("starts a bare grade on that grade's band", () => {
    const parsed = parseSchoolProfile({
      family: {
        email: "ada@school.test", level: { sw: 2 } },
    });
    assert.equal(parsed?.profile.level.sw?.grade, 2);
    assert.equal(parsed?.profile.level.sw?.band, "D-2");
    assert.equal(parsed?.profile.level.sw?.index, 0);
    assert.equal(parsed?.profile.level.sw?.word, "always");
    assert.equal(parsed?.profile.level.sw?.levelLabel, "2nd");
  });

  it("lets a saved band or levelCode win over the grade map", () => {
    const byBand = parseSchoolProfile({
      family: {
        email: "ada@school.test", level: { sw: { grade: 5, band: "D-PP", index: 2 } } },
    });
    assert.equal(byBand?.profile.level.sw?.band, "D-PP");
    assert.equal(byBand?.profile.level.sw?.word, "away");
    assert.equal(byBand?.profile.level.sw?.grade, 5);
    const byCode = parseSchoolProfile({
      family: {
        email: "ada@school.test", level: { sw: { grade: 1, levelCode: "F-10" } } },
    });
    assert.equal(byCode?.profile.level.sw?.band, "F-10");
    assert.equal(byCode?.profile.level.sw?.word, "company");
    const nested = parseSchoolProfile({
      family: {
        email: "ada@school.test", level: { sw: { grade: 4, sight: { band: "D-N", index: 1 } } } },
    });
    assert.equal(nested?.profile.level.sw?.band, "D-N");
    assert.equal(nested?.profile.level.sw?.index, 1);
    assert.equal(nested?.profile.level.sw?.word, "baby");
    const below = parseSchoolProfile({
      family: {
        email: "ada@school.test", level: { sw: { grade: 0 } } },
    });
    assert.equal(below?.profile.level.sw?.grade, 0);
    assert.equal(below?.profile.level.sw?.band, "D-PP");
    assert.equal(below?.profile.level.sw?.word, "a");
    const missing = parseSchoolProfile({
      family: {
        email: "ada@school.test", level: { sw: {} } },
    });
    assert.equal(missing?.profile.level.sw?.band, "D-PP");
  });
});
