# Standing Orders for the VKOLE App Builder
From: Sam Kirkpatrick (owner, VKOLE)
Effective: Oct 23, 2026

## Later decision, Nov 2 record
The Oct 26 note below overrides the store parts of these orders. Do not work on the Capacitor shell, store listings, or store submission unless Sam asks again. The app stays in this repo. Do not move it into the website repo unless Sam says so.

## 2026-10-26 (note from Sam, via Claude)
**Decision:** Store/App Store/Google Play publish is paused indefinitely. Do not work on the Capacitor/mobile shell, store listing assets, or store-submission checklist items unless Sam explicitly asks for that again.
**Why:** The app and the website are not ready yet. Known gaps from the last audit: the app and website run two separate copies of the learning engine with no shown sync, and the store-ready branch (`cursor/store-ready-capacitor-2858`) predates ~70 commits of engine work and was never updated.
**Shipped (merged):** Nothing new today
**Blocked / on hold:** Apple Developer account, Google Play Console account, Mac for iOS archive — not being pursued right now
**Next:** Focus on app/website stability and engine parity. Revisit store publish only when Sam restarts that track.

---

## 1. Reporting line

You still work on your own, but you now report to someone.

- **You report to:** Sam (the owner). Sam makes every merge decision about the store and money. Grok Bot, Sam's main assistant, coordinates and keeps the record.
- **Your repo:** `kirkSam/vkole-app`. Everything you build gets pushed there. Nothing lives only in your chat.
- **Your peer:** The School Site bot owns `kirkSam/online-school`. Whenever you change something both repos share, link the matching PR in the other repo.

### After every work session, append one entry to `STATUS.md` at the repo root

Rules:
1. Write it in plain words, with no jargon.
2. Keep it to five lines or fewer.
3. Put the newest entry at the top.
4. If a session changes nothing, write "No change" and the reason.

### Every PR description starts with this block

**What a parent or student will notice:** one sentence
**Also needed on website?** yes (link PR) / no / shared package, nothing to mirror
**Safe to merge?** yes / no, because ...

---

## 2. Fixing the duplicate builds (VKOLE engines, including Singapore)

**What's wrong:** Every engine change is currently written twice, once in each repo. That doubles the work, and the two copies drift apart over time. The Singapore engine was also built twice.

**The fix:** There should be one copy of the engine code, and both the website and the app should use it.

### Chosen path for now: shared package, not a monorepo

Keep two repos. Do not move the app into `online-school` yet. Sam later decided the app stays independent of the website, and store work is paused. A monorepo would undo that.

If Sam confirms, publish `@vkole/engines` from the website repo as a private GitHub Package and have this app install it. One engine per pull request: Singapore Math first, then shared grading and the day clock, then Alphabet, Phonemic Awareness, and Writing.

### Target layout if Sam later chooses one monorepo

```
online-school/
  apps/web/
  apps/mobile/
  packages/engines/
```

Both apps would import `{ SingaporeMathEngine, AlphabetEngine }` from `@vkole/engines`. A check script would fail the build if engine code appears outside `packages/engines`.

---

## 3. The merge backlog, and how to prevent it

1. **Small PRs only.** Each PR makes one change a parent or student would notice.
2. **No drafts older than 3 days.** Each session, merge every draft, close it, or write the reason it's waiting in STATUS.md.
3. **Auto-merge for safe changes.** Wording, colors, or bug fixes with tests can be labeled `safe`. Payments, the free week, logins, student data, or the app stores get `needs-sam` and wait for Sam.
4. **One release PR for the stores.** Store work stays paused until Sam restarts it. Then it collects on a `release` branch.

Checked again on Nov 2, 2026: online-school #2 was still an open draft from Oct 1, with merge conflicts. Closed it. vkole-app #1 stays open and is not being worked, because store publish is paused.
