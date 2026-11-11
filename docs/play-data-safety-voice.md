# Google Play Data safety — voice answers

Sam enters these in the Play Console. The app cannot submit them. Claude checks the words against the privacy page before either goes live.

The sentences below are the same words as the parent consent screen. Do not shorten them on the privacy page or in the store listing.

**Voice answers**

Some VKOLE engines let your child answer out loud. When your child answers, the microphone listens for a few seconds, turns the answer into text, and then stops. VKOLE does not record or save your child's voice. On newer Android phones, this happens on the phone. In a web browser and on older Android phones, Google's speech service turns the answer into text. Google's privacy policy covers that step, and Google may keep the audio if your Google account saves voice activity. You can turn voice answers off at any time. If voice answers are off, an adult marks each answer.

On the three microphone engines, the card also says: "Listening works best on Android 13 or newer."

If voice answers are off or have not been answered: "A parent needs to turn on voice answers. Until then, an adult marks each answer."

If the parent allowed voice answers but this phone cannot hear the student: "This phone cannot hear the student. Android 13 or newer lets the app hear the student. An adult evaluates and marks each answer."

## What the app actually does

- The parent agrees once, for the whole account. The child never sees that question.
- "Not now" is a decline. It is not "still asking."
- The microphone starts only while a word or prompt is waiting, and only when voice answers are On.
- Android still asks its own microphone question once per phone. That is `RECORD_AUDIO`.
- Android 13 or newer, with the English on-device speech pack: the sound becomes text on the phone. It is not sent to Google.
- Android 12, a phone without that pack, and a web browser: after the parent allows it, Google's speech service turns the short listen into text. VKOLE does not receive the sound and does not save it.
- If voice answers are off, or have not been answered, the microphone does not start and no audio is sent.
- Speaking a word or a letter uses the phone's own text-to-speech. That is not a recording.
- VKOLE does not use the voice for ads, marketing, analytics, or tracking.

## Answers to type

Data type: **Audio — Voice or sound recordings** ("A user's voice such as a voicemail or a sound recording").

| Play Console question | Answer to enter |
|---|---|
| Does the app collect or share any of the required user data types? | Yes. See "Sam decides" below. This build does send a short listen off the phone on Android 12. |
| Is all of the user data collected by your app encrypted in transit? | Yes. When a listen leaves the phone, it goes over the phone's encrypted connection to Google's speech service. VKOLE's server never receives the sound. |
| Collected? | Yes for this app, because some phones send the short listen off the device. On Android 13+ with the English pack, that listen stays on the phone. The form is one answer for the whole app. |
| Shared? | See "Sam decides." VKOLE does not send the sound to its own server, to advertisers, or to an analytics tool. |
| Processed ephemerally? | Yes on VKOLE's side. The listen is held only long enough to turn a few seconds of speech into text, then it stops. It is not recorded and it is not saved. See "Sam decides" for Google's side. |
| Optional or required? | Optional. A parent can choose "Not now" or turn voice answers off, and the engines still work. An adult marks each answer. |
| Purpose | App functionality. Not advertising or marketing. Not analytics. Not account management. Not personalization. Not fraud prevention, security, and compliance. Not developer communications. |

Microphone permission (the separate permissions declaration, not the data type):

- Permission: Microphone (`android.permission.RECORD_AUDIO`).
- Why: so a child can answer a sight word, a phonemic prompt, or a letter out loud.
- When: only while that word or prompt is waiting, and only after the parent has allowed voice answers.
- The sound is not recorded or saved by VKOLE.

## Sam decides — these are Google's definitions

Google's Data safety help (Play Console Help, "Provide information for Google Play's Data safety section," updated December 5, 2023) uses these meanings. They are stricter than "we do not save it."

1. **Collected** means transmitting data from the app off the user's device, including by a library or SDK, whether it goes to you or to a third party. A listen that stays on an Android 13 phone is not collected. A listen that Android's speech recognizer sends to Google's speech service **is** collected, even though VKOLE never stores the file. This app does that on Android 12 after the parent allows voice answers, so the form should say the audio type is collected. Confirm that before you submit.

2. **Ephemeral** means the data is only stored in memory and kept no longer than the real-time request. You still include it on the form. If it meets that standard, Play does not show it on the public Data safety section. VKOLE meets that standard: we do not record or save the voice. **Google's speech service may not.** If the family's Google account has Voice & Audio Activity on, Google may keep that audio for its own speech models. That is Google's product, not ours. If you cannot say Google discards it immediately, do not mark the Google path as ephemeral. You can still say VKOLE does not store it.

3. **Shared** means transferring collected data to a third party. A **service provider** that processes data only on your behalf and on your instructions is not sharing. Google is a third party to this app. If Google's speech service only turns the short listen into text for this request, you can answer "not shared." If Google uses that audio for its own purposes, Google's definition calls it shared. VKOLE has no switch for that. Decide this in the Play Console. Do not answer "not shared" unless you have accepted that Google-side use.

4. **Optional** is allowed only if every user, on every device, can use the app without providing the data. Voice answers meet that: Off and "Not now" leave Correct and Miss working. The rest of the account (email, password, payment) is a different data type and is not covered by this draft.

Nothing else on the existing Data safety form is changed by this note. Do not mark the voice as sold. Do not mark it as used for ads.
