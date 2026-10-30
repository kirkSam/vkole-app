# Agent Notes — shared name registry

This file exists to stop one specific kind of bug: a parent-facing name gets
changed, but the internal code name doesn't follow, and later that gap reads
as a mismatch or a mystery to whoever looks at the code next (a person or an
AI agent). It happened once already with the Alphabet engine (see below).

**How this is meant to be used:**
- **Claude** (works directly in this repo): read this file before touching an
  engine's name or adding a new one; update the matching row the same time
  you rename anything.
- **App Builder** (builds/publishes this same repo): since this file lives in
  the repo, you can read it directly — no need for Sam to paste it. Check it
  before assuming a code name matches what parents see.
- **School Site** (separate repo, the public website): this file isn't
  visible to you automatically. Sam pastes it in when a name is relevant to
  something you're building — treat it as the current source of truth at the
  time it's pasted, not a live feed.
- **Sam**: update the table any time you rename something user-facing (as you
  did for Alphabet), even if you don't touch the code yourself that day. A
  stale row is exactly how this confusion happens.

## Why an engine has two separate names

Every engine has a short, stable **engine code** (`sp`, `m`, `sg`, …) stored
in the database and used between this app and the school website. That code
should basically never change once real accounts exist under it — renaming
it means a live data migration, not a find-and-replace.

Everything else — the code's folder/file/function names, and the name a
parent actually sees in the app — can change freely and independently. The
Alphabet engine's confusion came from exactly this: the *display* name was
corrected from "Spelling" to "Alphabet," but the *internal code* name (the
folder, the functions, the file) stayed "spelling" — so the same engine had
two different names depending on where you looked. Fixed 2026-10-30 (see the
table below and the "Known history" note).

## Engine registry

| Engine code | Internal code name | What parents/students see | What it teaches | Notes |
|---|---|---|---|---|
| `m` | math | Mathematics | Common-Core-style math, grades 1–12 | |
| `ela` | ela | English Language Arts | Reading & language standards, grades 1–12 | |
| `ss` | social studies | Social Studies | History & civics standards, grades 1–12 | |
| `gen` | general | General | Science, basic numeracy, civics | |
| `sg` | singapore | Singapore Math | Singapore bar-model method, grades 1–12 | No AI used |
| `sw` | sight-words | Sight Words | 16 word-recognition bands | No AI used |
| `sp` | **alphabet** (folder: `src/lib/vkole/alphabet/`) | Alphabet (was "Spelling" in older sittings) | Alphabet: song, letter recognition, recall, recitation, typing | AI used for one end-of-session parent summary only. Empty `LS`/`CVC`/`DOLCH`/`FRY` content slots are staying empty/unused here — decided 2026-10-30, see below. |
| `pa` | phonemic-awareness | Phonemic Awareness | 88 bands of sound-awareness skill | No AI used |

## Known history

- **2026-10-30** — Renamed the `sp` engine's internal code from "spelling" to
  "alphabet" throughout `src/` (folder, files, functions, types, comments) to
  match the display name Sam had already corrected in the app itself. The
  engine code `sp` and the database column `climb_sittings.spelling_report`
  were deliberately left unchanged — renaming either touches live data and
  needs a coordinated migration, not a source-only edit. A backward-compat
  shim already existed for the old display name (`shownEngine()` in
  `src/lib/academic-email.ts`, converts a sitting that still has
  `"VKOLE/Spelling"` stored to show `"VKOLE/Alphabet"`) — left untouched.

## Resolved: the empty LS/CVC/DOLCH/FRY slots

The `sp`/Alphabet engine's own data (`src/lib/vkole/alphabet/items.ts`,
`ALPHABET_BANDS`) lists three content bands — `LS` (letter sounds), `CVC`
(three-letter words), `DOLCH`, `FRY` (sight-word-style word lists) — with
zero items in any of them, left over from before the plan changed to a
separate new Spelling engine.

**Decision (App Builder, 2026-10-30):** leave them empty inside Alphabet —
do not move them into the new Spelling engine as placeholders. The new
engine starts fresh with its own content and its own engine code (never
`sp`). These four band ids inside Alphabet are therefore permanently unused
scaffolding; a future cleanup pass could remove them from `ALPHABET_BANDS`
entirely, but nothing depends on that happening soon.

## Adding a new engine

When the real Spelling engine (or anything else) is built:
1. Pick its engine code first, and don't reuse `sp` — that code means
   Alphabet now, in the live database.
2. Add a row to the table above the same day you name it anywhere else.
3. Tell School Site and App Builder about the new row explicitly — this file
   doesn't push itself to anyone.
