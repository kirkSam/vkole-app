import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Wraps the existing VKOLE web app (the same site that runs at the app's Vercel URL)
 * inside a native shell so it can be submitted to the Apple App Store and Google Play.
 *
 * appId is the permanent, unique identifier for this app on both stores. It is safe
 * to change now, before anything is ever submitted, but should be treated as locked
 * in once a real submission goes out, since changing it later means starting over
 * as a brand-new store listing. "com.dotheimpossible.vkole" is a placeholder that
 * follows the usual reverse-domain convention (your organization name, then the app) -
 * confirm or change it before the first real submission.
 */
const config: CapacitorConfig = {
  appId: "com.dotheimpossible.vkole",
  appName: "VKOLE",
  webDir: "dist/client",
  // CLAUDE: switched from loading the live, already-deployed app (`server.url`)
  // to loading this app's own bundled files in `webDir`, per each store's
  // guidelines on "native enough" apps. `androidScheme: "https"` keeps the
  // bundled app's origin as `https://localhost` (Capacitor's default) rather
  // than its other default `capacitor://`, which existing standard web tooling
  // (cookies, fetch) handles more predictably.
  //
  // Account sign-in, registration, and progress/level data are unaffected --
  // those already always call the backend's own address, independent of
  // where the screens themselves are loaded from (see `BETTER_AUTH_URL`,
  // `src/lib/auth/client.ts`, and `src/start.ts`).
  server: {
    androidScheme: "https",
  },
  // CLAUDE: added after real-device testing found the Create Account
  // screen's fields wouldn't take typed input on Android -- this native
  // bundled-screens path (vs. the old "load the live website" shell) never
  // had any soft-keyboard configuration at all, which Android's own WebView
  // needs to correctly keep the on-screen keyboard bound to a focused text
  // field. `resize: "native"` pairs with `android:windowSoftInputMode=
  // "adjustResize"` in AndroidManifest.xml.
  plugins: {
    Keyboard: {
      resize: "native",
    },
  },
};

export default config;
