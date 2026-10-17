import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SUBJECTS, engineNavLabel } from "./climb-rules.ts";

describe("engine nav labels", () => {
  it("appends ZPD to every engine, including Singapore and Sight Words", () => {
    assert.deepEqual(
      SUBJECTS.map((subject) => engineNavLabel(subject.code)),
      [
        "VKOLE/M ZPD",
        "VKOLE/ELA ZPD",
        "VKOLE/SS ZPD",
        "VKOLE/gen ZPD",
        "VKOLE/Singapore ZPD",
        "VKOLE/SW ZPD",
      ],
    );
  });
});
