/**
 * The Workspace object (see contract.ts): the repo's files in memory, the
 * live Ruff worker, and the player's edits. `openWorkspace` (open.ts) builds
 * one; this file is what it does afterwards.
 *
 * Failure rules, all chosen so a forge never loses the player's text:
 *   - A forge is all or nothing. The new text is linted first; only if that
 *     works are the saved text, the stored edit and the world updated. If
 *     Ruff can't read the text (or no worker can be started), the forge
 *     rejects with a friendly message and nothing changes: the previous
 *     saved version stays, and the caller still holds the new text.
 *   - A dead worker is restarted automatically (linter.ts).
 *   - A file that failed to download can't be read or forged (its stored
 *     edit, if any, is kept for the next visit).
 *   - Forges and reverts run one at a time, in the order they were asked
 *     for, so each report compares against the version just before it.
 */
import { computeStats, type FileInspection } from "@/lib/analysis/analyzeSources";
import { createStore } from "@/lib/game/store";
import type { RepoAnalysis } from "@/lib/types";
import type { FileChange, ForgeReport, LiveCheck, Workspace, WorkspaceEntry } from "./contract";
import { describeChange, unifiedDiff, zipChanges } from "./exportChanges";
import { latestOnly } from "./latestOnly";
import { assertEditable, assertOpenable, MESSAGES } from "./limits";
import { LinterUnavailableError, type Linter } from "./linter";
import { liveCheckOf } from "./liveCheck";
import { forgeReport, inspectText, withSavedText, type PythonFile } from "./pythonFile";
import type { EditStore } from "./storedEdits";

/** A non-Python text file: downloaded the first time it is needed. */
export interface OtherFile {
  path: string;
  size: number;
  /** Null until downloaded. */
  original: string | null;
  /** The player's saved text, or null while it equals the original. */
  saved: string | null;
}

export interface WorkspaceParts {
  repoKey: string;
  /** The analysis of `python` at load time (built by open.ts). */
  analysis: RepoAnalysis;
  python: readonly PythonFile[];
  others: readonly OtherFile[];
  /** Downloads a non-Python file's original text (rejects with a friendly message). */
  fetchOther: (path: string) => Promise<string>;
  linter: Linter;
  edits: EditStore;
}

export function createWorkspace(parts: WorkspaceParts): Workspace {
  const python = new Map(parts.python.map((file) => [file.path, file]));
  const others = new Map(parts.others.map((file) => [file.path, file]));
  const downloads = new Map<string, Promise<string>>();
  const analysis = createStore(parts.analysis);
  const listeners = new Set<() => void>();
  const changeCache = new Map<string, FileChange>();
  let queue: Promise<unknown> = Promise.resolve();
  let disposed = false;

  function assertOpen(): void {
    if (disposed) throw new Error(MESSAGES.closed);
  }

  /** Runs `task` once every forge / revert asked for before it has finished. */
  function inTurn<T>(task: () => Promise<T>): Promise<T> {
    const result = queue.then(task);
    queue = result.catch(() => undefined);
    return result;
  }

  // ───────────── other (non-Python) files ─────────────

  /** A non-Python file's original text, downloaded (and checked) the first time it is needed. */
  async function originalOf(path: string): Promise<string> {
    const known = others.get(path)?.original;
    if (known !== null && known !== undefined) return known;
    let download = downloads.get(path);
    if (!download) {
      download = parts.fetchOther(path).then((text) => {
        assertOpenable(text);
        return text;
      });
      downloads.set(path, download);
    }
    try {
      const text = await download;
      const file = others.get(path);
      if (file) others.set(path, { ...file, original: text });
      return text;
    } finally {
      downloads.delete(path); // a failed download may be tried again later
    }
  }

  async function forgeOther(path: string, text: string): Promise<ForgeReport> {
    const original = await originalOf(path);
    const saved = text === original ? null : text;
    others.set(path, { ...others.get(path)!, saved });
    parts.edits.save(parts.repoKey, path, saved);
    return notLintedReport(path);
  }

  // ───────────── Python files ─────────────

  /** Lints `text` as the new saved text of `file`; a failure becomes a friendly message. */
  async function inspectForForge(file: PythonFile, text: string): Promise<FileInspection> {
    if (text === file.original) return file.originalInspection;
    try {
      const diagnostics = await parts.linter.lint(text);
      return inspectText(file, text, () => diagnostics);
    } catch (error) {
      if (error instanceof LinterUnavailableError) throw error;
      console.warn(`Lintlands: Ruff could not lint the new text of ${file.path}`, error);
      throw new Error(MESSAGES.notLinted);
    }
  }

  async function forgePython(file: PythonFile, text: string): Promise<ForgeReport> {
    if (file.original === null) throw new Error(MESSAGES.notDownloaded);
    if (text === file.saved) return forgeReport(file, file);
    const next = withSavedText(file, text, await inspectForForge(file, text));
    python.set(file.path, next);
    parts.edits.save(parts.repoKey, file.path, text === file.original ? null : text);
    // A new analysis object (never a mutated one), so everything watching the store sees the change.
    analysis.set((current) => {
      const files = current.files.map((view) => (view.path === next.path ? next.view : view));
      return { ...current, files, stats: computeStats(files) };
    });
    return forgeReport(file, next);
  }

  // ───────────── forging ─────────────

  /** Saves `text` as the new text of `path` (call it in turn). */
  async function forgeNow(path: string, text: string): Promise<ForgeReport> {
    assertOpen();
    assertEditable(text);
    const pythonFile = python.get(path);
    if (!pythonFile && !others.has(path)) throw new Error(MESSAGES.unknownFile);
    const report = pythonFile ? await forgePython(pythonFile, text) : await forgeOther(path, text);
    for (const listener of [...listeners]) listener();
    return report;
  }

  /** The text `revert` goes back to. */
  async function originalText(path: string): Promise<string> {
    const pythonFile = python.get(path);
    if (!pythonFile) return others.has(path) ? originalOf(path) : Promise.reject(new Error(MESSAGES.unknownFile));
    if (pythonFile.original === null) throw new Error(MESSAGES.notDownloaded);
    return pythonFile.original;
  }

  // ───────────── changes ─────────────

  /** The FileChange of a modified file whose original is known (cached), or null. */
  function changeOf(path: string, original: string | null, saved: string | null): FileChange | null {
    if (original === null || saved === null || saved === original) return null;
    const cached = changeCache.get(path);
    if (cached && cached.original === original && cached.saved === saved) return cached;
    const change = describeChange(path, original, saved);
    changeCache.set(path, change);
    return change;
  }

  function changes(): FileChange[] {
    const all = [
      ...[...python.values()].map((file) => changeOf(file.path, file.original, file.saved)),
      ...[...others.values()].map((file) => changeOf(file.path, file.original, file.saved)),
    ];
    return all.filter((change): change is FileChange => change !== null).sort((a, b) => comparePaths(a.path, b.path));
  }

  // ───────────── checking while typing ─────────────

  const checkLatest = latestOnly(async (path: string, source: string): Promise<LiveCheck> => {
    let diagnostics;
    try {
      diagnostics = await parts.linter.lint(source);
    } catch (error) {
      throw error instanceof LinterUnavailableError ? error : new Error(MESSAGES.notChecked);
    }
    return liveCheckOf(inspectText({ path }, source, () => diagnostics));
  });

  // ───────────── the contract ─────────────

  return {
    analysis,

    entries() {
      const pythonEntries = [...python.values()].map((file): WorkspaceEntry => ({ path: file.path, size: file.size, kind: "python", modified: file.saved !== file.original }));
      const otherEntries = [...others.values()].map((file): WorkspaceEntry => ({ path: file.path, size: file.size, kind: "other", modified: file.saved !== null }));
      const byPath = (a: WorkspaceEntry, b: WorkspaceEntry) => comparePaths(a.path, b.path);
      return [...pythonEntries.sort(byPath), ...otherEntries.sort(byPath)];
    },

    async read(path) {
      assertOpen();
      const pythonFile = python.get(path);
      if (pythonFile) {
        if (pythonFile.original === null || pythonFile.saved === null) throw new Error(MESSAGES.notDownloaded);
        return { original: pythonFile.original, saved: pythonFile.saved };
      }
      if (!others.has(path)) throw new Error(MESSAGES.unknownFile);
      const original = await originalOf(path);
      return { original, saved: others.get(path)?.saved ?? original };
    },

    /**
     * Requests for one path are answered in the order asked, and only the
     * newest one resolves: an older request that would answer for
     * out-of-date text rejects with SupersededError instead (latestOnly.ts),
     * so a caller can apply every result it receives and ignore that error.
     */
    async check(path, source) {
      assertOpen();
      if (!python.has(path)) throw new Error(others.has(path) ? MESSAGES.pythonOnly : MESSAGES.unknownFile);
      assertEditable(source);
      return checkLatest(path, source);
    },

    async format(source) {
      assertOpen();
      assertEditable(source);
      try {
        return await parts.linter.format(source);
      } catch (error) {
        throw error instanceof LinterUnavailableError ? error : new Error(MESSAGES.notFormatted);
      }
    },

    forge: (path, source) => inTurn(() => forgeNow(path, source)),

    revert: (path) => inTurn(async () => forgeNow(path, await originalText(path))),

    changes,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    exportPatch: () => unifiedDiff(changes()),

    exportZip: () => zipChanges(changes()),

    dispose() {
      if (disposed) return;
      disposed = true;
      parts.linter.dispose();
      listeners.clear();
    },
  };
}

/** A non-Python file was saved: nothing was linted, so there is nothing else to report. */
function notLintedReport(path: string): ForgeReport {
  const nothing = { grade: "C" as const, score: 0, findingCount: 0 };
  return { path, linted: false, fixed: [], introduced: [], kept: [], before: nothing, after: nothing, purified: false, file: null };
}

/** Plain code-point order: the same on every machine (unlike localeCompare). */
function comparePaths(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
