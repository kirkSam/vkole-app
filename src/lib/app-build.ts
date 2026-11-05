/** Short id at the bottom of every screen. A git build replaces it when one is available. */
export const APP_BUILD_SOURCE = "pending";

declare const __APP_BUILD__: string | undefined;

export function appBuildId(): string {
  const baked = typeof __APP_BUILD__ === "string" ? __APP_BUILD__.trim() : "";
  return baked || APP_BUILD_SOURCE;
}
