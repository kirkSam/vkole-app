/** Pacific minute this copy was built. Used when git has no version to read. */
export function pacificBuildStamp(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = pick("hour") === "24" ? "00" : pick("hour");
  return `${pick("year")}-${pick("month")}-${pick("day")} ${hour}:${pick("minute")} PT`;
}

declare const __APP_BUILD__: string | undefined;

export function appBuildId(now = new Date()): string {
  const baked = typeof __APP_BUILD__ === "string" ? __APP_BUILD__.trim() : "";
  return baked || pacificBuildStamp(now);
}
