VKOLE TEAM MEMO — UPDATE 7: KEEPING APP AND WEBSITE IDENTICAL
From Sam, written with Claude
For School Site and app Builder. Same text to both.

The goal: the app and website cannot behave differently, by design.

1. ONE COPY OF THE RULES. Grading, leveling, the Ebbinghaus memory layer,
   and the fatigue layer live only in kirkSam/vekole-engine. Neither side
   keeps its own copy of any rule once the package is connected.

2. SAME VERSION, CHECKED AUTOMATICALLY. Each side pins one exact tag and
   has a test that fails if its pinned tag differs from the agreed tag
   (kept in one file in the package, e.g. AGREED_VERSION).

3. SHARED PARITY TESTS. The package includes a fixed list of examples
   (question + answer -> verdict; answer history -> next review date;
   answer times -> fatigue on/off). Both sides run the full list through
   their own connecting code on every test run.

4. SHARED SENTENCES. Every parent- and child-facing sentence the engines
   show (consent text, review counts, Android and microphone messages)
   lives in one file in the package. Both sides use it.

5. BEFORE EACH RELEASE: Claude checks both sides' PRs, and Sam runs a
   side-by-side test: same engine, same question, same answer, same
   result on the website and in the app.

SCHOOL SITE, NOW: report how the website grades typed answers today.
The app grades every pool question (all have answer keys) in code with
no Grok call, and calls Grok only for Grok-written questions. Does the
website do the same? If not, list the difference.
