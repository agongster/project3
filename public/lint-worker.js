/**
 * Lint worker: runs Ruff (compiled to WebAssembly) off the main thread so the
 * loading screen stays smooth while hundreds of files are checked.
 *
 * It is a plain-JS module served as a static file (not bundled by Next.js),
 * and it imports Ruff from the ruff/ folder next to it, which
 * scripts/copy-ruff.mjs fills. The path is relative so the site also works
 * when it is hosted in a sub-folder (GitHub Pages).
 *
 * Messages (see src/lib/analysis/lintClient.ts for the other side):
 *   in:  { type: "init", options }      → out: { type: "ready", version }
 *                                         or   { type: "init-error", message }
 *   in:  { type: "lint", id, source }   → out: { type: "lint-result", id, diagnostics }
 *                                         or   { type: "lint-result", id, error }
 */
import init, { PositionEncoding, Workspace } from "./ruff/ruff_wasm.js";

/** Ruff options from the init message (kept so a crashed workspace can be rebuilt). */
let ruffOptions = null;
/** The Ruff workspace; null until initialised, or after a crash. */
let workspace = null;
/** Resolves once WebAssembly is loaded and the first workspace exists. */
let ready = null;

function createWorkspace() {
  return new Workspace(ruffOptions, PositionEncoding.Utf16);
}

async function initialise(options) {
  ruffOptions = options;
  await init(); // downloads and compiles /ruff/ruff_wasm_bg.wasm
  workspace = createWorkspace();
  return Workspace.version();
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function handleInit(options) {
  ready = initialise(options);
  try {
    const version = await ready;
    self.postMessage({ type: "ready", version });
  } catch (error) {
    self.postMessage({ type: "init-error", message: errorMessage(error) });
  }
}

async function handleLint(id, source) {
  try {
    await ready;
    if (workspace === null) workspace = createWorkspace();
    const diagnostics = workspace.check(source);
    self.postMessage({ type: "lint-result", id, diagnostics });
  } catch (error) {
    // A Ruff panic can leave the WebAssembly instance in a bad state, so
    // start the next file with a fresh workspace instead of reusing this one.
    workspace = null;
    self.postMessage({ type: "lint-result", id, error: errorMessage(error) });
  }
}

self.onmessage = (event) => {
  const message = event.data;
  if (message.type === "init") handleInit(message.options);
  else if (message.type === "lint") handleLint(message.id, message.source);
};
