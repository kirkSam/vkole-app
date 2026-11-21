import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../../", import.meta.url));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

describe("dictionary stays off the client", () => {
  it("does not let a screen or route import the pronunciation dictionary", () => {
    const files = [...walk(join(root, "src/components")), ...walk(join(root, "src/routes"))];
    const hits = files.filter((file) => {
      const text = readFileSync(file, "utf8");
      return text.includes("@kirkpatrick/vekole-engine/server") || text.includes("cmudict") || text.includes("CMUDICT_TEXT");
    });
    assert.deepEqual(hits, []);
    const engine = readFileSync(join(root, "node_modules/@kirkpatrick/vekole-engine/dist/index.js"), "utf8");
    assert.equal(engine.includes("cmudict"), false);
    assert.equal(engine.includes("CMUDICT_TEXT"), false);
  });
});
