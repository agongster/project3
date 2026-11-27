/**
 * Lint worker: runs Ruff (compiled to WebAssembly) off the main thread so the
 * loading screen and the Workshop editor stay smooth while code is checked.
 *
 * It is a plain-JS module served as a static file (not bundled by Next.js),
 * and it imports Ruff from the ruff/ folder next to it, which
 * scripts/copy-ruff.mjs fills. The path is relative so the site also works
 * when it is hosted in a sub-folder (GitHub Pages).
 *
 * Messages (see src/lib/analysis/lintClient.ts for the other side):
 *   in:  { type: "init", options }        → out: { type: "ready", version }
 *                                           or   { type: "init-error", message }
 *   in:  { type: "lint", id, source }     → out: { type: "result", id, value: diagnostics }
 *   in:  { type: "format", id, source }   → out: { type: "result", id, value: formattedSource }
 *   either request may instead answer       { type: "result", id, error: message }
 *
 * Requests are answered one at a time, in the order they arrive. When these
 * messages change, bump LINT_WORKER_PROTOCOL in lintClient.ts.
 */
import init, { PositionEncoding, Workspace } from "./ruff/ruff_wasm.js";

/** Ruff options from the init message (kept so a crashed workspace can be rebuilt). */
let ruffOptions = null;
/** The Ruff workspace; null until initialised, or after a crash. */
let workspace = null;
/** Resolves once WebAssembly is loaded and the first workspace exists. */
let ready = null;

function createWorkspace() {
  // UTF-16 positions: Ruff's columns are then JavaScript string indices (+1).
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

/** Only the fields the app reads, so less data is copied back to the page. */
function slimDiagnostic(diagnostic) {
  const { code, message, start_location, end_location, fix } = diagnostic;
  return { code, message, start_location, end_location, fix };
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

/** Runs one request on the Ruff workspace: "lint" checks the source, "format" reformats it. */
function run(type, source) {
  if (type === "lint") return workspace.check(source).map(slimDiagnostic);
  return workspace.format(source);
}

async function handleRequest(type, id, source) {
  try {
    await ready;
    if (workspace === null) workspace = createWorkspace();
    self.postMessage({ type: "result", id, value: run(type, source) });
  } catch (error) {
    // A Ruff panic can leave the WebAssembly instance in a bad state, so
    // start the next request with a fresh workspace instead of reusing this one.
    workspace = null;
    self.postMessage({ type: "result", id, error: errorMessage(error) });
  }
}

self.onmessage = (event) => {
  const message = event.data;
  if (message.type === "init") handleInit(message.options);
  else if (message.type === "lint" || message.type === "format") handleRequest(message.type, message.id, message.source);
};
