/**
 * Test helper: lints Python source with Ruff's Node.js WebAssembly build
 * (same pinned version as the browser build) and Lintlands' real options.
 *
 *   import { createNodeLint } from "../analysis/nodeLint";
 *   const lint = createNodeLint();
 *   analyzeSources(meta, files, lint);
 */
import { createRequire } from "node:module";
import type { RawDiagnostic } from "@/lib/analysis/normalize";
import { RUFF_OPTIONS } from "@/lib/analysis/rules";

type RuffNode = typeof import("@astral-sh/ruff-wasm-nodejs");

// The Node.js build of Ruff is a CommonJS module.
const requireCommonJs = createRequire(import.meta.url);
const ruff = requireCommonJs("@astral-sh/ruff-wasm-nodejs") as RuffNode;

/** Returns a synchronous lint function, the same shape analyzeSources expects. */
export function createNodeLint(options: object = RUFF_OPTIONS): (source: string) => RawDiagnostic[] {
  const workspace = new ruff.Workspace(options, ruff.PositionEncoding.Utf16);
  return (source) => workspace.check(source) as RawDiagnostic[];
}

/** Ruff's version string, e.g. "0.17.6". */
export function ruffVersion(): string {
  return ruff.Workspace.version();
}
