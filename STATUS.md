## 2026-11-04 accounts are experimental (from Sam, via Claude)
**Decision:** Update 2 is saved with the Nov 4 memos. There are no real student or parent accounts. Test rows may be cleared if they are in the way. Do not drop tables, delete migrations, or change the database setup. Do not touch Stripe live settings, keys, or prices. Tell Sam in one line when anything is cleared. Tell Sam first before clearing the master account.
**Next:** School Site gets the same text. Nothing was cleared today.

## 2026-11-04 place wording on the separation branch (App Builder)
**Decision:** The engine screen uses the website's place sentences word for word. A used place says "Student 1, Ada". An empty place says "Student 1, open". A taken place says "Student 1 is taken." or "Student 2 is taken." Not merged.
**Next:** Claude checks the diff. The six crossing functions stay deleted. The profileKeepingProgress guard test stays.

## 2026-11-04 place picker on the separation branch (App Builder)
**Decision:** Same pull request as the separation. A parent picks Student 1 or Student 2. A used place on this side shows the child's name. An empty place says open. Old crossing functions are deleted. Not merged.
**Next:** Claude checks the diff. School Site stops sending child names and levels.

## 2026-11-04 separation branch (App Builder)
**Decision:** Student information stays on the app. Account fields still come from the website. Not merged. Claude checks this diff first.
**Next:** Sam republishes main (the test fix). This branch waits.

## 2026-11-04 later still (from Sam, via Claude)
**Decision:** Stay/stop lists are approved. FamilyStudent keeps only `index` (stop name, age, startingGrade). `clockLimit` stops. Both sides use the built-in daily limit: 8 hours, DAY_LIMIT_SECONDS = 28800. The shortened memo is filled back in with the dropped instructions (data safety form, report form, the "not shared" sentence stays down, shared-engine recommendation, and the two task lists).
**Next:** One test-fix pull request, not merged. Separation stays on its own branch until Claude checks the diff.

## 2026-11-04 test rule (from Sam, via Claude)
**Decision:** Before Google Play, main has zero code errors and zero failing tests. A new change reports the error count before and after.
**Next:** App main today is typecheck clean. The full test command stops on 10 host title checks. The learning-engine tests have 1 real failure, about saving a child name to the website.

## 2026-11-04 later (from Sam, via Claude)
**Decision:** The earlier Nov 4 memo is replaced by the final memo in docs/team-memo-2026-11-04.md. Google Play first. Student information stays separate. Paid access, the free week, and Student 1 or Student 2 places stay shared.
**Next:** Sam reviews the stay and stop field list before any separation code is merged.

## 2026-11-04 (from Sam, via Claude)
**Decision:** Store release is active. Focus: get the app ready to release. Engines identical; student information separate; only parent account and sign-in shared. This replaces the Oct 26 pause note.
**Next:** map shared data (Task 1), wording change, update the store branch.

## 2026-11-02 08:54 PT (session by App Builder)
**Shipped (merged):** nothing a parent will notice
**Open, needs Sam:** one shared engine package, only if you still want it
**Mirrors needed on website:** none
**Blocked:** store work stays paused; the app stays in this repo
**Next:** online-school #2 closed as a stale draft

## 2026-10-26 (note from Sam, via Claude) — REPLACED by the Nov 4 memo
**Decision:** Store/App Store/Google Play publish is paused indefinitely. Do not work on
the Capacitor/mobile shell, store listing assets, or store-submission checklist items
unless Sam explicitly asks for that again.
**Why:** The app and the website are not ready yet. Known gaps from the last audit:
the app and website run two separate copies of the learning engine with no shown
sync, and the store-ready branch (`cursor/store-ready-capacitor-2858`) predates ~70
commits of engine work and was never updated.
**Shipped (merged):** Nothing new today
**Blocked / on hold:** Apple Developer account, Google Play Console account, Mac for
iOS archive — not being pursued right now
**Next:** Focus on app/website stability and engine parity. Revisit store publish only
when Sam restarts that track.
