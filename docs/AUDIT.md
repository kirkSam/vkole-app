# Audit of this app

Updated 28 November 2026 from the files on main, after pull request 88. The October 13 audit described a separate offline app in `mobile/` and a website this repository could not read. That branch was closed and not merged. This note replaces it. It does not describe the website's later pages except where this app links to them.

## What this repository is

The store app and the practice screens are this repository. Capacitor wraps the built screens. The Android project is `android/`, not a second app in `mobile/`.

The home-screen string is VKOLE. The longer string in letters is VKOLE/ZPD Learning Engine. The school name in the code is Do the Impossible Alpha Academy. The store listing name is not chosen yet.

The application id `com.dotheimpossible.vkole` is a placeholder until the first submission.

## What a family can do

A parent signs in. The account holds at most two children. The child is chosen from a button. An empty place asks for a first name, age, and starting grade.

Engines: Mathematics, English language arts, History and social studies, General, Singapore mathematics, Sight Words, Alphabet, and Phonemic Awareness.

Two correct answers move one step. Two misses move down one step. Sight Words also bring a missed word back later in the same sitting. That rule is in the shared package `@kirkpatrick/vekole-engine`, tag v0.2.5.

## What it connects to

- The database, when `DATABASE_URL` is set. Progress, the child, and the sitting are stored there. Without that address the app falls back to a local database for development only.
- xAI at `https://api.x.ai/v1/chat/completions`, model `grok-4.3`, when a question has no answer of its own or when the alphabet parent report is written. The model name is `GROK_MODEL` in `src/lib/grok-model.ts`. The call does not send the child's name.
- Gmail, for a finished-sitting note and a sign-out note to the parent's address.
- The website at https://www.dotheimpossible.ai for the privacy link.

There is no advertising SDK and no purchase SDK in `package.json`.

## Microphone

Permissions in `android/app/src/main/AndroidManifest.xml`: internet, microphone, and audio settings for the chime.

The parent allows voice answers once. The exact sentences are in `src/lib/voice-consent.ts` and in `docs/play-data-safety-voice.md`. The child does not see that screen. The microphone listens only while a word, a letter, or a phonemic prompt is waiting. VKOLE does not record or save the sound. Android 13 and newer can turn it into text on the phone. Android 12 and a browser use Google's speech service after the parent allows it.

Phonemic Awareness keeps listening across short pauses. Three seconds of quiet, or the end of 20 seconds, judges the answer. A full answer is accepted as soon as it is heard.

## What the October draft got wrong

It said the phone app had no account, kept worksheets only on the device, and opened the school in a browser after a parent gate. This app signs in, stores progress on the server, and the practice screens are the app. Do not answer a store form from the October draft.
