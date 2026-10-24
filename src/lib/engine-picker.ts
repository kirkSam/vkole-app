/**
 * The signed-in engine list on the home screen.
 * "/" with no query is the splash page. This query skips the splash.
 */
export const ENGINE_PICKER_ROUTE = "/?open=1";

export const ENGINE_PICKER_PARAM = "open";

/** Set when sign-in opens the engine list, so a second load does not show the splash. */
export const STAY_IN_APP_KEY = "vkole-stay-in-app";

type FlagStore = {
  getItem?(key: string): string | null;
  setItem?(key: string, value: string): void;
  removeItem?(key: string): void;
};

export function markStayInApp(storage: FlagStore | null): void {
  try {
    storage?.setItem?.(STAY_IN_APP_KEY, "1");
  } catch {
    /* storage may be unavailable */
  }
}

export function shouldStayInApp(storage: FlagStore | null): boolean {
  try {
    return storage?.getItem?.(STAY_IN_APP_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearStayInApp(storage: FlagStore | null): void {
  try {
    storage?.removeItem?.(STAY_IN_APP_KEY);
  } catch {
    /* storage may be unavailable */
  }
}

let sittingHeld = false;

/** The next leave keeps the open sitting and does not send the parent email. */
export function holdSittingForOtherEngines(): void {
  sittingHeld = true;
}

/** Read and clear the mark. Session cleanup skips finish("logout") when this is true. */
export function takeHeldSitting(): boolean {
  const held = sittingHeld;
  sittingHeld = false;
  return held;
}

export function isEnginePickerSearch(search: string): boolean {
  return new URLSearchParams(search).get(ENGINE_PICKER_PARAM) === "1";
}

function assignRoute(url: string): void {
  window.location.assign(url);
}

/** Open the engine list for the student who is already signed in. */
export function openEnginePicker(assign: (url: string) => void = assignRoute): void {
  holdSittingForOtherEngines();
  assign(ENGINE_PICKER_ROUTE);
}
