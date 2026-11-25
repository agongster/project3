// Copies the Ruff WebAssembly build out of node_modules into public/ruff/ so the
// browser can load it as plain static files (no bundler involved). Runs
// automatically before `npm run dev` and `npm run build`.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "@astral-sh", "ruff-wasm-web");
const to = join(root, "public", "ruff");

if (!existsSync(from)) {
  console.error("copy-ruff: @astral-sh/ruff-wasm-web is not installed. Run `npm install` first.");
  process.exit(1);
}
mkdirSync(to, { recursive: true });
for (const file of ["ruff_wasm.js", "ruff_wasm_bg.wasm"]) {
  cpSync(join(from, file), join(to, file));
}
console.log("copy-ruff: copied Ruff WASM to public/ruff/");
