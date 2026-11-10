## 2026-11-10 keep both sides identical, Update 7 (App Builder)
**Decision:** Update 7 is saved in docs/team-memo-2026-11-10-update-7.md. Once connected, grading, leveling, memory, and fatigue live only in kirkSam/vekole-engine. Both sides pin one agreed tag. The package is not connected. The app still grades a pool question in code and calls Grok only for a question Grok wrote.
**Next:** School Site reports whether the website grades typed answers the same way. If not, it lists the difference.

## 2026-11-09 re-check leaves strength at 4.5 (App Builder)
**Decision:** A correct same-session re-check does not multiply strength. S stays 4.5 days. A miss still sets S = max(1.0, S x 0.4). One schedule table covers every child. Update 4 and the package plan are amended. The package will not call Grok. It writes the instruction and reads the reply. Each side makes the call. The Android id is unchanged. Parents will see it in the Play link. kirkSam/vekole-engine is not created.
**Next:** Wait for School Site's answer to the joint plan and for Sam's go.

## 2026-11-09 grading rules, Update 5 (App Builder)
**Decision:** Update 5 is saved in docs/team-memo-2026-11-09-update-5.md. Where it disagrees with the earlier memos, Update 5 wins. Grading is not built. It waits with the shared package, after voice consent. Every typed pool item already has an answer key: Mathematics 22,262; ELA 6,057; Social Studies 4,110; General 5,955; Singapore 5,184. None are missing a key. Mathematics grade 8, step 1, has 40 slope items that accept the number and the fraction but not the number word. Those need the word added.
**Next:** School Site reports how the website grades typed answers today. No grading code until the shared-package go.

## 2026-11-09 VEKOLE Update 4 (App Builder)
**Decision:** Update 4 is saved in docs/team-memo-2026-11-09-update-4.md. Where it disagrees with the earlier memos, Update 4 wins. The shared rules are not built. Voice consent stays first (app pull request #70, not merged). The Android id is com.dotheimpossible.vkole. Recommendation: keep it. Sam decides before the first Play submission. The package plan is docs/vekole-shared-package-plan.md. It waits for School Site and for Sam's go.
**Next:** School Site agrees or sends a change. No engine code until that go.

## 2026-11-05 phone test merged (App Builder)
**Decision:** Pull request #69 is merged. When a build has no git version, the bottom line is the Pacific minute of that build. This publish's ready build says Build 2026-11-05 11:38 PT.
**Next:** Sam publishes once and checks that line. An old copy has no Build line.

## 2026-11-05 phone test (App Builder)
**Decision:** Pull request #69 shows Build c86d24f, asks the phone not to keep an old page, and says why enroll did not open. The website line no longer says the two sides share progress. Not merged.
**Next:** Claude checks the diff. School Site checks issue #96.

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
