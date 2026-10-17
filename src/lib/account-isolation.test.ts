import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  accountsVisibleTo,
  mayListEveryRegistrant,
  normalizeAccountEmail,
  noticeNamesOnly,
  singleAccountNotice,
  teacherEmails,
} from "./account-scope.ts";
import { websiteSignInRefusal } from "./school-account.ts";

const ada = { email: "Ada@Family.test", name: "Ada" };
const ben = { email: "ben@other.test", name: "Ben" };
const families = [ada, ben];

describe("two accounts stay separate", () => {
  it("shows a parent only the email they signed in with", () => {
    assert.deepEqual(
      accountsVisibleTo("  ada@family.test ", families).map((row) => normalizeAccountEmail(row.email)),
      ["ada@family.test"],
    );
    assert.deepEqual(
      accountsVisibleTo("Ben@Other.test", families).map((row) => row.name),
      ["Ben"],
    );
    assert.deepEqual(accountsVisibleTo("nobody@example.com", families), []);
  });

  it("does not put another family's address in a notice", () => {
    const notice = singleAccountNotice(ada);
    assert.equal(notice.email, "ada@family.test");
    assert.equal(noticeNamesOnly(notice.body, ada.email, [ben.email]), true);
    assert.equal(notice.body.includes("ben@other.test"), false);
    assert.equal(notice.body.includes("All registrations"), false);
  });

  it("keeps the full list on a teacher check and never treats a parent as that teacher", () => {
    const teachers = teacherEmails("teacher@school.test", "helper@school.test");
    assert.equal(mayListEveryRegistrant("teacher@school.test", teachers), true);
    assert.equal(mayListEveryRegistrant("ada@family.test", teachers), false);
    assert.equal(mayListEveryRegistrant("kirk.sam.alpha@gmail.com", teachers), false);
  });

  it("does not treat a stored local row as an unrecognized website account", () => {
    assert.equal(websiteSignInRefusal("unknown", true), "unknown");
    assert.notEqual(websiteSignInRefusal("unknown", true), "legacy");
  });

  it("does not email or render every registrant from the parent home", () => {
    const ledger = readFileSync(new URL("./ledger.ts", import.meta.url), "utf8");
    const home = readFileSync(new URL("../routes/index.tsx", import.meta.url), "utf8");
    assert.equal(ledger.includes("All registrations"), false);
    assert.equal(ledger.includes('select lower("email"), "name", "createdAt" from "user"'), false);
    assert.equal(ledger.includes("formsubmit.co"), false);
    assert.equal(home.includes("Registration emails"), false);
    assert.equal(home.includes("account.registrations"), false);
  });
});
