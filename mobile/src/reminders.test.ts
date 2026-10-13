import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseReminder, reminderLabel } from "./reminders.ts";

describe("reminders", () => {
  it("stays off until a parent turns it on, and rejects bad hours", () => {
    assert.equal(parseReminder(null).enabled, false);
    assert.equal(parseReminder('{"enabled":true,"hour":16,"minute":5}').enabled, true);
    assert.equal(parseReminder('{"enabled":true,"hour":25,"minute":0}').enabled, false);
    assert.equal(reminderLabel({ enabled: true, hour: 16, minute: 5 }), "4:05 PM");
  });
});
