import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SUBJECTS, engineNavLabel, enginePickLabel } from "./climb-rules.ts";

describe("engine labels", () => {
  it("uses the website nav strings, including Singapore and Sight Words", () => {
    assert.deepEqual(
      SUBJECTS.map((subject) => engineNavLabel(subject.id)),
      [
        "VKOLE/M ZPD",
        "VKOLE/ELA ZPD",
        "VKOLE/SS ZPD",
        "VKOLE/gen ZPD",
        "VKOLE Singapore ZPD",
        "VKOLE Sight Words ZPD",
        "VKOLE/Alphabet ZPD",
        "VKOLE/Phonemic Awareness ZPD",
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
        "Alphabet ZPD",
        "Phonemic Awareness ZPD",
      ],
    );
  });
});
