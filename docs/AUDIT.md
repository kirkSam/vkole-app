# Audit of this app, and how it compares with the live school

This note is based on the files in this repository and on the public pages and JavaScript at https://www.dotheimpossible.ai as fetched on 13 October 2026. The GitHub repository `kirkSam/online-school` returned 404 to both the GitHub API and a public page fetch, so pull request 4 could not be read. Nothing below is filled in from that pull request.

## What this repository is

It is a TypeScript app. The screen is React 19. The app framework is TanStack Start with TanStack Router. Vite 8 builds it. Tailwind CSS 4 styles it. Nitro serves the server bundle. Better Auth handles parent email-and-password sessions. Zod checks input. The database client is `pg` when `DATABASE_URL` is set, and an embedded PGlite database when it is not. `pdf-lib` builds assignment PDFs.

The README names the published copy as https://amber-clover-pixel-ember.grok.me. That host is separate from https://www.dotheimpossible.ai.

## What a family can do in this copy

One registration opens four engines: mathematics (`m`), English language arts (`ela`), social studies (`ss`), and general (`gen`). A parent signs in. A student name, a starting grade, and a student password are stored. The engine shows a question, scores the answer, and moves the working level. A day clock limits the login. A week-long trial is in the database. Stripe is named in the code and is not connected: `STRIPE_MONTHLY_URL` in `src/lib/stripe-pay.ts` is an empty string. The rules text in `src/lib/day-clock-math.ts` states a price of $9.00 USD plus tax a month, or $79.00 USD plus tax a year. This audit repeats that figure because it is in the source. The store app does not.

## What it connects to

From the README, `.env.example`, `src/lib`, and `migrations/`:

- Postgres, or PGlite if `DATABASE_URL` is empty. Tables include the Better Auth user, session, account, and verification tables. Sessions can store an IP address and a user agent. Accounts can store a password hash and provider tokens. App tables store a child name, subject, level, answer counts, a student password hash, a daily clock, parent login emails, payment rows (email, plan, amount in cents, status — no card number column), assignment PDFs, registration email and name, mail the app tried to send, and prompts already shown.
- xAI at `https://api.x.ai/v1/chat/completions`, model `grok-4-1-fast-non-reasoning`, when `XAI_API_KEY` is set. `src/lib/vkole-cycle.ts` sends the subject, starting grade, current grade, standard code and label, streaks, the question, and the student's answer. The instruction does not include the child's name.
- Gmail SMTP at smtp.gmail.com port 465, using `GMAIL_APP_PASSWORD` or `VKOLE_MAIL_SECRET`, for parent reports, password codes, and registration notices.
- Better Auth, using `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`.
- Grok's auth broker and connector host, named in the README, for Google and X sign-in and a Gmail connector on the Grok host.
- The school addresses named in the README: https://dotheimpossible.ai/parents and https://dotheimpossible.ai/adol. The code's school reply address is `kirksamalpha@dotheimpossible.ai` in `src/lib/brand.ts`.

There is no advertising SDK and no analytics SDK in `package.json`.

## The movement rule in this repository

`src/lib/vkole-cap.ts` moves one standard at a time. Two correct answers in a row rise one standard. One incorrect answer stays. Two incorrect answers in a row fall one standard. The grade number changes only after standard 3. Grade 12 is the top. At that cap the questions rotate. Grade 13 is not opened.

`src/lib/day-clock-math.ts` sets one clock of 2.5 hours (150 minutes) for the login, shared by the four engines. Five minutes with no pointer or key press stops the clock and those minutes are not added. The clock resets at midnight Pacific time. That clock is still in this repository's server screens. The phone app in `mobile/` does not use it. The owner is removing the same clock from student offices on the website. That website change was in progress when this note was updated, and it was not re-checked on the live pages.

## What the live school site shows

The public site is also a TanStack Start app (the HTML uses the same router stream) hosted on Vercel. The home page, the parents page, the ADOL page, the engine page, the privacy page, and the terms page were read. These bundles were downloaded:

- `/assets/vkole-rules-BV5I7WCt.js`
- `/assets/vkole-page-BpNh1cfZ.js`
- `/assets/engine-BrWcaigA.js`

The rules bundle exports the four ids `m`, `ela`, `ss`, `gen` and this sentence:

"Two correct answers move up one standard. One incorrect answer stays on that standard. Two incorrect answers in a row move down one standard. The grade number changes only after the third standard. Grade 12 is the top. Grade 12 questions continue on a rotation."

That is the same rule as `moveVkoleRung` in this repository.

The engine page says one registration is one student on that student's own device, the free week is 168 hours from the first sign-in, and the later price is $9.00 USD plus tax a month or $79.00 USD plus tax a year. It also says, in the page script: "This is the same engine as the live app. The website does not write into the app."

The terms page says a student has two hours and thirty minutes in the office each day, the clock resets at midnight Pacific, and five minutes with no activity signs the student out. That matches the numbers in `day-clock-math.ts`. The 2.5-hour sentence was not inside the engine-page bundle that was downloaded. It is on the public terms page.

The parents page also sells a teaching package (a first-month price, then $489.00 USD plus tax a month, live sessions at $89.00 or a block of ten). This repository's Stripe constant does not implement that package.

The site privacy page says the engine record in the browser keeps the parent email, a hash of the registration password, the student name, the starting grade, the level, missed work, questions already given, and the daily office timer. It says a question's subject, grade, question, and answer are sent to Space x.AI. It says cards are entered on Stripe. It says the site does not sell information, show ads, or use a tracking pixel. Erasing the browser does not delete a meeting already on the school record. Closing the account is an email to `kirksam.alpha@dotheimpossible.ai` with the subject "Delete my family's record."

## Same rule, two copies

The movement rule matches. The server copy in this repository still contains the daily clock described above. The phone app does not. The data does not match either. This repository has its own database, its own sign-in, and its own call to xAI. The website says it does not write into the app. The contact address in this repository (`kirksamalpha@dotheimpossible.ai`) is not the same string as the address on the live site (`kirksam.alpha@dotheimpossible.ai`).

So the engines are duplicated. They have not been shown to share one database. Whether the website's later edits in pull request 4 diverged further cannot be checked from here, because that repository was not readable.

## Recommendation

Publish a store app that uses the website for the live school, and keep a separate on-device practice tool.

Reasons:

- Families already have offices, sessions, and the engine on https://www.dotheimpossible.ai. A second server in the store binary would be another database, another sign-in, and another place for the rule to drift.
- The store binary cannot hold `XAI_API_KEY`, the database URL, or the mail password.
- The website itself says it does not write into the app. Offline worksheets in the store app follow `moveVkoleRung` from this repository and are labeled as not updating the office.

The store app should not be a full-screen remote web view of the site. That is the kind of wrapper App Store guideline 4.2 rejects. The binary in `mobile/` is its own screens: offline worksheets, a local reminder, sharing, a parent gate, privacy, terms, and account erasure. It does not keep a daily practice clock. The school site opens only when a parent asks, in the system browser sheet.

Do not point Capacitor's `server.url` at the website. That setting is left unset on purpose.
