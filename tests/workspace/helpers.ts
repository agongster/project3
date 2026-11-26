/**
 * Shared helpers for the workspace tests: open the Demo Kingdom instantly
 * (no artificial pauses) with Ruff's Node.js build, and an in-memory
 * localStorage stand-in.
 */
import { DEMO_SOURCES } from "@/lib/analysis/demo";
import type { LintClient } from "@/lib/analysis/lintClient";
import { openWorkspace, type Workspace } from "@/lib/workspace";
import type { EditStorage } from "@/lib/workspace/storedEdits";
import { nodeLintClient } from "../analysis/nodeLint";

/** A Storage stand-in backed by a Map (`failWrites` makes every write throw like a full quota). */
export class MemoryStorage implements EditStorage {
  readonly data = new Map<string, string>();
  failWrites = false;
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.failWrites) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    this.data.set(key, value);
  }
}

const instantly = async () => undefined;

/** Opens the Demo Kingdom with no pauses, Ruff for Node, and `storage` (none by default). */
export function openDemo(storage: EditStorage | null = new MemoryStorage(), createLintClient: () => Promise<LintClient> = nodeLintClient): Promise<Workspace> {
  return openWorkspace({ kind: "demo" }, () => undefined, undefined, { storage, createLintClient, sleep: instantly });
}

/** The original text of a demo file. */
export function demoSource(path: string): string {
  const file = DEMO_SOURCES.find((candidate) => candidate.path === path);
  if (!file) throw new Error(`no demo file ${path}`);
  return file.source;
}

/** The file as the world currently sees it. */
export function viewOf(workspace: Workspace, path: string) {
  const file = workspace.analysis.get().files.find((candidate) => candidate.path === path);
  if (!file) throw new Error(`no file ${path} in the analysis`);
  return file;
}
