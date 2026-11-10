VKOLE TEAM MEMO — UPDATE 4: THE VEKOLE ENGINE DESIGN
From Sam, written with Claude
For School Site and app Builder. Same text to both.
Save this with the earlier memos. Where they disagree, this update wins.

=====================================================================
0. WHAT THIS IS
=====================================================================
VKOLE becomes VEKOLE: the E is for Ebbinghaus. Every engine gains a
memory layer built on Ebbinghaus's forgetting curve, plus the Kirkpatrick
fatigue layer. Both are rules only: no AI calls, no outside services.
No statistics layer: nothing is collected beyond what each engine needs
to teach the child on its own side.

=====================================================================
1. ONE SHARED ENGINE PACKAGE (now required)
=====================================================================
The new rules are written ONCE and used by both the app and the website,
so the engines stay identical by design. (This is Order 2 in AGENTS.md,
parked since Nov 4; Sam now says yes.)
- app Builder and School Site: agree on how to share it (a separate repo
  used as a package, or another method) and send Sam one joint plan
  before building.
- Both sides always use the same version. Claude checks both.
- Student information still never crosses sides. The package shares
  rules, not data. Each side keeps its own memory records.

=====================================================================
2. THE EBBINGHAUS MEMORY LAYER
=====================================================================
THE FORMULA
  R = e^(-t/S)
  R = chance the child still remembers the item
  t = days since the item was last practiced
  S = the item's memory strength, in days
  An item is DUE for review when R falls below 0.80,
  which happens at t = S x ln(1.25), about 0.22 x S.

WHAT COUNTS AS AN ITEM
  Sight Words: each word.  Phonemic Awareness: each prompt.
  Alphabet: each letter.   Math, ELA, Social Studies, General,
  Singapore: each standard or step.

NEW LEARNING
  The first time a child answers an item correctly, create its memory
  record: S = 4.5 days, last practiced = now, reviews = 0, misses = 0.

SAME-SESSION RE-CHECK (once per new item)
  After a new item is first answered correctly, show it once more in the
  same session, after about 10 minutes or 8 other items, whichever comes
  first. If the session ends first, skip it.
  - Correct: S = S x 1.2. The first review stays about one day away.
  - Miss: handle it with the engine's normal miss rule (speak, show),
    then S = max(1.0, S x 0.4).

SCHEDULED REVIEW (when due)
  - Correct: S = S x (2.5 + 2 x max(0, 0.80 - R)).
    Reviewing on time multiplies by 2.5. Remembering after a longer
    gap earns a bigger boost (the spacing effect).
  - Miss: the engine's normal miss rule, then S = max(1.0, S x 0.4),
    so it comes back soon.

THE SCHEDULE THIS MUST PRODUCE (on-time correct reviews):
  1st review after about 1 day, then about 2.5 days, 6 days,
  16 days, 40 days. Add a test that reproduces this table.

MIXING REVIEWS IN
  - At most 1 review in every 4 items served. New learning continues.
  - The most-faded item (lowest R) comes first.
  - At most 10 reviews per session. The rest wait for the next session.
  - Reviews look and work exactly like normal items in that engine
    (same timing, same speaking, same adult buttons).

THE GOLDEN RULE
  Reviews and re-checks NEVER change the child's growth level. They only
  change memory strength. (The VEKOLE notebook had this bug: reviews
  dragged the level down. Do not repeat it.)

=====================================================================
3. THE KIRKPATRICK FATIGUE LAYER
=====================================================================
Based on what the child does, never on any label or diagnosis. Never
store or use a disability, diagnosis, or trait.
- Track answer times in the current session.
- After at least 5 answers, fatigue is HIGH when an answer takes more
  than 1.8 x the average of the PREVIOUS answers (not counting the
  current one), or when there are 3 misses in a row.
- HIGH stays on until 3 answers in a row at normal pace.
- While HIGH:
  - a miss steps the level down one step early, in engines that have a
    step-down rule. Sight Words never moves to an easier list; Alphabet
    keeps its own step-back rules.
  - no same-session re-checks and no reviews are served (don't test
    memory on a tired child).

=====================================================================
4. ONE SETTINGS FILE
=====================================================================
Every number above lives in one settings file in the shared package,
so Sam can tune it later with a one-line change:
  starting strength 4.5 days; due threshold 0.80; review multiplier 2.5;
  spacing bonus 2; miss factor 0.4; minimum strength 1.0 day;
  re-check after 10 minutes or 8 items; reviews 1 in 4, max 10 per
  session; fatigue 1.8x pace after 5 answers, 3 misses in a row,
  3 normal answers to clear.

=====================================================================
5. WHAT PARENTS SEE
=====================================================================
- On each engine card: "Due for review today: N" (only when N > 0).
- In the session report: items reviewed, and how many were remembered.
Plain words, about a 6th-grade reading level, identical on both sides.

=====================================================================
6. TESTS (both sides, through the shared package)
=====================================================================
- The schedule table in section 2.
- Reviews never change the growth level.
- Fatigue cannot turn on before 5 answers; uses the previous average;
  clears only after 3 normal answers; blocks reviews while HIGH.
- Sight Words never moves to an easier list, even when fatigued.
- Memory records never cross between app and website.

=====================================================================
7. AI-DRAFTED CONTENT (later, separate)
=====================================================================
AI may DRAFT new questions and hints at a target level. Sam reviews and
approves every item before it joins the bank both sides use. AI never
serves questions live to a child.

=====================================================================
8. THE VEKOLE NAME CHANGE (after the engine work)
=====================================================================
A full sweep on both sides, like "eight -> library": VKOLE -> VEKOLE in
every visible place.
app Builder, NOW: report the Android app ID (applicationId) and
recommend whether to keep it. Changing it after Google Play release
makes Play treat VEKOLE as a brand-new app. Sam decides before the first
submission.

=====================================================================
9. ORDER OF WORK
=====================================================================
1. Finish the current release blockers: voice consent (#99, #70) and
   Android listening and speaking.
2. Joint plan for the shared engine package -> Sam's go.
3. Build the Ebbinghaus layer and fatigue layer in the package; connect
   both sides. Claude checks. Sam tests on his phone.
4. VEKOLE name sweep on both sides.
5. Google Play submission as VEKOLE.
Every report uses the usual form. Claude checks before every merge.
