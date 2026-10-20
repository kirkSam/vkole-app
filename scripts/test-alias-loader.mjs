/**
 * The app resolves `@/` to `src/` through Vite. Node's test runner does not.
 * This loader is only for `node --test`.
 */
export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
  const name = specifier.slice(2);
  const file = /\.(ts|tsx|js|mjs|json)$/.test(name) ? name : `${name}.ts`;
  const url = new URL(`../src/${file}`, import.meta.url);
  return nextResolve(url.href, context);
}
