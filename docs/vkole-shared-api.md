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

A write replaces each engine object that is sent. Engines that are omitted are not part of this app's write. The app sends every engine it has on the device.

`seen` is the last 400 questions, `{ "key", "text" }`. `clockSeconds` is the shared day clock, capped at 2.5 hours.

## Engine keys

`m`, `ela`, `ss`, `gen`, `sg`, `sw`.

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
  "band": "D-PP",
  "index": 0,
  "word": "a",
  "earnedGrade": 1,
  "reached": 0,
  "missed": 0,
  "updatedAt": 0,
  "startingGrade": 1,
  "levelCode": "D-PP",
  "levelLabel": "Dolch pre-primer"
}
```

`band` is the list. `index` is the word in that list. `step` stays 0. The position is `index`, not `step`. `word` is the word now showing.

### Bands

`D-PP`, `D-P`, `D-1`, `D-2`, `D-3`, `D-N`, `F-1`, `F-2`, `F-3`, `F-4`, `F-5`, `F-6`, `F-7`, `F-8`, `F-9`, `F-10`.

| Band | Label | Words |
|---|---|---|
| D-PP | Dolch pre-primer | 40 |
| D-P | Dolch primer | 52 |
| D-1 | Dolch grade 1 | 41 |
| D-2 | Dolch grade 2 | 46 |
| D-3 | Dolch grade 3 | 41 |
| D-N | Dolch nouns | 95 |
| F-1 … F-10 | Fry 1-100 through Fry 901-1000 | 100 each |

### Grade labels

`Grade 1` through `Grade 12`.

### Grade start bands

| Grade | Starts on |
|---|---|
| 1 | D-PP |
| 2 | D-1 |
| 3 | D-2 |
| 4 | D-3 |
| 5 | D-N |
| 6 | F-1 |
| 7 | F-2 |
| 8 | F-3 |
| 9 | F-4 |
| 10 | F-5 |
| 11 | F-6 |
| 12 | F-7 |

A student who starts lower climbs through the bands in between. F-8, F-9, and F-10 stay on grade 12. The last band repeats from its first word.

A correct spoken word and a miss both move to the next word. There is no retry. No answer for 20 seconds is a miss. The next word waits 2 seconds, or 2 seconds after the device finishes speaking the missed word.

The microphone listens only while a word is on the screen. Audio is not recorded and is not saved.
