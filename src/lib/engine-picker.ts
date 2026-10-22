/**
 * The signed-in engine list on the home screen.
 * "/" with no query is the splash page. This query skips the splash.
 */
export const ENGINE_PICKER_ROUTE = "/?open=1";

export const ENGINE_PICKER_PARAM = "open";

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
