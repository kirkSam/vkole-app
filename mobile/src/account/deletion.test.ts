import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DELETION_EMAIL, deletionMessage, deletionNote, DEVICE_STORAGE_KEYS, RETIRED_DEVICE_KEYS } from "./deletion.ts";

describe("account deletion", () => {
  it("names the device records to erase and does not include a send action", () => {
    assert.deepEqual(DEVICE_STORAGE_KEYS, ["vkole.practice", "vkole.reminder"]);
    assert.deepEqual(RETIRED_DEVICE_KEYS, ["vkole.clock"]);
    const note = deletionNote();
    assert.equal(note.subject, "Delete my family's record.");
    assert.match(note.body, /does not send it/);
    assert.match(deletionMessage(), new RegExp(DELETION_EMAIL.replace(".", "\\.")));
    assert.equal(deletionMessage().includes("http"), false);
  });
});
