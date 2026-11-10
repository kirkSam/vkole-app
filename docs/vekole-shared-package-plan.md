# Shared VEKOLE engine package — app Builder proposal

Update 4 says yes to one shared copy of the rules. This is the plan.
It is not the build. School Site still has to agree, and Sam still has
to say go. Until then, no package is created and no engine is changed.

The voice work stays first. App pull request #70 is open and not merged.
Website pull request #99 has to be live before a phone test of listening.

## How it is shared

A third repository, `kirkSam/vekole-engine`. Not a folder inside the app.
Not a folder inside the website. The Nov 4 memo already said not to move
the app into the website repo.

Both sides install that repository at one exact git tag, for example
`v0.1.0`. Neither side points at a branch. A change is a pull request on
`vekole-engine`, then both sides move to the same new tag in the same
check. Claude checks both pins. There is no second copy of the rules.

Do not publish it to the public npm registry for this first version.
A private GitHub tag is enough, and it keeps one version number.

## What the package is

Plain TypeScript. No React, no database, no network, no account, no
child name, no email. It does not save anything. Each side keeps its
own memory records and passes them in.

One settings file holds every number from Update 4:

- starting strength 4.5 days
- due threshold 0.80
- review multiplier 2.5
- spacing bonus 2
- miss factor 0.4
- minimum strength 1.0 day
- re-check after 10 minutes or 8 items
- reviews at most 1 in every 4 items, and at most 10 per session
- fatigue at 1.8 times the previous pace, after 5 answers
- 3 misses in a row also means fatigue is high
- 3 answers at a normal pace clear it

## What the package decides

Memory only. An item is a word, a phonemic prompt, a letter, or a
standard or step. The caller names the item. The record is strength S,
last practiced, review count, and miss count.

- First correct answer creates S = 4.5, reviews = 0, misses = 0.
- R = e^(-t/S). Due when R is below 0.80.
- Same-session re-check once, after 10 minutes or 8 other items,
  whichever comes first. Skip it if the session ends first.
- On-time correct review multiplies S by 2.5. A later-than-due correct
  review multiplies by 2.5 plus 2 times how far R fell below 0.80.
- A miss uses the engine's own miss rule first (speak, show). Then
  S = max(1.0, S x 0.4).
- The most faded due item (lowest R) is the next review.
- A review is offered only when it would still be at most 1 of every 4
  items served, and only while this session has served fewer than 10
  reviews.
- A re-check counts as an item served. It is not a review.

Fatigue uses this session's answer times only. Nothing about a
diagnosis is accepted or stored.

- It cannot turn on before 5 answers.
- High when this answer is slower than 1.8 times the average of the
  earlier answers, not counting this one, or when there are 3 misses
  in a row.
- An answer is at a normal pace when it is not slower than that 1.8
  line. Three of those in a row clear High. This reading is an
  assumption. A miss at a normal pace counts toward clearing.
- While High, the package refuses re-checks and reviews.
- While High, it may say "step the level down one step early" only for
  an engine that already has a step-down rule. Sight Words always gets
  no. Alphabet always gets no, and keeps its own step-back rules.

## The golden rule

The package never returns a new growth level. Reviews and re-checks
change memory strength only. The engine applies its own miss and
step-down rules. A test feeds a review result into a fake level and
asserts the level did not move.

## The schedule test

The formula wins. The printed table is the on-time path with no
same-session re-check (the session ended first, so the re-check was
skipped). Starting at S = 4.5, the due gaps are about:

1.00 day, 2.51 days, 6.28 days, 15.7 days, 39.2 days.

That is the memo's "about 1, 2.5, 6, 16, 40."

If the same-session re-check was correct, S is multiplied by 1.2 first.
The first review is then about 1.20 days, which is still "about one
day." Later gaps are 1.2 times the table above. The test will lock both
paths so the two sides cannot pick different ones.

## What parents read

Same words on both sides. Only when the count is greater than 0:

"Due for review today: N"

In the session report:

"Reviewed today: N. Remembered: M."

School Site should use these sentences or send a replacement before the
build. Do not paraphrase them on one side only.

## What the package must not do

- No AI call, and no question served to a child by a model.
- No statistics service. No record leaves the side that taught the child.
- No field for a disability, a diagnosis, or a trait.
- No function that posts memory to the other side.

The app test, when this is connected later, must show the family save
still has no memory strength in it. The website test must show the same.

## Order

1. Finish voice consent and Android listening. Do not merge those until
   Sam has tested the Android 12 phone and Claude has checked both.
2. School Site agrees to this plan, or sends a change. Sam says go.
3. Build the package. Connect both sides at the same tag. Claude checks.
   Sam tests on his phone.
4. The VEKOLE name sweep on both sides.
5. Google Play only with Sam's OK, under the app id below.

## Android app id (decided only by Sam)

`applicationId` is `com.dotheimpossible.vkole`.
The Capacitor app id is the same string.
`versionCode` is 1. Nothing from this project has been submitted to
Google Play.

Recommendation: keep `com.dotheimpossible.vkole`.

The name parents see can become VEKOLE later. Play does not use this id
as the title. Changing the id after the first submission makes Play
treat VEKOLE as a brand-new app. Changing it before submission is still
possible, but the phone would then see the next build as a different
app from the one already installed for testing.

If Sam wants the id itself to say vekole, that has to be decided before
the first submission.
