/** Hosts the store app is allowed to open. */
export const SCHOOL_HOSTS = ["www.dotheimpossible.ai", "dotheimpossible.ai"] as const;

export const SCHOOL_ORIGIN = "https://www.dotheimpossible.ai";

export type SchoolLink = {
  href: string;
  path: string;
};

function allowedHost(hostname: string): boolean {
  return (SCHOOL_HOSTS as readonly string[]).includes(hostname);
}

function safePath(pathname: string, search: string, hash: string): string | null {
  if (!pathname.startsWith("/")) return null;
  if (pathname.startsWith("//") || pathname.includes("\\")) return null;
  return `${pathname}${search}${hash}`;
}

/** Accept only the school site, over https, or the app scheme pointing at that host. */
export function parseSchoolLink(raw: string): SchoolLink | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const protocol = url.protocol.toLowerCase();
  if (protocol !== "https:" && protocol !== "vkole:") return null;
  if (!allowedHost(url.hostname)) return null;
  const path = safePath(url.pathname || "/", url.search, url.hash);
  if (!path) return null;
  return { href: `${SCHOOL_ORIGIN}${path}`, path };
}

export function schoolHref(path: string): string | null {
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  return parseSchoolLink(`${SCHOOL_ORIGIN}${path}`)?.href ?? null;
}
