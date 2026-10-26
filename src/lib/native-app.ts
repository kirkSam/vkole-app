/**
 * CLAUDE: added as part of switching the Capacitor native shell from loading
 * the live website to loading its own bundled `dist/client` files.
 *
 * These are the fixed placeholder web origins a Capacitor app's bundled
 * screens run from once they're no longer fetched from the live site --
 * Android with `server.androidScheme: "https"` (`capacitor.config.ts`) uses
 * `https://localhost`; iOS's default scheme is `capacitor://localhost`
 * (there's no `ios/` project in this repo yet, but this is included so
 * nothing needs to change here when one is added).
 *
 * Every server-side place that must recognize "a request from our own
 * bundled app" (as opposed to a request from some other website) reads this
 * same list, so there is exactly one place to update if either scheme ever
 * changes: `isolation.server.ts`, `auth/server.ts` (`trustedOrigins`), and
 * `start.ts` (CSRF + CORS).
 */
export const NATIVE_APP_ORIGINS = ["https://localhost", "capacitor://localhost"] as const;

export function isNativeAppOrigin(origin: string | null): boolean {
  return origin !== null && (NATIVE_APP_ORIGINS as readonly string[]).includes(origin);
}
