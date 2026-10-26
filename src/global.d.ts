// CLAUDE: ambient declaration for the build-time constant injected by
// `vite.config.ts`'s `define` -- the app's own public backend address,
// copied from the existing `BETTER_AUTH_URL` setting so client code can use
// it too. See `vite.config.ts` and `src/lib/auth/client.ts`.
declare const __APP_ORIGIN__: string;
