/** The address parents and students should open. Never a raw server host. */
export function publishedOrigin(): string {
  const raw = process.env.BETTER_AUTH_URL?.trim().replace(/\/+$/, "") ?? "";
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.origin;
  } catch {
    return "";
  }
}

export function isDirectServerHost(hostHeader: string, published: string): boolean {
  const host = hostHeader.split(",")[0]?.trim().toLowerCase() ?? "";
  const name = host.split(":")[0] ?? "";
  if (!name || !published) return false;
  let publishedHost = "";
  try {
    publishedHost = new URL(published).host.toLowerCase();
  } catch {
    return false;
  }
  if (name === publishedHost) return false;
  if (
    name === "localhost" ||
    name === "127.0.0.1" ||
    name === "[::1]" ||
    name.endsWith(".grok-sandbox.com") ||
    name.endsWith(".grok.me") ||
    name.endsWith(".app-builder-testing.com")
  ) {
    return false;
  }
  return name.endsWith(".vercel.app") || name.endsWith(".vercel.sh");
}
