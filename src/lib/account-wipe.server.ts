/**
 * One-time server wipe. Parent, child, progress, and session rows go.
 * The operator mailbox (`app_mail`) and this version flag stay.
 * Never log or return row contents.
 */
import type { Sql } from "./db.ts";
import { ACCOUNT_WIPE_COOKIE, ACCOUNT_WIPE_VERSION, versionIsCurrent } from "./account-wipe.ts";
import { expireLocalSignInCookies, purgeAllAccountRows } from "./account-purge.server.ts";

const WIPE_KEY = "account_wipe_version";

let wipeTask: Promise<void> | null = null;

async function ensureSettingsTable(sql: Sql): Promise<void> {
  await sql`
    create table if not exists app_settings (
      key text primary key,
      value text not null
    )
  `;
}

async function readWipeVersion(sql: Sql): Promise<string | null> {
  await ensureSettingsTable(sql);
  const rows = await sql<{ value: string }>`select value from app_settings where key = ${WIPE_KEY}`;
  return rows[0]?.value ?? null;
}

async function writeWipeVersion(sql: Sql): Promise<void> {
  await sql`
    insert into app_settings (key, value)
    values (${WIPE_KEY}, ${ACCOUNT_WIPE_VERSION})
    on conflict (key) do update set value = excluded.value
  `;
}

/**
 * Delete stored accounts once, then remember the version.
 * A second call leaves rows created after the first wipe.
 * Returns true when this call performed the delete.
 */
export async function wipeStoredAccountsOnce(sql: Sql): Promise<boolean> {
  const current = await readWipeVersion(sql);
  if (versionIsCurrent(current)) return false;
  await purgeAllAccountRows(sql);
  await writeWipeVersion(sql);
  console.info("[account-wipe] cleared stored accounts");
  return true;
}

/** Run the row wipe before this process serves account data. Safe to call twice. */
export function ensureStoredAccountsWiped(): Promise<void> {
  wipeTask ??= (async () => {
    const { getSql } = await import("./db.ts");
    await getSql();
  })().catch((err) => {
    wipeTask = null;
    throw err;
  });
  return wipeTask;
}

export type WipeSignOutDeps = {
  readVersion: () => string | undefined;
  expireSignIn: () => Promise<void>;
  writeVersion: () => void;
};

/** Expire this browser's sign-in once, then set the version cookie. */
export async function signOutBrowserForWipe(deps: WipeSignOutDeps): Promise<boolean> {
  if (versionIsCurrent(deps.readVersion())) return false;
  await deps.expireSignIn();
  deps.writeVersion();
  return true;
}

export async function signOutIfWipeCookieStale(): Promise<boolean> {
  const { getCookie, setCookie } = await import("@tanstack/react-start/server");
  return signOutBrowserForWipe({
    readVersion: () => getCookie(ACCOUNT_WIPE_COOKIE),
    expireSignIn: () => expireLocalSignInCookies(),
    writeVersion: () => {
      setCookie(ACCOUNT_WIPE_COOKIE, ACCOUNT_WIPE_VERSION, {
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 400,
      });
    },
  });
}

/** True when this browser has not loaded since the wipe, so its session must not count. */
export async function requestNeedsAccountSignOut(): Promise<boolean> {
  try {
    const { getCookie } = await import("@tanstack/react-start/server");
    const stale = !versionIsCurrent(getCookie(ACCOUNT_WIPE_COOKIE));
    if (stale) await signOutIfWipeCookieStale();
    return stale;
  } catch {
    return false;
  }
}
