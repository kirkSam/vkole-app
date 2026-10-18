# VKOLE/ZPD - Space XSI Integrated Learning Engine

The learning app for one student. Eight engines share one registration: VKOLE/M, VKOLE Singapore, VKOLE Sight Words, VKOLE/Spelling ZPD, VKOLE/PA ZPD, VKOLE/ELA, VKOLE/SS, and VKOLE/gen.

This repository is the application source. It does not contain secret keys or passwords. Set those by name in the environment. See `.env.example`.

## Language and framework

- Language: TypeScript
- UI: React 19
- App framework: TanStack Start (`@tanstack/react-start`) with TanStack Router
- Build: Vite 8
- Styles: Tailwind CSS 4
- Server bundle: Nitro
- Auth: Better Auth
- Validation: Zod
- Database client: `pg` for Postgres, `@electric-sql/pglite` when `DATABASE_URL` is not set
- PDF assignments: `pdf-lib`

## Addresses this app loads or points to

- Published app: https://amber-clover-pixel-ember.grok.me
- School site, online live sessions: https://dotheimpossible.ai/parents
- School site, baseline testing: https://dotheimpossible.ai/adol
- Grading API: https://api.x.ai/v1/chat/completions
- Gmail SMTP: smtp.gmail.com port 465
- Auth broker used by the Grok host: https://auth.grok.me
- Connector host used by the Grok host: https://connectors.grok.me
- School reply address in the code: kirksam.alpha@dotheimpossible.ai

The school website is the only account book. Parent email and password, the student level, the free week, the day clock, seen questions, and whether access is open live at https://www.dotheimpossible.ai. This app calls `/api/account/*` from its own server, with no cookies. Sign-in and register return a token that lasts 12 hours. That token and its `expiresAt` are stored on the same local row as the family mirror. Later reads and saves send `Authorization: Bearer`. The browser does not send `X-Vkole-Secret`. After a successful sign-in the app still sets its own HttpOnly session cookie, keyed to the lowercase parent email. A 401 from the website clears the stored token and returns the parent to sign-in.

This app still keeps a copy of that sign-in and of the student record: Better Auth `user`, `session`, `account`, and `verification` rows; `climbs`, `app_trials`, and the related student tables (`climb_events`, `climb_sittings`, `academic_mail`, `app_subscriptions`, `parent_logins`, `payments`, `student_passwords`, `day_clocks`, `assignment_sheets`, `seen_prompts`, `question_bags`, `school_mirror`, `registrations`). The device does not use `localStorage` for an account. It does keep the session cookie, and `sessionStorage` holds the preview bearer token plus a few screen flags. None of that is deleted by the website's own wipe.

`POST /api/vkole/purge` deletes those rows and leaves the tables and the eight engines in place. The caller sends header `X-Vkole-Secret` (the shared secret) or is signed in as an email listed in `VKOLE_ADMIN_EMAILS`, and the JSON body `{ "confirm": "delete-all-accounts" }`. The response is counts only. That secret is still required for this purge route. It is not sent on account calls, and it must not be exposed to the browser (`VITE_` names are visible to the page). When a signed-in parent later opens the app and the website says that account is gone, this app deletes that parent's rows, expires the session cookie, and the browser drops the cached sign-in.

Pay buttons open https://www.dotheimpossible.ai/engine. This app does not record a payment and does not charge the card. The prices shown are $9.00 USD plus tax a month, or $79.00 USD plus tax a year, for one student. Google and X stay separate from the school account.

## Install

Requires Node.js 22 or newer.

```bash
npm install
```

## Run

```bash
npm run dev
```

The dev server listens on port 8080.

```text
http://localhost:8080
```

Without `DATABASE_URL`, accounts stay in an embedded database for that process. They are not shared across restarts of a published server.

## Build

```bash
npm run build
```

`npm run build` compiles the app and then runs `npm run db:migrate`. The migrator applies the live SQL files in `migrations/` when `DATABASE_URL` is set. It skips the preview-only migration files listed in `scripts/migration-plan.mjs`. Those preview files must not be applied to a live database.

Other checks:

```bash
npm run typecheck
npm test
```

## Database

Schema and later changes are the SQL files in `migrations/`. Sign-in tables are in `migrations/auth/`. On a new Postgres database, set `DATABASE_URL` and run:

```bash
npm run db:migrate
```

## Services, APIs, and accounts

| Service | What it is for | Name to set |
|---|---|---|
| Postgres | Accounts, students, levels, mail record | `DATABASE_URL` |
| xAI API | Grade one answer, write the next question, and write the spelling parent report | `XAI_API_KEY` |
| Gmail SMTP | Parent progress reports, password codes, registration notices | `GMAIL_APP_PASSWORD` or `VKOLE_MAIL_SECRET` |
| Better Auth | This app's session cookie after the school website accepts the password | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` |
| School website | Parent account, password, level, free week, clock, seen questions, and access. Account calls use the bearer token from sign-in, not a shared secret. | none for `/api/account/*` |
| This app's purge route | `POST /api/vkole/purge` only. Not used for sign-in, register, family, or password reset. | `VKOLE_SHARED_SECRET` |
| Grok auth broker | Google and X sign-in on the Grok host | `GROK_AUTH_ISSUER`, `GROK_AUTH_CLIENT_ID`, `GROK_AUTH_CLIENT_SECRET` |
| Grok preview auth | Live-preview sign-in only | `GROK_PREVIEW_CLIENT_SECRET` |
| Grok connectors | Gmail connector on the published Grok host | `GROK_PROJECT_ID`, `GROK_GATE_ORIGIN`, `GROK_CONNECTORS_URL`, `GROK_CONNECTOR_ACCESS_TOKEN` |
| Stripe | Charged on the school website, not in this app | none |

The app also reads `VITE_AUTH_ENABLED`, `VITE_PUBLIC_HOSTNAME`, and `NODE_ENV`. Do not put real values in the repository.

## What is not in this repository

- `node_modules`
- Secret keys and passwords
- The published database
- The sandbox-only agent instructions
