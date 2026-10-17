# VKOLE shared account API

The school website is the account book. The app calls it from its own server with header `X-Vkole-Secret`. The browser never sees the secret. The account id is the lowercase parent email.

Base: `https://www.dotheimpossible.ai`

| Path | Body |
|---|---|
| `POST /api/vkole/register` | email, password, and the first student name when one is being enrolled |
| `POST /api/vkole/sign-in` | email and password |
| `POST /api/vkole/read` | `{ "id" }` |
| `POST /api/vkole/write` | `{ "id", "level", "clockSeconds", "seen", "student"? }` |
| `POST /api/vkole/password-reset` | email |
| `POST /api/vkole/password-reset/confirm` | email, code, password |

The account id is the email after trimming and lowercasing. Dots in the address stay. Register and sign-in both send that lowercase id. Sign-in tries the typed spelling only when the lowercase id is unknown.

The password is the typed password with trailing newlines removed. It is not trimmed and it is not lowercased. Register, sign-in, and password-reset confirm all send that same value. The website's `src/lib/vkole` handlers must store and check that same value, in the same account row the engine sign-in reads.

`VKOLE_MASTER_EMAIL`, or `kirksamalpha@dotheimpossible.ai` when that variable is empty, is never on a free week and never has to pay. Register, sign-in, and read for that email return `access: "open"` and do not send a finished free week. The website's client already skips the free week for that address. The API handlers in `src/lib/vkole` have to do the same.

A write replaces each engine object that is sent. Engines that are omitted are not part of this app's write. The app sends every engine it has on the device.

`seen` is the last 400 questions, `{ "key", "text" }`. `clockSeconds` is the shared day clock, capped at 2.5 hours.

## Engine keys

`m`, `ela`, `ss`, `gen`, `sg`, `sw`, `sp`, `pa`.

`m`, `ela`, `ss`, and `gen` store `{ "grade": 1-12, "step": 0|1|2 }`.

## level.sg

Field names are sent as stored: `id`, `name`, `enteredBy`, `grade`, `step`, `earnedGrade`, `standardId`, `tier`, `simple`, `streak`, `missStreak`, `reached`, `missed`, `updatedAt`, plus `startingGrade`, `levelCode`, `levelLabel`, `pending`, and `mastery` when present.

`step` is 0 concrete, 1 pictorial, 2 abstract. `mastery.strands` uses `number`, `measurement`, `geometry`, `data`, `algebra`, `calculus`. `mastery.heuristics` keeps the names with spaces, including `bar model` and `work backwards`. A tally is `{ "asked", "correct" }`. `correct` is never above `asked`. Asked 0 is omitted.

## level.sw

Sight words. The key is `sw`.

```json
{
  "id": "sw-ada",
  "name": "Ada",
  "enteredBy": "parent",
  "grade": 1,
  "step": 0,
  "band": "D-1",
  "index": 0,
  "word": "after",
  "earnedGrade": 1,
  "reached": 0,
  "missed": 0,
  "updatedAt": 0,
  "startingGrade": 1,
  "levelCode": "D-1",
  "levelLabel": "1st"
}
```

`band` is the list. `index` is the word in that list. `step` stays 0. The position is `index`, not `step`. `word` is the word now showing. The word lists, heart indexes, and `also` homophones are in `src/lib/vkole/sight-words/data.json`, copied from `docs/sight-words-website-canonical.md`. Fry bands omit words already taught in Dolch, so F-1 has 10 words.

### Bands

`D-PP`, `D-P`, `D-1`, `D-2`, `D-3`, `D-N`, `F-1`, `F-2`, `F-3`, `F-4`, `F-5`, `F-6`, `F-7`, `F-8`, `F-9`, `F-10`.

| Band | Grade label | Words |
|---|---|---|
| D-PP | Pre-K | 40 |
| D-P | K | 52 |
| D-1 | 1st | 41 |
| D-2 | 2nd | 46 |
| D-3 | 3rd | 41 |
| D-N | K-3 | 95 |
| F-1 | K-1 | 10 |
| F-2 | 1st-2nd | 38 |
| F-3 | 1st-2nd | 60 |
| F-4 | 2nd-3rd | 73 |
| F-5 | 2nd-3rd | 81 |
| F-6 | 3rd-4th | 93 |
| F-7 | 3rd-4th | 89 |
| F-8 | 4th-5th | 93 |
| F-9 | 4th-5th | 96 |
| F-10 | 4th-5th | 95 |

### Grade labels

`Pre-K`, `K`, `1st`, `2nd`, `3rd`, `K-3`, `K-1`, `1st-2nd`, `2nd-3rd`, `3rd-4th`, `4th-5th`.

### Grade start bands

Round the grade to the nearest integer. Below 1, or not a number, starts at D-PP. A saved `band`, including `sight.band`, or a `levelCode` that is a band id, wins over this map.

| Grade | Starts on |
|---|---|
| below 1, or not a number | D-PP |
| 1 | D-1 |
| 2 | D-2 |
| 3 | D-3 |
| 4 | F-6 |
| 5 and above | F-8 |

The last band repeats from its first word.

A correct spoken word and a miss both move to the next word. There is no retry. No answer for 20 seconds is a miss. The next word waits 2 seconds, or 2 seconds after the device finishes speaking the missed word.

The microphone listens only while a word is on the screen. Audio is not recorded and is not saved.

## level.sp

Spelling. The key is `sp`. The letters, timings, question bands, and spoken names are in `src/lib/vkole/spelling/data.json`. That file is the canonical copy. The website copies it byte for byte.

```json
{
  "id": "sp-ada",
  "name": "Ada",
  "enteredBy": "parent",
  "grade": 1,
  "step": 0,
  "band": "LK",
  "index": 0,
  "word": "lk-first",
  "earnedGrade": 1,
  "reached": 0,
  "missed": 0,
  "updatedAt": 0,
  "startingGrade": 1,
  "levelCode": "LK",
  "levelLabel": "Letter knowledge"
}
```

`band` is the list. During the letter phase, `index` is the letter: 0 is A and 25 is Z. `step` stays 0. `word` is the prompt id. `streak` is how many times the current letter has been met with silence. `missStreak` is the wrong-answer step: 0 is the letter question, 1 is the 3-letter cue, and 2 is the 5-letter cue. The grade number stays when the letter changes.

### Bands

`LK`, `LS`, `CVC`, `DOLCH`, `FRY`. Phase 1 fills letter knowledge. The later bands are in the file with no items until the owner specifies them. Empty bands are skipped.

| Band | Name | Grade label | Items now |
|---|---|---|---|
| LK | Letter knowledge | K | 77 |
| LS | Letter sounds | K | 0 |
| CVC | CVC words | K-1 | 0 |
| DOLCH | Dolch words | K-3 | 0 |
| FRY | Fry words | 1-5 | 0 |

Letter knowledge, in order: the first letter of the alphabet, the next letter through Z, what letter comes after each letter from A through Y (including X), then the name of each letter A through Z.

A new student starts at the first letter question. A saved `band`, or a `levelCode` that is a band id, wins. A saved band with no items yet falls back to letter knowledge.

Opening the engine plays the alphabet from A to Z, one letter every 1.5 seconds (26 letters, 39 seconds). Each letter is a different bright color on a changing background. The picture changes once every 1.5 seconds, which is slower than 3 changes per second. At the end, when the student is still on the first question, the engine says and shows: `Your turn! What is the first letter of the alphabet?`

A correct spoken answer shows a Happy Face for 2 seconds, then the next letter. The 5 second window is a maximum: a spoken answer is taken as soon as it is heard. The first 5 seconds of silence shows the same letter again. A second silence goes back 3 letters and continues from there. A wrong answer shows the 3 prior letters and speaks them, then waits up to 5 seconds. Another wrong answer or silence shows and speaks the 5 prior letters. One more wrong answer or silence starts again at A. A count that would pass A stops at A. The microphone listens only while a question is waiting for an answer. Audio is not recorded and is not saved. Adult override buttons are Correct and Miss.

At the end of a spelling sitting, the server writes a short parent report of 3 to 5 sentences. The section is labeled `Report written by Space XSI (Grok)`. The call uses `XAI_API_KEY` on the server, one call for that sitting, and sends only that student's letter stats. It does not send another family's name or any audio. If the key is missing or the call fails, the same section uses a local template. The report is shown to that parent and is included only in that account's progress email.

## level.pa

Phonemic awareness. The key is `pa`. The prompts, answers, `also` lists, phoneme sounds, and Elkonin box counts are in `src/lib/vkole/phonemic-awareness/data.json`, copied byte for byte from `docs/phonemic-awareness-website-canonical.json`.

```json
{
  "id": "pa-ada",
  "name": "Ada",
  "enteredBy": "parent",
  "grade": 1,
  "step": 0,
  "band": "WA",
  "index": 0,
  "word": "wa-cat-sat",
  "streak": 0,
  "missStreak": 0,
  "earnedGrade": 1,
  "reached": 0,
  "missed": 0,
  "updatedAt": 0,
  "startingGrade": 1,
  "levelCode": "WA",
  "levelLabel": "Pre-K"
}
```

`band` is the list. `index` is the item in that list. `step` stays 0. `word` is the item id. `streak` and `missStreak` are the running counts toward a band change. The grade number stays when the band changes.

### Bands

`WA`, `RH`, `SY`, `OR`, `IS`, `BL`, `PS`, `PD`. Each band has 8 items.

| Band | Name | Grade label |
|---|---|---|
| WA | Word awareness | Pre-K |
| RH | Rhyme recognition and production | K |
| SY | Syllable counting and blending | K |
| OR | Onset-rime | K |
| IS | First and final sound isolation | 1st |
| BL | Phoneme blending | 1st |
| PS | Phoneme segmentation | 1st |
| PD | Phoneme deletion and substitution | 2nd |

### Where a student starts

Age 4 and age 5 win over the grade. A saved `band`, or a `levelCode` that is a band id, wins over both.

| Placement | Starts on |
|---|---|
| age 4 | WA |
| age 5 | RH |
| grade 1 | IS |
| grade 2 and above | PD |

Two correct answers in a row move up one band. Two misses in a row move down one band. The first band does not move down. The last band does not move up. A miss or 20 seconds of silence speaks the `model` line, waits 2 seconds, and moves on. A correct answer is silent, then the next item after 2 seconds.

The microphone listens only while a prompt is waiting for an answer. Audio is not recorded and is not saved. The adult buttons are “They said it right” and “Not yet”.
