# VKOLE/ZPD - Space x.AI Supported Learning Engine

The learning app for one student. Four engines share one registration: VKOLE/M, VKOLE/ELA, VKOLE/SS, and VKOLE/gen.

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
- School reply address in the code: kirksamalpha@dotheimpossible.ai

Stripe checkout is not attached. `STRIPE_MONTHLY_URL` in `src/lib/stripe-pay.ts` is empty. The prices shown in the app are $9.00 USD plus tax a month, or $79.00 USD plus tax a year, for one student.

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
| xAI API | Grade one answer and write the next question | `XAI_API_KEY` |
| Gmail SMTP | Parent progress reports, password codes, registration notices | `GMAIL_APP_PASSWORD` or `VKOLE_MAIL_SECRET` |
| Better Auth | Parent email and password sessions | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` |
| Grok auth broker | Google and X sign-in on the Grok host | `GROK_AUTH_ISSUER`, `GROK_AUTH_CLIENT_ID`, `GROK_AUTH_CLIENT_SECRET` |
| Grok preview auth | Live-preview sign-in only | `GROK_PREVIEW_CLIENT_SECRET` |
| Grok connectors | Gmail connector on the published Grok host | `GROK_PROJECT_ID`, `GROK_GATE_ORIGIN`, `GROK_CONNECTORS_URL`, `GROK_CONNECTOR_ACCESS_TOKEN` |
| Stripe | Pay buttons. Not connected. The URL constant is empty. | none |

The app also reads `VITE_AUTH_ENABLED`, `VITE_PUBLIC_HOSTNAME`, and `NODE_ENV`. Do not put real values in the repository.

## What is not in this repository

- `node_modules`
- Secret keys and passwords
- The published database
- The sandbox-only agent instructions

## Phone and tablet build

The App Store and Play build is the Capacitor app in `mobile/`. It keeps worksheets and a reminder on the device, and it opens https://www.dotheimpossible.ai only after a parent gate. Read `docs/AUDIT.md` for how this engine compares with the live school, and `docs/STORE_SUBMISSION.md` for the upload checklist.

```bash
cd mobile
npm install
npm test
npm run build
npx cap sync
```

iOS can be generated here and has to be archived on a Mac. Do not put store keys or passwords in the repository.
