import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const tsc = join(root, "node_modules", "typescript", "bin", "tsc");
execFileSync(process.execPath, [tsc, "-p", join(root, "scripts", "tsconfig.vekole-engine.json")], {
  cwd: root,
  stdio: "inherit",
});
