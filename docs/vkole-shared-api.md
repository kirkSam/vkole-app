# VKOLE shared account API

The school website is the account book. The app calls `https://www.dotheimpossible.ai/api/account/*` from its own server. No cookies. Sign-in and register return `{ token, expiresAt, family }`. Family reads and saves send `Authorization: Bearer`. The token lasts 12 hours. There is no refresh URL. A family response that includes `token` and `expiresAt` replaces the stored grant with no sign-in screen. Outside an engine, a 401 clears the stored token and returns the parent to sign-in. During an open engine, a 401 or an expired grant does not end the app session or the sitting; the local answer is kept and the next call tries the website again. The browser never sends `X-Vkole-Secret`. The account id is the lowercase parent email.

`POST /api/vkole/purge` on this app still accepts `X-Vkole-Secret` or a signed-in admin email. That header is not sent to the website.

| Path | Body |
|---|---|
| `POST /api/account/register` | `{ email, password, deviceId?, studentName? }` returns `{ token, expiresAt, family }`. The website sends the welcome email. |
| `POST /api/account/sign-in` | `{ email, password, deviceId? }` returns the same shape |
| `POST /api/account/forgot-password/send-code` | `{ email }` returns `{ message: "Code sent" }` |
| `POST /api/account/forgot-password/confirm` | `{ email, code, newPassword }` returns `{ message: "Password updated" }` |
| `POST /api/account/confirm-email/resend` | bearer token, body `{}` |
| `GET /api/account/family` | bearer token. `?studentIndex=N` selects that child. Omitting it reads student 1. Returns `{ family }` |
| `PATCH /api/account/family` | bearer token. A new child is `{ student: { name, startingGrade, age? } }`. `studentIndex` is sent for student 2 and later, and omitted for student 1. `startingGrade` is 1–12. `{ studentName }` alone is ignored. `{ student: { name } }` without a grade is refused: `Enter a starting grade from 1 to 12.` A third child on an ordinary account is refused: `This account already has 2 students. A third child needs a separate registration.` The master account has no cap. |
| `POST /api/account/family` | bearer token, `{ levels, clock, seenQuestions, studentIndex? }`, returns `{ family }` |

`deviceId` is one random UUID stored on the install. It is sent on register and sign-in and is never shown.

`family.students` is `[{ index, name, age, startingGrade }]`. `family.activeStudent` is the child this payload belongs to. `emailConfirmed`, `confirmationExpiresAt`, `freeWeekGranted`, and `lockReason` (`""`, `"confirm-email"`, `"payment"`) ride on the family. `lockReason` `"confirm-email"` locks the engines until the parent confirms. The free week is 168 hours and starts when the parent confirms the email. `"payment"` is the pay lock. A pilot login has `emailConfirmed: true` and `access: "open"`. Missing `emailConfirmed` stays confirmed so an older payload is not locked.

The same level object is returned at `family.levels.<engine>`, `family.level.<engine>`, and `family.progress.<engine>`:

```json
{"grade":3,"step":2,"earnedGrade":6,"working":{"grade":3,"step":2,"label":"Grade 3"},"earned":{"grade":6}}
```

`grade` and `step` are the working level. Questions use them. `step` is 0, 1, or 2. `earnedGrade` is the earned grade. This app sends `earnedGrade` on every write that knows it. If `earnedGrade` is missing, the stored earned grade stays. `earned.grade` is the fallback when reading. Correct and missed answers move the earned grade by the same grade step. Parent buttons change only the working level. The button says `Lower the working level. The earned level stays.` Spoken engines keep the working place on `levelCode`, `band`, `index`, and `word`. `earnedGrade` is still the grade number. `step` stays 0 for those engines.

Local climbs, seen prompts, the day clock, reports, and the family mirror are keyed by the account email plus `studentIndex`. Student 1 stays on the email. Student 2 uses that email with a `#student-2` suffix. The bearer token stays on the account row.

Level keys are `m`, `ela`, `ss`, `gen`, `sg`, `sw`, `pa`, `mg`, and `sp`. Alphabet progress is `levels.sp`. This app does not call `/api/vkole/password-reset`. Pressing Finished on any of the eight engines posts the session-end report so the website can email the parent. That post still happens when the sitting has no answers. Logout and idle still wait for at least one answer.

The account id is the email after trimming and lowercasing. Dots in the address stay. Register and sign-in both send that lowercase id. Sign-in tries the typed spelling only when the lowercase id is unknown.

The password is the typed password with trailing newlines removed. It is not trimmed and it is not lowercased. Register, sign-in, and password confirm all send that same value.

`VKOLE_MASTER_EMAIL`, or `kirksamalpha@dotheimpossible.ai` when that variable is empty, is never on a free week and never has to pay. Register, sign-in, and the family read for that email return `access: "open"` and do not send a finished free week.

A family save sends each engine object the app has, including alphabet on `sp` and a stored `mg` level when one was read. `seenQuestions` is the last 400 questions, `{ "prompt" }`, using the text the child saw. The website builds the practice-sheet key from that text. `clock.seconds` is that student's day clock. `clock.limit` is the cap in seconds when the website sends one. When it is missing, the cap is 8 hours (28800 seconds). The clock is shared by that student's engines and resets at midnight Pacific.

Errors are JSON `{ "error": "..." }` and are shown as sent. Those sentences include `No account for this email`, `Invalid email or password`, `Account already exists`, and token errors.

## Engine keys

`m`, `ela`, `ss`, `gen`, `sg`, `sw`, `sp`, `pa`. The website also stores `mg`. This app keeps that level and sends it back. It does not add an engine screen for it.

`m`, `ela`, `ss`, and `gen` store the shared level object: working `grade` 1–12 and `step` 0, 1, or 2, plus `earnedGrade`, `working`, and `earned`.

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

Alphabet. The key is `sp`. The letters, timings, question bands, and spoken names are in `src/lib/vkole/spelling/data.json`. That file is the canonical copy. The website copies it byte for byte.

The engine still tracks letter knowledge internally as band `LK` and a prompt id such as `lk-next-m`. A family save does not send that shape. The website drops an unknown band, refuses a grade outside 1-12, and keeps a word only when it is lowercase letters with at most one apostrophe. Alphabet progress is therefore saved as band `cvc` and `word` set to the current letter.

```json
{
  "id": "sp-ada",
  "name": "Ada",
  "enteredBy": "parent",
  "grade": 1,
  "step": 0,
  "band": "cvc",
  "index": 12,
  "word": "m",
  "streak": 1,
  "missStreak": 2,
  "earnedGrade": 1,
  "reached": 0,
  "missed": 0,
  "updatedAt": 0,
  "startingGrade": 1,
  "levelCode": "cvc",
  "levelLabel": "Letter knowledge"
}
```

`band` on the wire is `cvc` for the alphabet stage. The website's other kept bands are `blends`, `vowels`, `patterns`, and `affixes`. `word` is the answer letter, `a` through `z`. `index` is the item in letter knowledge, 0 through 78. A one-letter `word` with no `index` still means A through Z in exercise 2, where 0 is A and 25 is Z. `step` stays 0. `streak` is how many times the current letter has been met with silence. `missStreak` is the wrong-answer step: 0 is the letter question and 1 is the 3-letter cue. The grade number stays when the letter changes, and it is always sent as an integer from 1 to 12. A read of band `cvc` plus a one-letter `word` and no index restores that letter in exercise 2. An explicit `index` restores that card, including exercise 3, 4, or 5. An old memory place (index 51 through 76, an id such as `lk-name-m`, or the prompt `What letter is this?`) is read as exercise 4. `streak` and `missStreak` restore a cue that was already showing.

### Bands

`LK`, `LS`, `CVC`, `DOLCH`, `FRY`. Phase 1 fills letter knowledge. The later bands are in the file with no items until the owner specifies them. Empty bands are skipped.

| Band | Name | Grade label | Items now |
|---|---|---|---|
| LK | Letter knowledge | K | 79 |
| LS | Letter sounds | K | 0 |
| CVC | CVC words | K-1 | 0 |
| DOLCH | Dolch words | K-3 | 0 |
| FRY | Fry words | 1-5 | 0 |

Letter knowledge has six exercises. Exercise 1 is the alphabet song and has no card. Exercise 2 shows each capital letter and waits for the student to say it. Exercise 3 shows each small letter and waits for the student to say it. Exercise 4 shows no letter until the correct answer, then shows the capital and the small letter together, such as `A a`. Exercise 5 says `Your turn to say the alphabet.` and listens through A to Z. At Z the app says and shows `Good job!`, then a 5 second celebration. Exercise 6 shows each capital letter to type, A through Z, then each small letter, a through z. A capital card accepts only the capital key. A small-letter card accepts only the small key. The same letter in the other case stays on that letter and says and shows `Use a capital letter. Hold Shift or press Caps Lock.` when a capital is needed, or `Use a small letter. Let go of Shift or turn off Caps Lock.` when a small letter is needed. A different letter, or 5 seconds with no correct key, says and shows `Try again` and stays on that letter. The typing box turns off phone auto-capitalize, autocorrect, and spellcheck. The sitting ends after lowercase z.

A new student starts at the first letter question. Inside the engine, a saved `band`, or a `levelCode` that is one of those band ids, wins. A saved band with no items yet falls back to letter knowledge. The family save still writes that letter as `band: "cvc"` and `word` set to the lowercase letter.

Opening the engine always starts at exercise 1 and continues through exercises 2, 3, 4, 5, and 6 in order. A saved letter does not skip ahead. Exercise 1 is the song: one letter every 1.5 seconds (26 letters, 39 seconds). Each letter is a different bright color on a changing background. The picture changes once every 1.5 seconds, which is slower than 3 changes per second. Exercises 2, 3, and 4 wait for a spoken answer on every letter. The microphone opens after the prompt finishes. Exercise 2 shows a capital letter. Exercise 3 shows a small letter. Exercise 4 shows no letter until the correct answer, then shows both letters together. After exercise 4, exercise 5 asks the student to say the alphabet, then says `Good job!` and celebrates for 5 seconds. Exercise 6 then asks the student to type each capital letter and then each small letter. Six buttons labeled 1, 2, 3, 4, 5, and 6 sit above the letter. A button starts at that exercise and continues through exercise 6. Another button starts again from the exercise on the button. The song never opens a blank card that asks `What letter is this?`

Exercise 1 does not wait for an answer. Exercises 2, 3, and 4 wait for a spoken answer on every letter, and the microphone opens after the prompt finishes. Exercise 5 listens for the spoken alphabet and does not use the 5 second letter timer. Exercise 6 waits up to 5 seconds for the correct key, then says and shows `Try again` on that same letter. A finished exercise is saved in `alphabet_completed`, including exercise 6. Audio is not recorded and is not saved. Adult override buttons are Correct and Miss.

At the end of an alphabet sitting, the server writes a short parent report of 3 to 5 sentences. The section is labeled `Report written by Space XSI (Grok)`. The call uses `XAI_API_KEY` on the server, one call for that sitting, and sends only that student's letter stats. It does not send another family's name or any audio. If the key is missing or the call fails, the same section uses a local template. The report is shown to that parent and is included only in that account's progress email.

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

`band` is the level. `index` is the item in that level. `step` stays 0. `word` is the item id. `streak` and `missStreak` are the running counts toward a level change. The grade number stays when the level changes.

### Levels

There are 88 levels and 526 items. `WA`, `RH`, `SY`, and `OR` come first (8 items each). Then one level per phoneme pattern: simple consonants, short vowels, consonant digraphs, two-letter blends, three-letter blends, vowel teams, and r-controlled vowels. Most of those levels have 6 items (isolation, blending, and segmenting for each word). Four vowel-team levels have 3 items. `PD` is last and has 8 items.

A saved `band` or `levelCode` of `IS`, `BL`, or `PS` from the earlier list maps on read to the first consonant level (`c-b`), the first two-letter blend (`b-bl`), and the first vowel team (`w-ai`). The write body keeps the code it was given.

### Where a student starts

Age 4 and age 5 win over the grade. A saved `band`, or a `levelCode` that is a level id, wins over both.

| Placement | Starts on |
|---|---|
| age 4 | WA |
| age 5 | RH |
| grade 1 | c-b (first consonant) |
| grade 2 and above | PD |

Two correct answers in a row move up one level. Two misses in a row move down one level. The first level does not move down. The last level does not move up. Every item in a level is used before the index wraps, including a level with 3 items. `roundSize` is the website review window and does not shorten that cycle. A miss or 20 seconds of silence speaks the `model` line, waits 2 seconds, and moves on. A correct answer is silent, then the next item after 2 seconds.

The microphone listens only while a prompt is waiting for an answer, and it stays off while the prompt or the model is spoken. Audio is not recorded and is not saved. Speech recognition scores the utterance against the answer, the `also` list, and the phoneme variants. There is no adult button.
