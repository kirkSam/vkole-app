# Standing Orders for the VKOLE App Builder
From: Sam Kirkpatrick (owner, VKOLE)
Effective: Oct 23, 2026

## 2026-11-11 (note from Sam, via Claude) — no merge without Sam's word

This replaces the Oct 23 instructions that said to merge drafts each session and to auto-merge a pull request labeled safe. Do not follow those.

From now on, never merge a pull request yourself. When a pull request is ready:

1. Send Sam the report (the usual form, with clean-copy counts and the commit id).
2. Wait. Claude reviews that exact commit.
3. Merge only after Sam writes "merge #N".

If you push any new commit after Claude's review, the review no longer counts. Send the new commit id and wait again.

## Later decision (kept on purpose)
The Oct 26 store pause was replaced by Sam's Nov 4 memo. Store release is active. Do not move this app into the website repo unless Sam says so.

## 2026-10-26 (note from Sam, via Claude) — REPLACED by the Nov 4, 2026 memo
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

---

## 1. Reporting line

You still work on your own, but you now report to someone.

- **You report to:** Sam (the owner). Sam makes every merge decision about the store and money. Grok Bot, Sam's main assistant, coordinates and keeps the record.
- **Your repo:** `kirkSam/vkole-app`. Everything you build gets pushed there. Nothing lives only in your chat.
- **Your peer:** The School Site bot owns `kirkSam/online-school`. Whenever you change something both repos share, link the matching PR in the other repo.

### After every work session, append one entry to `STATUS.md` at the repo root

```markdown
## 2026-10-23 08:45 PT (session by App Builder)
**Shipped (merged):** #64 headphone notice on every engine
**Open, needs Sam:** #1 store build, waiting on Apple/Google accounts
**Mirrors needed on website:** none
**Blocked:** Apple Developer ($99/yr), Google Play Console ($25), Mac for iOS archive
**Next:** Singapore engine moves into packages/engines (see Order 2)
```

Rules:
1. Write it in plain words, with no jargon.
2. Keep it to five lines or fewer.
3. Put the newest entry at the top.
4. If a session changes nothing, write "No change" and the reason.

### Every PR description starts with this block

```markdown
**What a parent or student will notice:** one sentence
**Also needed on website?** yes (link PR) / no / shared package, nothing to mirror
**Safe to merge?** yes / no, because ...
```

---

## 2. Fixing the duplicate builds (VKOLE engines, including Singapore)

**What's wrong:** Every engine change is currently written twice, once in each repo. In the last five days, almost every feature shipped as a matching pair of PRs. Some examples:

```
| Change                                          | Website PR        | App PR               |
| ----------------------------------------------- | ----------------- | -------------------- |
| Headphone notice on every engine                | online-school #77 | vkole-app #64        |
| Remove the 8-hour cap and midnight reset        | online-school #71 | vkole-app #59        |
| Reset the day clock at midnight (later removed) | online-school #68 | vkole-app #56        |
| Accept listed alphabet pronunciations           | online-school #69 | vkole-app #55        |
| Alphabet exercise 6 (typing)                    | online-school #61 | vkole-app #48 to #50 |
```

That doubles the work, and the two copies drift apart over time. The Singapore engine was also built twice.

**The fix:** There should be one copy of the engine code, and both the website and the app should use it. The app is built with Capacitor (branch `cursor/store-ready-capacitor-2858`), which wraps web code, so this is straightforward.

### Target layout: one monorepo

Move the app into `kirkSam/online-school` as a second workspace. The repo would look like this:

```
online-school/
package.json <- npm workspaces root
apps/
web/ <- the current Next.js site (Vercel)
mobile/ <- the current vkole-app (Capacitor shell)
packages/
engines/ <- the ONE copy of every VKOLE engine
src/
alphabet/
phonemic-awareness/
singapore-math/
writing/
shared/ <- grading, ZPD level logic, the day clock, seen-questions
index.ts
package.json <- name: "@vkole/engines"
```

The root `package.json`:

```json
{
"name": "vkole",
"private": true,
"workspaces": ["apps/*", "packages/*"],
"scripts": {
"build": "npm run build --workspaces --if-present",
"test": "npm run test --workspaces --if-present",
"check:engines": "node scripts/no-engine-copies.mjs"
}
}
```

`packages/engines/package.json`:

```json
{
"name": "@vkole/engines",
"version": "1.0.0",
"main": "src/index.ts",
"types": "src/index.ts",
"peerDependencies": { "react": ">=18" }
}
```

Both apps import the engines the same way:

```ts
// apps/web and apps/mobile both use this; never copy engine code
import { SingaporeMathEngine, AlphabetEngine } from "@vkole/engines";
```

To keep copies from creeping back in, add `scripts/no-engine-copies.mjs`. It fails the build if engine code shows up outside `packages/engines`:

```js
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const banned = /(singapore|alphabet|phonemic|zpd-engine)/i;
const roots = ["apps/web/src", "apps/mobile/src"];
const hits = [];

function walk(dir) {
for (const name of readdirSync(dir)) {
const p = join(dir, name);
if (statSync(p).isDirectory()) {
if (name === "node_modules") continue;
if (banned.test(name) && /engine/i.test(p)) hits.push(p);
walk(p);
}
}
}
roots.forEach((r) => { try { walk(r); } catch {} });

if (hits.length) {
console.error("Engine code found outside packages/engines:\n" + hits.join("\n"));
process.exit(1);
}
console.log("OK: engines live only in packages/engines");
```

### Migration order (one engine per PR, so nothing breaks)
1. Set up the workspaces. Move vkole-app into `apps/mobile` and keep its git history (`git subtree add`, or an import that preserves history).
2. Start with **Singapore Math**, since it's the newest and has the smallest footprint. Move it into `packages/engines/singapore-math`, then point both apps at it. Close whichever duplicate Singapore PR is still open.
3. Move `shared/` next: grading, ZPD levels, the day clock, and seen-questions. Most of the mirrored bugs came from this code.
4. Then move Alphabet, Phonemic Awareness, and Writing, one PR each.
5. Archive `kirkSam/vkole-app`. Mark it read-only, and point its README to the monorepo.

**If Sam would rather keep two repos for now,** the fallback is to publish `@vkole/engines` from online-school as a private GitHub Package and have vkole-app install it. That still leaves only one copy, but every engine change needs two steps: publish the package, then bump the version in the app.

---

## 3. The merge backlog, and how to prevent it

### Current backlog (checked Oct 23, 2026, ~8:45 AM PT)
Merging has mostly kept up; 77 website PRs and 64 app PRs have been handled. Two old drafts are still open:

```
| Repo          | PR                                          | What it is                             | Recommendation                                                                                   |
| ------------- | ------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| online-school | #2 Load Abu's office for the test           | Draft since Oct 1, has merge conflicts | **Close it.** It's three weeks out of date. Reopen it fresh if it's still needed.                |
| vkole-app     | #1 Store-ready iPhone and Android app       | Draft since Oct 13                     | **Keep it open** until the Apple and Google accounts exist, then merge it as the release branch. |
| vkole-app     | #28 Insert ZPD after VKOLE on button labels | Closed without merging                 | Nothing to do. Confirm the labels on the live site already include ZPD.                          |
```

The real cost isn't the number of PRs waiting. It's that **every change merges twice**, which Order 2 fixes.

### Rules to prevent a backlog
1. **Small PRs only.** Each PR makes one change a parent or student would notice.
2. **No drafts older than 3 days.** Each session, merge every draft, close it, or write the reason it's waiting in STATUS.md.
3. **Auto-merge for safe changes.** Sam has already approved merges in both repos. Turn on GitHub auto-merge for PRs that pass the build and tests and are labeled `safe`, meaning wording, colors, or bug fixes with tests. Anything about payments, the free week, logins, student data, or the app stores gets the `needs-sam` label and waits for Sam.
4. **One release PR for the stores.** Store-bound app work collects on a `release` branch, not in a pile of drafts.

A GitHub Action that flags stale drafts, saved as `.github/workflows/stale-drafts.yml`:

```yaml
name: Flag stale drafts
on:
schedule:
- cron: "17 15 * * *" # daily, ~8:17 AM PT
workflow_dispatch:
jobs:
stale:
runs-on: ubuntu-latest
permissions:
pull-requests: write
steps:
- uses: actions/github-script@v7
with:
script: |
const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
const prs = await github.paginate(github.rest.pulls.list, {
owner: context.repo.owner, repo: context.repo.repo, state: "open"
});
for (const pr of prs) {
if (pr.draft && new Date(pr.created_at).getTime() < cutoff) {
await github.rest.issues.addLabels({
owner: context.repo.owner, repo: context.repo.repo,
issue_number: pr.number, labels: ["stale-draft"]
});
await github.rest.issues.createComment({
owner: context.repo.owner, repo: context.repo.repo,
issue_number: pr.number,
body: "This draft is over 3 days old. Merge it, close it, or note in STATUS.md why it is waiting."
});
}
}
```

An auto-merge workflow for PRs labeled `safe`, saved as `.github/workflows/auto-merge-safe.yml`:

```yaml
name: Auto-merge safe PRs
on:
pull_request:
types: [labeled, opened, synchronize, ready_for_review]
jobs:
enable:
if: contains(github.event.pull_request.labels.*.name, 'safe') && !github.event.pull_request.draft
runs-on: ubuntu-latest
permissions:
pull-requests: write
contents: write
steps:
- run: gh pr merge --auto --squash "$PR"
env:
PR: ${{ github.event.pull_request.html_url }}
GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

(To use auto-merge, turn on "Allow auto-merge" in each repo's GitHub settings, and set the build to be a required check on `main`.)
