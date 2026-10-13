# Store submission checklist

The app to upload is the Capacitor project in `mobile/`. The bundle id is `ai.dotheimpossible.vkole`. The name on the home screen is "Do the Impossible".

The privacy answers below follow `mobile/src/privacy/inventory.ts`. A test fails if this file drops one of those ids.

## Accounts only the owner can buy

- Apple Developer Program, 99 USD a year, in the name of the person or organization that will appear on the store.
- Google Play Console, a one-time 25 USD registration.
- A Mac, for the iOS archive. This repository can generate the Xcode project. It cannot compile it on Linux.
- App Store Connect and Play Console access for the same bundle id.

No signing key, store password, or API key belongs in git.

## Identity to type into both stores

| Field | Value |
| --- | --- |
| App name | Do the Impossible |
| Subtitle / short description | VKOLE practice, plus the school office |
| Bundle id / application id | ai.dotheimpossible.vkole |
| Category | Education |
| Privacy policy URL | https://www.dotheimpossible.ai/privacy |
| Support URL | https://www.dotheimpossible.ai/contact |
| Support email | kirksam.alpha@dotheimpossible.ai |
| Marketing URL | https://www.dotheimpossible.ai |
| Copyright | 2026, the school owner's legal name |

Add this paragraph to the website privacy page before review, so the public policy mentions the app. The in-app page already says it.

> The iPhone and Android app named Do the Impossible stores practice scores, a practice timer, and an optional reminder on the device. It does not show ads. It does not send those practice scores to the school. Opening the school from the app uses this same website.

## What this build collects

On the device, not sent by this app:

- `device-practice` — subject, grade, standard, and how many answers were correct. Used to show the next offline worksheet.
- `device-timer` — seconds of practice used today. Used to stop at two and a half hours and open again at midnight Pacific.
- `device-reminder` — whether a daily reminder is on, and the hour and minute. The notification is scheduled on the phone. There is no push token and no child's name in the text.

Not collected by this app: advertising id, location, contacts, photos, third-party analytics.

This build does not call the store billing SDK, because the RevenueCat keys in `mobile/.env.example` are empty. Nothing is charged. If a key is added later, the price comes from Apple or Google, and the nutrition labels have to be updated to include purchases.

## If a parent opens the school site from the app

The button opens https://www.dotheimpossible.ai in the system browser sheet, after a parent gate. The website's own privacy page, read on 13 October 2026, describes this collection. Declare it if the reviewer treats that browser sheet as part of the app. Safer to declare it.

- `school-site-email` — parent email.
- `school-site-password-hash` — a hash of the registration password, not the password.
- `school-site-student-name` — student first name.
- `school-site-progress` — starting grade, level, missed work, questions already given, daily office timer.
- `school-site-xai` — subject, grade, question, and the student's answer, sent to Space x.AI when the site grades a question.
- `school-site-mail` — a finished sitting emailed to the registration address.
- `school-site-stripe` — card payment on Stripe. The site says the school never sees the card number. This app does not link to the pay page.
- `school-site-meeting` — parent name, email, student name, date, and time for a scheduled meeting.

The website says it does not sell information, does not show ads, and does not use a tracking pixel.

## Apple privacy nutrition label

For data the app itself writes:

- Data not linked to identity: Product Interaction (practice progress and the on-device timer). The reminder time is a setting, not an identifier. Do not mark advertising id, location, contacts, or photos as collected by the shell.
- Data not linked to identity: nothing else from the shell. The reminder time is a setting, not an identifier.

For the school site, if you declare it:

- Contact Info: email address, name. Linked to the user. App functionality.
- Identifiers: user id if the school account has one. Linked. App functionality.
- Purchases: only if the website checkout is considered part of the app. The shell does not offer that checkout.
- User Content: student answers, when the site sends them to Space x.AI. Linked. App functionality.
- Do not check Advertising Data, Location, Contacts, or Browsing History for the shell.

Tracking: No. The shell has no tracking SDK. Do not check "used to track."

## Google Play Data safety

- Does the app collect or share any of the required user data types? For the shell alone, the practice data stays on device. Google still asks you to say whether it is collected. Collected means transmitted off the device. The shell does not transmit practice, the timer, or the reminder. Answer "no" for those three.
- If the in-app browser is in the declaration, answer "yes" for name, email, and app activity (answers and grades), shared with the school host and, for a graded answer, with the xAI API the site already uses. Purpose: app functionality. Not sold. Not used for ads.
- Data is encrypted in transit (HTTPS).
- Users can ask for deletion. The app has Delete account data. It erases the device. The school record is closed by the email the privacy page already uses. The app copies that note and does not send it.
- No ads.

## Age rating and the Kids category

Do not enroll this app in Apple's Kids category or Google's Designed for Families program.

The school site, which a parent can open, collects a child's first name and sends answers to Space x.AI. Kids-category rules do not allow that kind of third-party sharing. The offline worksheets are for a parent and a child together. Set a 4+ age rating, say that the app is educational, and say there is no unrestricted web browsing, no violence, and no user-generated public content. There is a parental gate before the school site, before sharing a score, and before a purchase.

Unrestricted web access: the shell only builds links to `www.dotheimpossible.ai` and `dotheimpossible.ai`. Say that in the review notes. The site itself can link onward. That is a review risk. See below.

## Purchases

Product ids, with no prices, are in `mobile/src/billing/products.ts`:

- `vkole_engine_monthly`
- `vkole_engine_yearly`

Create those ids in App Store Connect and Play Console, or change the file to the ids you create. Create the products as auto-renewable subscriptions if that is the plan you want. Put the RevenueCat public SDK key for each store in the environment, not in git:

- `VITE_REVENUECAT_ANDROID_API_KEY`
- `VITE_REVENUECAT_IOS_API_KEY`

Leave them empty for a build that cannot charge. The purchase buttons stay disabled and no price is rendered.

Digital access to the engine, if it is sold inside the app, has to use StoreKit and Google Play Billing. Do not add a link to the website's Stripe checkout. Live teaching may be a real-world service, but a link from this app to a Stripe page for a digital plan is a likely rejection under Apple guideline 3.1.1.

## Screenshots to make on a device

Apple, iPhone 6.7-inch (required) and 6.5-inch if Connect still asks:

1. Home, with the timer and the four-subject practice.
2. An offline worksheet question.
3. The reminder screen.
4. Privacy.
5. The parent gate on the school button.

iPad screenshots too, if the target stays iPhone and iPad. The generated project includes both.

Google Play:

- At least two phone screenshots, the same screens.
- Feature graphic, 1024 by 500: `docs/store/feature-graphic.png`
- App icon, 1024: `docs/store/icon-1024.png`
- A short description and a full description that say practice works offline and the school office is the website.

## Review notes you can paste

This is a parent's education app for the school at https://www.dotheimpossible.ai. The app itself has offline worksheets, a two-and-a-half-hour practice timer, and a local daily reminder. It does not create an account. Delete account data erases practice, the timer, and the reminder on the device, then shows the note the parent emails to close the school record. The school site opens only after a parent answers 17 × 4 − 8 and types the word parent. There are no ads and no third-party analytics. Purchases are not enabled in this build. The demo needs no login. Open Practice, start a worksheet, and use Remind. Sample offices on the website, if you open School, are the school's public sample.

## Deep links the website must host

The app is ready for these links. They will not open the app until the website serves the files and the signing ids are filled in.

- `https://www.dotheimpossible.ai/.well-known/apple-app-site-association`
- `https://dotheimpossible.ai/.well-known/apple-app-site-association`
- `https://www.dotheimpossible.ai/.well-known/assetlinks.json`
- `https://dotheimpossible.ai/.well-known/assetlinks.json`

Copies to edit are in `docs/well-known/`. Replace `TEAMID` with the Apple Team ID. Replace the Android fingerprint with the Play app-signing SHA-256. The custom scheme `vkole://www.dotheimpossible.ai/home` works without those files.

This repository is not the website. Uploading the files is a change in the school site project.

## Signing and upload

Android, on a machine with the Android SDK:

```bash
cd mobile
npm install
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

A debug APK is not what you upload. For Play, create an upload keystore on your own computer, keep it private, and build `bundleRelease`. Turn on Play App Signing. Never commit the keystore.

iOS, on a Mac:

```bash
cd mobile
npm install
npm run build
npx cap sync ios
npx cap open ios
```

In Xcode, set the team, the bundle id, and the associated domain `applinks:www.dotheimpossible.ai` plus `applinks:dotheimpossible.ai`. Archive and upload with Xcode or Transporter. A Linux build cannot do this step.

## Before you tap Submit

- Privacy policy URL opens on the public site, and the new paragraph is on it.
- The app icon is the school mark, not the Capacitor placeholder. Run `npm run icons --prefix mobile` and `npx @capacitor/assets generate --assetPath assets --ios --android` inside `mobile/` after the native projects exist.
- Sign-in on the school site still works in the browser sheet.
- A worksheet still opens in airplane mode.
- Delete account data clears the worksheet after the parent gate.
- The build you upload has empty RevenueCat keys, unless the products are live and the nutrition label mentions purchases.
- No `.env` file is in the archive.

## Risks a reviewer can still reject

- Guideline 4.2, minimum functionality. The offline worksheets, reminder, timer, and share sheet are the native part. If the review build is switched to a remote `server.url`, that protection is gone.
- Guideline 3.1.1. A link to Stripe for the digital engine is a likely rejection. This app does not include that link. Do not add one.
- Kids category. Do not opt in while the school site collects a child's name and sends answers to xAI.
- The school site can navigate to other sites. A reviewer who opens it may call that unrestricted web access. The parent gate is there for that reason. If review complains, remove the School button and keep the offline app only.
- Account deletion. Apple requires in-app deletion when the app creates accounts. This app does not create the school account. The device wipe is in the app. The school record is closed by the same email the website already asks for, because this app cannot see that account. If you later add sign-in inside the app, the same button has to delete the server account too.
- The website and this repository are two copies of the engine. A rule fixed on the site will not change the offline worksheets until this app is updated.
- Associated domains fail until the well-known files and the real team id are on the website. The app still runs without them.
- Export compliance. The iOS project sets `ITSAppUsesNonExemptEncryption` to false because the app only uses ordinary HTTPS. Confirm that is still true before you ship.
