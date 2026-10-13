import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { DATA_INVENTORY, NOT_COLLECTED } from "./inventory.ts";

const checklist = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../../docs/STORE_SUBMISSION.md"),
  "utf8",
);

describe("privacy inventory", () => {
  it("is the list the store checklist names", () => {
    for (const row of DATA_INVENTORY) {
      assert.equal(checklist.includes(row.id), true, row.id);
    }
    for (const item of NOT_COLLECTED) {
      assert.equal(checklist.toLowerCase().includes(item), true, item);
    }
  });
});
