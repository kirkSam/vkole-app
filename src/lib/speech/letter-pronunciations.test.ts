import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { academicLetter, trialState } from "../academic-email.ts";
import lists from "../vkole/alphabet/data.json" with { type: "json" };
import {
  LETTER_ALTERNATIVE_LIMIT,
  LETTER_CONFIDENCE_FLOOR,
  LETTER_PRONUNCIATIONS,
  acceptedFormsForLetter,
  judgeLetterHear,
  pronunciationMatches,
} from "./letter-pronunciations.ts";
import { aggregateLetterMisses, alphabetFirstTryReport, missSamplesFromDetails, readLetterAttempt } from "./letter-attempts.ts";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

describe("accepted pronunciations", () => {
  it("lists every letter with the spoken forms already in use", () => {
    assert.deepEqual(Object.keys(LETTER_PRONUNCIATIONS), LETTERS);
    const names = lists.letterNames as Record<string, string[]>;
    for (const letter of LETTERS) {
      const forms = acceptedFormsForLetter(letter);
      assert.equal(forms.length > 0, true, letter);
      assert.equal(forms.includes(letter.toLowerCase()), true, letter);
      for (const form of forms) assert.equal(form.trim().length > 0, true);
      for (const older of names[letter] ?? []) {
        assert.equal(pronunciationMatches(letter, older), true, `${letter} ${older}`);
      }
    }
  });

  it("accepts the curated names and rejects near words", () => {
    for (const form of ["d", "dee", "de", "di", "the"]) assert.equal(pronunciationMatches("D", form), true, form);
    for (const form of ["zee", "zed"]) assert.equal(pronunciationMatches("Z", form), true, form);
    for (const form of ["aitch", "haitch"]) assert.equal(pronunciationMatches("H", form), true, form);
    for (const form of ["r", "are", "our"]) assert.equal(pronunciationMatches("R", form), true, form);
    for (const form of ["i", "eye", "aye"]) assert.equal(pronunciationMatches("I", form), true, form);
    for (const form of ["y", "why"]) assert.equal(pronunciationMatches("Y", form), true, form);
    for (const form of ["u", "you"]) assert.equal(pronunciationMatches("U", form), true, form);
    for (const form of ["c", "see", "sea"]) assert.equal(pronunciationMatches("C", form), true, form);
    for (const form of ["b", "bee", "be"]) assert.equal(pronunciationMatches("B", form), true, form);
    assert.equal(pronunciationMatches("W", "double you"), true);
    assert.equal(pronunciationMatches("B", "beer"), false);
    assert.equal(pronunciationMatches("Z", "see"), false);
    assert.equal(pronunciationMatches("D", "tea"), false);
    assert.equal(pronunciationMatches("A", "the"), false);
    assert.equal(pronunciationMatches("N", "the"), false);
    assert.equal(pronunciationMatches("T", "the"), false);
    assert.equal(pronunciationMatches("O", "our"), false);
    assert.equal(pronunciationMatches("A", "aye"), false);
    assert.equal(pronunciationMatches("W", "u"), false);
    assert.equal(pronunciationMatches("W", "you"), false);
  });

  it("uses an explicit list and does not guess by edit distance", () => {
    const source = readFileSync(new URL("./letter-pronunciations.ts", import.meta.url), "utf8");
    assert.equal(source.includes('from "@/'), false);
    assert.equal(source.includes("levenshtein"), false);
    assert.equal(source.includes("editDistance"), false);
    assert.match(source, /no fuzzy match and no edit distance/i);
    assert.equal(LETTER_ALTERNATIVE_LIMIT, 5);
    assert.equal(LETTER_CONFIDENCE_FLOOR, 0.2);
  });
});

describe("recognizer alternatives", () => {
  it("accepts a matching alternative in the top five", () => {
    const heard = judgeLetterHear("B", [
      { transcript: "beer", confidence: 0.9, final: true },
      { transcript: "bee", confidence: 0.4, final: true },
    ]);
    assert.equal(heard, "correct");
  });

  it("ignores a match that is past the top five", () => {
    const alternatives = [
      { transcript: "tea", confidence: 0.9, final: true },
      { transcript: "day", confidence: 0.8, final: true },
      { transcript: "dog", confidence: 0.7, final: true },
      { transcript: "do", confidence: 0.6, final: true },
      { transcript: "dad", confidence: 0.5, final: true },
      { transcript: "dee", confidence: 0.9, final: true },
    ];
    assert.equal(judgeLetterHear("D", alternatives), "miss");
  });

  it("asks again when the only match is below the confidence floor", () => {
    assert.equal(judgeLetterHear("R", [{ transcript: "are", confidence: 0.1, final: true }]), "again");
    assert.equal(judgeLetterHear("R", [{ transcript: "are", confidence: 0.1, final: false }]), "wait");
    assert.equal(judgeLetterHear("R", [{ transcript: "are", confidence: 0, final: true }]), "correct");
    assert.equal(judgeLetterHear("R", [{ transcript: "are", final: true }]), "correct");
  });

  it("does not score a final answer the engine marks as very unsure", () => {
    assert.equal(judgeLetterHear("D", [{ transcript: "tea", confidence: 0.9, final: true }]), "miss");
    assert.equal(judgeLetterHear("D", [{ transcript: "tea", confidence: 0.1, final: true }]), "again");
    assert.equal(judgeLetterHear("D", [{ transcript: "", final: true }]), "wait");
    assert.equal(judgeLetterHear("D", [{ transcript: "tea", confidence: 0.9, final: false }]), "wait");
    assert.equal(
      judgeLetterHear("N", [
        { transcript: "the", confidence: 0.9, final: true },
        { transcript: "enn", confidence: 0.1, final: true },
      ]),
      "again",
    );
  });
});

describe("first tries", () => {
  it("counts the first outcome for each letter", () => {
    const report = alphabetFirstTryReport([
      { letter: "A", outcome: "correct" },
      { letter: "B", outcome: "miss" },
      { letter: "B", outcome: "correct" },
      { letter: "C", outcome: "timeout" },
      { letter: "D", outcome: "again" },
    ]);
    assert.equal(report.asked, 4);
    assert.equal(report.firstTry, 1);
    assert.deepEqual(report.retries, ["B", "C", "D"]);
    assert.match(report.text, /1 of 4 letter was right on the first try\./);
    assert.match(report.text, /These letters needed another try: B, C, and D\./);
  });

  it("says every letter was right when none needed a retry", () => {
    const report = alphabetFirstTryReport([
      { letter: "A", outcome: "correct" },
      { letter: "B", outcome: "correct" },
    ]);
    assert.equal(report.firstTry, 2);
    assert.match(report.text, /2 of 2 letters were right on the first try\./);
    assert.match(report.text, /Every letter was right on the first try\./);
    assert.equal(alphabetFirstTryReport([]).text, "");
  });

  it("drops student ids when it reads a saved attempt", () => {
    const row = readLetterAttempt(
      JSON.stringify({
        attempt: true,
        letter: "d",
        exercise: 2,
        outcome: "miss",
        heard: [{ transcript: "Dee", confidence: 0.4 }],
        studentId: "secret@family.test#student-1",
      }),
    );
    assert.deepEqual(row, { letter: "D", exercise: 2, outcome: "miss", heard: ["dee"] });
    assert.equal(JSON.stringify(row).includes("secret"), false);
    assert.equal(readLetterAttempt(JSON.stringify({ letter: "D", outcome: "miss" })), null);
  });

  it("counts the same heard word once per letter and keeps silence", () => {
    const samples = missSamplesFromDetails([
      JSON.stringify({ attempt: true, letter: "D", exercise: 2, outcome: "miss", heard: [{ transcript: "Dee" }] }),
      JSON.stringify({ attempt: true, letter: "D", exercise: 3, outcome: "again", heard: ["dee"] }),
      JSON.stringify({ attempt: true, letter: "R", exercise: 4, outcome: "timeout", heard: [] }),
      JSON.stringify({ attempt: true, letter: "A", exercise: 2, outcome: "correct", heard: ["ay"] }),
    ]);
    assert.deepEqual(aggregateLetterMisses(samples), [
      { letter: "D", heard: "dee", count: 2 },
      { letter: "R", heard: "silence", count: 1 },
    ]);
  });
});

describe("alphabet parent letter", () => {
  it("adds the first-try lines and leaves a sitting without hears unchanged", () => {
    const attempt = (letter: string, outcome: string, heard: string) =>
      JSON.stringify({
        attempt: true,
        letter,
        exercise: 2,
        outcome,
        heard: heard ? [{ transcript: heard, confidence: 0.8 }] : [],
        studentId: "ada@family.test#student-1",
      });
    const letter = academicLetter({
      firstName: "Ada",
      age: 6,
      subject: "sp",
      level: 1,
      standardCode: "LK",
      standardLabel: "The letter A",
      asked: 1,
      rightCount: 1,
      parentEmail: "ada@family.test",
      trial: trialState("2026-10-01T00:00:00.000Z"),
      events: [
        {
          at: "2026-10-01T00:00:00.000Z",
          levelAfter: 1,
          correct: true,
          detail: JSON.stringify({
            question: "A",
            answer: "A",
            note: "Heard.",
            correct: true,
            engine: "VKOLE/Alphabet",
            code: "LK",
            label: "The letter A",
            grade: "1",
          }),
        },
        { at: "2026-10-01T00:01:00.000Z", levelAfter: 1, correct: true, detail: attempt("A", "correct", "ay") },
        { at: "2026-10-01T00:02:00.000Z", levelAfter: 1, correct: false, detail: attempt("D", "miss", "tea") },
        { at: "2026-10-01T00:03:00.000Z", levelAfter: 1, correct: true, detail: attempt("D", "correct", "dee") },
      ],
    });
    assert.match(letter.body, /First tries/);
    assert.match(letter.body, /1 of 2 letter was right on the first try\./);
    assert.match(letter.body, /These letters needed another try: D\./);
    assert.match(letter.html, /First tries/);
    assert.match(letter.html, /color:#2c5e4a/);
    assert.match(letter.html, /1 of 2 letter was right on the first try\./);
    assert.equal(letter.body.includes("student-1"), false);
    assert.equal(letter.html.includes("student-1"), false);
    assert.equal(letter.body.includes("tea"), false);
    const older = academicLetter({
      firstName: "Ada",
      age: 6,
      subject: "sp",
      level: 1,
      standardCode: "LK",
      standardLabel: "The letter A",
      asked: 0,
      rightCount: 0,
      parentEmail: "ada@family.test",
      trial: trialState("2026-10-01T00:00:00.000Z"),
      events: [
        {
          at: "2026-10-01T00:00:00.000Z",
          levelAfter: 1,
          correct: true,
          detail: JSON.stringify({ letter: "A", outcome: "correct", question: "A", note: "Heard." }),
        },
      ],
    });
    assert.equal(older.body.includes("First tries"), false);
  });
});

describe("alphabet miss log wiring", () => {
  it("keeps the teacher list on the master account and off the pronunciation file", () => {
    const climbs = readFileSync(new URL("../climbs.ts", import.meta.url), "utf8");
    const listStart = climbs.indexOf("export const listAlphabetMisses");
    const listEnd = climbs.indexOf("export const beginSitting");
    const listFn = climbs.slice(listStart, listEnd);
    assert.equal(listStart > 0 && listEnd > listStart, true);
    assert.match(listFn, /isWebsiteMasterEmail\(accountIdOf\(context\.userId\)\)/);
    assert.equal(listFn.includes("studentId"), false);
    assert.equal(listFn.includes("child_name"), false);
    assert.equal(climbs.includes("recordAlphabetAttempt"), true);
    const stage = readFileSync(new URL("../../components/alphabet-stage.tsx", import.meta.url), "utf8");
    assert.equal(stage.includes("LETTER_ALTERNATIVE_LIMIT"), true);
    assert.equal(stage.includes("onAttemptRef"), true);
    const home = readFileSync(new URL("../../routes/index.tsx", import.meta.url), "utf8");
    assert.match(home, /fullAccess \? <AlphabetMisses \/>/);
  });
});
