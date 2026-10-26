#!/usr/bin/env node
/**
 * CLAUDE: added alongside switching the native app to load its own bundled
 * screens instead of the live website.
 *
 * `npm run build` (this app is server-rendered) does not produce the plain
 * folder of finished files Capacitor's `webDir` expects -- it produces a
 * Vercel-format deployment (`.vercel/output/static` + a server function),
 * plus (since `spa: { enabled: true }` in vite.config.ts) one extra
 * prerendered "shell" page (`.vercel/output/static/_shell.html`): a static
 * page with no real content yet, whose job is just to boot the same
 * JavaScript app in the browser, which then renders everything itself and
 * talks to the real backend over the network -- the same thing the live
 * website's JavaScript already does after its first server-rendered paint.
 *
 * This script assembles that shell plus its sibling static assets (JS, CSS,
 * images, the PWA manifest) into `dist/client`, named `index.html` -- the
 * plain folder `capacitor.config.ts` (`webDir: "dist/client"`) expects.
 *
 * Usage: run `npm run build`, then this script (or just `npm run
 * build:android`, which does both).
 */
import { cpSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const staticDir = join(root, ".vercel/output/static");
const shellFile = join(staticDir, "_shell.html");
const clientDir = join(root, "dist/client");

if (!existsSync(shellFile)) {
  console.error(
    `[assemble-native-client] Missing ${shellFile}.\n` +
      "Run `npm run build` first (it must include the prerendered shell page -- " +
      'confirm `spa: { enabled: true }` is still set on `tanstackStart()` in vite.config.ts).',
  );
  process.exit(1);
}

rmSync(clientDir, { recursive: true, force: true });
mkdirSync(clientDir, { recursive: true });
cpSync(staticDir, clientDir, { recursive: true });
renameSync(join(clientDir, "_shell.html"), join(clientDir, "index.html"));

console.log(`[assemble-native-client] Wrote ${clientDir} (native app webDir), from ${staticDir}.`);
