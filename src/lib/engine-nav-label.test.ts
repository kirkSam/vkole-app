import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SUBJECTS, engineNavLabel, enginePickLabel } from "./climb-rules.ts";

describe("engine labels", () => {
  it("uses the website nav strings, including Singapore and Sight Words", () => {
    assert.deepEqual(
      SUBJECTS.map((subject) => engineNavLabel(subject.id)),
      [
        "VKOLE ZPD/M ZPD",
        "VKOLE ZPD/ELA ZPD",
        "VKOLE ZPD/SS ZPD",
        "VKOLE ZPD/gen ZPD",
        "VKOLE ZPD Singapore ZPD",
        "VKOLE ZPD Sight Words ZPD",
        "VKOLE ZPD/Spelling ZPD",
        "VKOLE ZPD/Phonemic Awareness ZPD",
      ],
    );
  });

  it("uses the website pick and rail strings", () => {
    assert.deepEqual(
      SUBJECTS.map((subject) => enginePickLabel(subject.id)),
      [
        "Mathematics ZPD",
        "English Language Arts ZPD",
        "Social Studies ZPD",
        "General ZPD",
        "Singapore ZPD",
        "Sight Words ZPD",
        "Spelling ZPD",
        "Phonemic Awareness ZPD",
      ],
    );
  });
});
