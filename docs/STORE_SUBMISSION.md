# Store submission checklist

Updated 28 November 2026 from the app on main, after pull request 88. The October 13 draft lived on pull request 1, which was closed and not merged. Do not use that draft. It described a different app: an offline worksheet shell in `mobile/`, with no account.

This file is notes for Sam. It does not submit anything.

## Names are not final

The store name, subtitle, and icon words are pending. The code currently shows these strings. They are not a decision to print on the store.

| Where | What the code says now |
| --- | --- |
| Home-screen name | VKOLE (`capacitor.config.ts` and `android/app/src/main/res/values/strings.xml`) |
| Longer name in letters | VKOLE/ZPD Learning Engine (`src/lib/brand.ts`) |
| School | Do the Impossible Alpha Academy |
| Application id | `com.dotheimpossible.vkole` |

The application id is a placeholder. `capacitor.config.ts` says to confirm it before the first real submission, then leave it alone. Changing it later starts a new store listing.

Privacy page the app links to: https://www.dotheimpossible.ai/privacy

Support address in the app: kirksam.alpha@dotheimpossible.ai

## What a family can do

A parent signs in. An account holds at most two children. Each child is a button with a first name. An empty place asks for a first name, age, and starting grade.

The engines are Mathematics, English language arts, History and social studies, General, Singapore mathematics, Sight Words, Alphabet, and Phonemic Awareness.

Sight Words, Alphabet, and Phonemic Awareness can be answered out loud. Mathematics and English language arts are typed. A parent can mark an answer when voice is off.

Progress is saved on the server. This is not an offline worksheet app.

## Permissions

From `android/app/src/main/AndroidManifest.xml`:

- `android.permission.INTERNET` — sign-in, practice, and mail.
- `android.permission.RECORD_AUDIO` — the microphone, only while a spoken answer is waiting, and only after the parent has allowed voice answers.
- `android.permission.MODIFY_AUDIO_SETTINGS` — the short chime before the microphone opens.

There is no location, contacts, photos, advertising id, or analytics SDK in this app.

## Voice consent

The parent sees this once, for the whole account. The child never sees it. The wording version is `v2` in `src/lib/voice-consent.ts`. Do not shorten it on the store form. The Play Console answers are already drafted in `docs/play-data-safety-voice.md`.

> Some VKOLE engines let your child answer out loud. When your child answers, the microphone listens for a few seconds, turns the answer into text, and then stops. VKOLE does not record or save your child's voice. On newer Android phones, this happens on the phone. In a web browser and on older Android phones, Google's speech service turns the answer into text. Google's privacy policy covers that step, and Google may keep the audio if your Google account saves voice activity. You can turn voice answers off at any time. If voice answers are off, an adult marks each answer.

"Not now" leaves voice off. The engines still work. An adult marks each answer.

## Families programs

Do not enroll in Google Play's Designed for Families program or Apple's Kids category until Sam says so.

A child's first name is stored. Some answers are graded by xAI. On Android 12 and in a browser, a short listen can go to Google's speech service. Those facts are why the October note said to stay out. That choice is still pending. It is not a new decision.

## Pictures

- `docs/store/icon-1024.png` is 1024 by 1024. It has no words.
- `docs/store/feature-graphic.png` is 1024 by 500. It is an October draft. The words are cut off ("DO THE IMPOSSIE") and the name is the old one. Do not upload it. Replace it after the store name is chosen.

Screenshots still have to be taken on a phone: Who is practicing, one sight word, one math question, and the voice-answers screen.

## What this app does not sell inside the store binary

There is no purchase SDK in this project. Do not add a link from the app to a card form for the digital lessons. If a price is sold inside the app later, it has to use the store's own billing.

## Review notes you can paste, after the name is chosen

This is a parent's education app. The parent signs in. Up to two children practice. Sight words, letters, and phonemic prompts can be spoken after the parent allows voice answers. The app does not record or save the voice. Newer Android phones turn speech into text on the phone. Older phones and a browser use Google's speech service, which the consent screen names. There are no ads. Voice can be left off, and an adult marks the answers.
