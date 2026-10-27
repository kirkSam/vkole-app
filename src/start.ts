import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";
import { isNativeAppOrigin } from "@/lib/native-app";

/**
 * CLAUDE: this file is new.
 *
 * Before it existed, this app ran on TanStack Start's silent built-in
 * defaults everywhere: a same-origin-only CSRF guard on every server
 * function call, and no CORS headers anywhere (fine, since nothing ever
 * called in cross-origin). Those defaults are exactly right for a normal
 * website, but the Capacitor native app now loads its own bundled screens
 * from a fixed placeholder address instead of this app's own address (see
 * `capacitor.config.ts`), so a call from it looks like a different,
 * untrusted website to both of those defaults unless told otherwise here.
 *
 * Every change below is scoped narrowly to requests whose `Origin` is
 * exactly one of `NATIVE_APP_ORIGINS` (see `native-app.ts`) — every other
 * caller (the live website, the live preview, local dev) is unaffected and
 * behaves exactly as it did before this file existed.
 */

/**
 * Answers the native app's CORS preflight (`OPTIONS`) requests, and tags its
 * real requests' responses with the header a browser-like webview requires
 * before it will accept a cross-origin response at all. A request whose
 * Origin isn't one of our own native origins passes through untouched.
 */
// CLAUDE: the exact set of extra request headers this app's own client code
// sends that a plain CORS allow-list wouldn't otherwise permit (confirmed on
// a real device via the browser's own CORS error -- "Request header field
// x-tsr-serverfn is not allowed by Access-Control-Allow-Headers"), and the
// extra response headers that same client code reads back
// (`X_TSS_RAW_RESPONSE`/`X_TSS_SERIALIZED` in
// @tanstack/start-client-core/src/constants.ts), which a browser hides from
// JS by default unless explicitly exposed.
const ALLOWED_REQUEST_HEADERS = "Authorization, Content-Type, Accept, x-tsr-serverFn";
const EXPOSED_RESPONSE_HEADERS = "x-tss-serialized, x-tss-raw, x-tss-context";

const nativeAppCorsMiddleware = createMiddleware().server(async (ctx) => {
  const origin = ctx.request.headers.get("origin");
  if (!isNativeAppOrigin(origin)) return ctx.next();

  if (ctx.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin!,
        "Access-Control-Allow-Credentials": "true",
        Vary: "Origin",
        "Access-Control-Allow-Headers": ALLOWED_REQUEST_HEADERS,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
    });
  }

  const result = await ctx.next();
  const headers = new Headers(result.response.headers);
  headers.set("Access-Control-Allow-Origin", origin!);
  // Required whenever the client's fetch uses `credentials: "include"`
  // (confirmed on a real device: Better Auth's own client does this for
  // `/api/auth/*` calls) -- a browser silently blocks the whole response
  // otherwise, which is indistinguishable from the server never answering.
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Expose-Headers", EXPOSED_RESPONSE_HEADERS);
  headers.append("Vary", "Origin");
  return {
    ...result,
    response: new Response(result.response.body, {
      status: result.response.status,
      statusText: result.response.statusText,
      headers,
    }),
  };
});

/**
 * Same protection as the framework default (reject a scripted cross-site
 * call to a server function), just also accepting our own native app's
 * fixed origin — matching the same allowance already made in
 * `isolation.server.ts` for this app's own per-user data functions. A
 * request that passes this still needs a valid bearer session token
 * afterward wherever that's required; this only decides whether the
 * request is from a trustworthy *origin* in the first place.
 */
const nativeAwareCsrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
  secFetchSite: (value, ctx) => {
    if (value === "same-origin" || value === "none") return true;
    return isNativeAppOrigin(ctx.request.headers.get("origin"));
  },
});

export const startInstance = createStart(() => ({
  requestMiddleware: [nativeAppCorsMiddleware, nativeAwareCsrfMiddleware],
  serverFns: {
    // Server functions normally call a path relative to wherever the page
    // itself was loaded from (e.g. `/_serverFn/...`). The native app's
    // screens are no longer loaded from this app's own address (see
    // `capacitor.config.ts`), so that relative path alone no longer reaches
    // anything — this makes it absolute using the same address
    // `auth/server.ts` and `auth/client.ts` already use.
    //
    // For every other build `__APP_ORIGIN__` is either unset (local dev,
    // live preview — both already resolve relative paths correctly, so this
    // is skipped) or equal to the exact address the page is already being
    // served from (deployed web — so making the URL absolute changes
    // nothing about where it points).
    fetch: (url, init) => {
      if (typeof url === "string" && url.startsWith("/") && __APP_ORIGIN__) {
        return fetch(__APP_ORIGIN__ + url, init);
      }
      return fetch(url, init);
    },
  },
}));
