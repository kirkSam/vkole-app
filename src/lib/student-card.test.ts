import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  ENROLL_DID_NOT_OPEN,
  ENROLL_STILL_CLOSED,
  OPEN_ACCT_LABEL,
  OPEN_PLACE_LABEL,
  PICK_PLACE_LINE,
  SAME_PLACE_LINE,
  acceptStudentSwitch,
  climbsForActiveStudent,
  engineWorkedLevel,
  mergeFamilyStudents,
  openingForNewClimb,
  placeChoiceLabel,
  placeTakenMessage,
  studentCardButtons,
  studentPlaceChoices,
} from "./student-card.ts";

const ada = { index: 1, name: "Ada", age: 8, startingGrade: 3 };
const bea = { index: 2, name: "Bea", age: 6, startingGrade: 1 };

describe("two-student card", () => {
  it("shows the first name and Open acct. when one student is registered", () => {
    const [left, right] = studentCardButtons([ada]);
    assert.equal(left.kind, "student");
    assert.equal(left.kind === "student" && left.label, "Ada");
    assert.equal(right.kind, "open");
    assert.equal(right.label, OPEN_ACCT_LABEL);
  });

  it("puts the second student's first name on button 2 as soon as they are registered", () => {
    const [left, right] = studentCardButtons([ada, bea]);
    assert.equal(left.kind === "student" && left.label, "Ada");
    assert.equal(right.kind, "student");
    assert.equal(right.kind === "student" && right.label, "Bea");
    assert.equal(right.kind === "student" && right.index, 2);
  });

  it("uses the website place sentences word for word", () => {
    assert.equal(SAME_PLACE_LINE, "Pick the same place for the same child on the app and the website.");
    assert.equal(PICK_PLACE_LINE, "Pick Student 1 or Student 2.");
    assert.equal(placeChoiceLabel(1, "Ada"), "Student 1, Ada");
    assert.equal(placeChoiceLabel(2, "Ben"), "Student 2, Ben");
    assert.equal(placeChoiceLabel(1, ""), "Student 1, open");
    assert.equal(placeChoiceLabel(2, "  "), "Student 2, open");
    assert.equal(placeTakenMessage(1), "Student 1 is taken.");
    assert.equal(placeTakenMessage(2), "Student 2 is taken.");
    const [first, second] = studentPlaceChoices([ada]);
    assert.equal(placeChoiceLabel(first.index, first.open ? "" : first.name), "Student 1, Ada");
    assert.equal(placeChoiceLabel(second.index, second.open ? "" : second.name), "Student 2, open");
    assert.equal(second.name, OPEN_PLACE_LABEL);
    const home = readFileSync(new URL("../routes/index.tsx", import.meta.url), "utf8");
    const card = readFileSync(new URL("../components/student-switcher.tsx", import.meta.url), "utf8");
    assert.equal(home.includes("SAME_PLACE_LINE"), true);
    assert.equal(home.includes("placeChoiceLabel"), true);
    assert.equal(home.includes("placeTakenMessage"), true);
    assert.equal(home.includes("PICK_PLACE_LINE"), true);
    const placeAt = home.indexOf('aria-label="Student place"');
    const pickAt = home.indexOf("{PICK_PLACE_LINE}");
    assert.equal(pickAt > 0 && placeAt > pickAt, true);
    assert.equal(home.includes("setError(ENROLL_STILL_CLOSED)"), true);
    assert.equal(home.includes("setError(ENROLL_DID_NOT_OPEN)"), true);
    assert.equal(home.includes('if (found.status !== "open") {\n        setPending(false);'), false);
    assert.equal(ENROLL_STILL_CLOSED, "The app did not open. Check the age and the starting grade, then try again.");
    assert.equal(ENROLL_DID_NOT_OPEN, "The app did not open. Try again.");
    assert.equal(home.includes("Student {choice.index} — {choice.name}"), false);
    assert.equal(home.includes("That place already has a child"), false);
    assert.equal(card.includes("SAME_PLACE_LINE"), true);
  });

  it("uses the first word on the button and keeps the saved name for sign-in", () => {
    const [left] = studentCardButtons([{ index: 1, name: "Ada Lovelace" }]);
    assert.equal(left.kind === "student" && left.label, "Ada");
    assert.equal(left.kind === "student" && left.name, "Ada Lovelace");
  });

  it("does not drop a sibling when a later read has only one child", () => {
    const merged = mergeFamilyStudents([ada, bea], [{ index: 1, name: "Ada", age: null, startingGrade: null }]);
    assert.deepEqual(
      merged.map((student) => student.name),
      ["Ada", "Bea"],
    );
    assert.equal(merged[1]?.startingGrade, 1);
    assert.equal(merged[0]?.age, 8);
  });

  it("refuses a child who is not on this family and a third child on an ordinary account", () => {
    assert.equal(acceptStudentSwitch([ada, bea], 2, false), "ok");
    assert.equal(acceptStudentSwitch([ada], 2, false), "missing");
    assert.equal(acceptStudentSwitch([ada, bea], 3, false), "cap");
    assert.equal(acceptStudentSwitch([{ index: 3 }], 3, true), "ok");
    assert.equal(acceptStudentSwitch([], 2, false), "ok");
  });

  it("loads only the signed-in student's climbs", () => {
    const rows = [
      { childName: "Ada", level: 4 },
      { childName: "Bea", level: 1 },
    ];
    assert.deepEqual(climbsForActiveStudent(rows, [ada, bea], 2), [{ childName: "Bea", level: 1 }]);
    assert.equal(climbsForActiveStudent(rows, [ada], 1).length, 2);
  });

  it("starts a new second student at the grade the registrant entered", () => {
    const opening = openingForNewClimb({
      studentName: "Bea",
      storedGrade: 1,
      storedAge: 6,
      site: { name: "Ada", grade: 6, step: 2, reached: 4, startingGrade: 3 },
    });
    assert.deepEqual(opening, { grade: 1, step: 0, age: 6, resumeSite: false });
  });

  it("resumes a developed working level, including finished exercises", () => {
    assert.equal(engineWorkedLevel({ grade: 1, step: 0, startingGrade: 1 }), false);
    assert.equal(engineWorkedLevel({ grade: 2, step: 1, reached: 3, completedExercises: [1, 2] }), true);
    const opening = openingForNewClimb({
      studentName: "Bea",
      storedGrade: 1,
      storedAge: 6,
      site: { name: "Bea", grade: 2, step: 1, reached: 3, completedExercises: [1, 2], startingGrade: 1 },
    });
    assert.deepEqual(opening, { grade: 2, step: 1, age: 6, resumeSite: true });
  });

  it("keeps the name buttons tappable and leaves Open acct. with nothing to call", () => {
    const card = readFileSync(new URL("../components/student-switcher.tsx", import.meta.url), "utf8");
    const auth = readFileSync(new URL("./school-auth.ts", import.meta.url), "utf8");
    assert.equal(card.includes("disabled"), false);
    assert.equal(card.includes("studentCardButtons"), true);
    assert.equal(card.includes('data-student-action="none"'), true);
    assert.equal(card.includes('data-student-action="sign-in"'), true);
    assert.equal(card.includes("switchSchoolStudent"), true);
    const openHandler = card.slice(card.indexOf('data-student-action="none"'));
    assert.equal(openHandler.slice(0, openHandler.indexOf("</button>")).includes("switchSchoolStudent"), false);
    const handler = auth.slice(auth.indexOf("export const switchSchoolStudent"));
    const nextExport = handler.indexOf("export const", 10);
    const body = nextExport < 0 ? handler : handler.slice(0, nextExport);
    assert.equal(body.includes("authMiddleware"), true);
    assert.equal(body.includes("schoolMiddleware"), false);
    assert.equal(body.includes("acceptStudentSwitch"), true);
  });
});
