import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  accountsVisibleTo,
  mayListEveryRegistrant,
  normalizeAccountEmail,
  noticeNamesOnly,
  mayAllowAppMail,
  parentMailStaysOnAccount,
  sameAccount,
  singleAccountNotice,
  teacherEmails,
} from "./account-scope.ts";
import { websiteSignInRefusal } from "./school-account.ts";

const ordinaryParent = "kirksamalpha@gmail.com";
const dottedOperator = "kirk.sam.alpha@gmail.com";
const schoolDesk = "kirksam.alpha@dotheimpossible.ai";

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
    const mail = readFileSync(new URL("./app-mail.ts", import.meta.url), "utf8");
    assert.equal(ledger.includes("All registrations"), false);
    assert.equal(ledger.includes('select lower("email"), "name", "createdAt" from "user"'), false);
    assert.equal(ledger.includes("from registrations"), false);
    assert.equal(ledger.includes("formsubmit.co"), false);
    assert.equal(home.includes("Registration emails"), false);
    assert.equal(home.includes("account.registrations"), false);
    assert.equal(mail.includes("parentMailStaysOnAccount"), true);
  });

  it("keeps an ordinary parent off every other family's registration", () => {
    const roster = [
      { email: ordinaryParent, name: "Kirk" },
      { email: dottedOperator, name: "Operator" },
      ada,
      ben,
    ];
    assert.equal(sameAccount(ordinaryParent, dottedOperator), false);
    assert.deepEqual(
      accountsVisibleTo(ordinaryParent, roster).map((row) => row.email),
      [ordinaryParent],
    );
    assert.equal(mayListEveryRegistrant(ordinaryParent, teacherEmails(undefined, undefined)), false);
    assert.equal(mayListEveryRegistrant(dottedOperator, teacherEmails(undefined, undefined)), false);
    assert.equal(mayAllowAppMail(ordinaryParent, undefined), false);
    assert.equal(mayAllowAppMail(dottedOperator, undefined), true);
    assert.equal(mayAllowAppMail(ordinaryParent, dottedOperator), false);
    const own = singleAccountNotice({ email: ordinaryParent, name: "Kirk" });
    assert.equal(parentMailStaysOnAccount(ordinaryParent, own.body, schoolDesk), true);
    assert.equal(own.body.includes(ben.email), false);
    const dumped = ["All registrations:", ordinaryParent, ada.email, ben.email, dottedOperator].join("\n");
    assert.equal(parentMailStaysOnAccount(ordinaryParent, dumped, schoolDesk), false);
    assert.equal(parentMailStaysOnAccount(dottedOperator, dumped, schoolDesk), false);
    assert.equal(parentMailStaysOnAccount(dottedOperator, `New:\n${ben.email}`, schoolDesk), false);
  });
});
