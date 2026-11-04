VKOLE TEAM MEMO — UPDATE 1 (adds to the final Nov 4 memo)
From Sam, written with Claude — November 4, 2026
For School Site and app Builder. Same text to both.
Save this next to the final Nov 4 memo. Where they disagree, this update wins.

=====================================================================
1. NEW DECISION: THE TWO-PLACE TRADE-OFF
=====================================================================
Student names are not shared, so neither side can check that the same
child sits in the same place on the app and the website. Sam accepts this.
- The limit is two places, Student 1 and Student 2, on each side.
- Which child sits in each place depends on the parent following the
  instruction "Pick the same place for the same child on the app and the
  website."
- Do NOT try to enforce it by sharing names, initials, ages, birth years,
  or anything else about a child. Privacy wins over this check.
- The terms page states the rule (School Site task 3a).

=====================================================================
2. app Builder — PR #67 review (129e009)
=====================================================================
Claude verified on a clean copy: npm ci works, 0 code errors, 191 + 282
tests pass. Nothing in the app sends student information to the website.
Every save of website data goes through profileKeepingProgress, which keeps
only account fields and place numbers. Good work.

Not ready to merge yet. Add these to the same PR:
a. LET THE PARENT PICK THE PLACE. Today the app assigns places by order
   (first name typed = Student 1). When a parent adds a child, show two
   choices: Student 1 and Student 2. A place used on this side shows the
   child's name; an empty place says "open". Keep the sentence "Pick the
   same place for the same child on the app and the website."
   Use the same screen wording as the website (agree it with School Site).
b. DELETE THE OLD CROSSING CODE. No callers now, but they still send
   student data if anyone re-connects them: pushSchoolAccount,
   pullSchoolAccount, schoolWriteBody, writeSchoolAccount,
   saveSchoolStudent, postSessionEndReport. Remove them and their tests.
c. ADD A GUARD TEST: give profileKeepingProgress a website answer that
   contains a child's name, levels, clock, and seen questions, and check
   that none of them end up in the result.
Report clean-copy counts before and after. Claude checks before merge.

=====================================================================
3. School Site — your tasks
=====================================================================
a. TERMS LINE. Add to the terms page, in plain words:
   "One account covers two children in total, on the app and the website
   together."
   The app links to the website's terms page, so one change covers both.
   Legal page: send to Sam for compliance review before it goes live.
b. WEBSITE SIDE OF THE SEPARATION. The app no longer posts anything to
   /api/account/family. Now the website must:
   - stop SENDING student information to the app. The answer from
     /api/account/family keeps only account fields (sign-in, access, plan,
     free week, email confirmed, lock reason, office) and place numbers
     (Student 1 / Student 2, the number only, no name, age, or grade).
   - stop ACCEPTING student information from the app: ignore or refuse
     levels, clock, seen questions, names, ages, and grades sent to that
     address.
   - remove the address that received the app's session reports. Nothing
     uses it now; an unused door gets closed.
   - add a guard test showing the family answer never contains a child's
     name, levels, clock, or seen questions.
c. PICK THE PLACE on the website the same way as the app: two choices,
   Student 1 and Student 2, same wording on both sides. Agree the screen
   wording with app Builder.
d. Earlier tasks from the final memo still stand (Sight Words check and
   70% rule, Alphabet name, library wording, one email sender, privacy
   page).
Report with clean-copy counts before and after. Claude checks before merge.

=====================================================================
4. STILL TRUE
=====================================================================
- The "private and not shared" sentence stays down until BOTH sides are
  finished and Claude has verified them.
- Email sender (Gmail "send as" or Resend): waiting on Sam.
