/**
 * Opening a world: GitHub repo or Demo Kingdom → Workspace.
 *
 *   1. listing + downloading   repoSource() / demoSource()     → the files' text
 *   2. stored edits            storedEdits.ts                  → the player's saved texts
 *   3. linting                 Ruff in a Web Worker            → diagnostics of every original
 *   4. building                pythonFile.ts + analyzeSources  → the analysis, edits applied
 *
 * The loading screen sees the same progress events and the same AnalyzeErrors
 * as it always did. Unlike the old analysis-only pipeline, nothing is thrown
 * away at the end: the files' text and the live Ruff worker stay in the
 * returned Workspace, and the player's stored edits are applied before the
 * analysis is first published, so a returning player sees their edited world.
 */
import { assembleAnalysis, type LintFunction } from "@/lib/analysis/analyzeSources";
import { pause } from "@/lib/analysis/demo";
import { throwIfAborted } from "@/lib/analysis/errors";
import { createLintClient, lintFiles, startedLinter, type LintClient } from "@/lib/analysis/lintClient";
import type { RawDiagnostic } from "@/lib/analysis/normalize";
import { progressEvent, type ProgressCallback } from "@/lib/analysis/progress";
import { repoKey } from "@/game/bridge";
import type { RepoTarget } from "@/lib/repo/github";
import type { Workspace } from "./contract";
import { superviseLinter } from "./linter";
import { createPythonFile } from "./pythonFile";
import { repoSource } from "./repoSource";
import { demoSource, type WorkspaceSource } from "./sources";
import { createEditStore, type EditStorage, type RepoEdits } from "./storedEdits";
import { createWorkspace, type OtherFile } from "./workspace";

/** Once the code is linted, wait at most this long for a README that is still downloading. */
export const README_GRACE_MS = 300;

/** Which world to open: the offline demo, or a GitHub repo. */
export type WorkspaceTarget = { kind: "demo" } | ({ kind: "repo" } & RepoTarget);

/** Things a workspace talks to; tests replace them with fakes. */
export interface WorkspaceDeps {
  fetch: typeof fetch;
  createLintClient: () => Promise<LintClient>;
  /** Where edits are remembered: localStorage by default; null keeps them only until the tab closes. */
  storage: EditStorage | null;
  /** The demo's artificial pauses (tests pass an instant one). */
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
}

/**
 * Opens a world for playing and editing.
 * @param onProgress called many times with loading-screen updates
 * @param signal     abort it to cancel; the promise then rejects with code "aborted"
 * @param deps       only for tests
 */
export async function openWorkspace(target: WorkspaceTarget, onProgress: ProgressCallback, signal?: AbortSignal, deps: Partial<WorkspaceDeps> = {}): Promise<Workspace> {
  // Wrapped so the browser's fetch is always called with the right `this`.
  const fetchImpl: typeof fetch = deps.fetch ?? ((url, init) => fetch(url, init));
  const startLinter = deps.createLintClient ?? createLintClient;
  const sleep = deps.sleep ?? pause;
  throwIfAborted(signal);

  // Start loading Ruff right away so it downloads while we talk to GitHub.
  const linterPromise = startLinter();
  linterPromise.catch(() => undefined); // handled by startedLinter
  let handedOver = false;

  try {
    const source = target.kind === "demo" ? await demoSource(onProgress, signal, sleep) : await repoSource(target, onProgress, signal, fetchImpl);
    const key = repoKey(source.meta);
    const edits = createEditStore(deps.storage);
    const stored = edits.load(key, new Set([...source.python, ...source.others].map((file) => file.path)));
    const otherFiles = loadEditedOthers(source, stored);

    const linter = await startedLinter(linterPromise);
    const lintPause = () => sleep(source.pacing.perLint, signal);
    const diagnosticsBySource = await lintFiles(source.python, linter, onProgress, signal, lintPause);

    onProgress(progressEvent("building"));
    // The player's saved texts were not linted above: lint them now (usually only a few).
    await lintEditedTexts(source, stored, linter, diagnosticsBySource, signal);
    const lint = lookUpDiagnostics(diagnosticsBySource);
    const python = source.python.map((file) => createPythonFile(file, stored.get(file.path) ?? null, lint));
    const readme = await arrivedInTime(source.readme, README_GRACE_MS);
    const lintFailures = python.filter((file) => file.original !== null && file.view.status === "failed").length;
    const analysis = assembleAnalysis({ ...source.meta, readme }, python.map((file) => file.view), lintFailures);
    const others = await otherFiles;
    await sleep(source.pacing.building, signal);
    throwIfAborted(signal);

    const workspace = createWorkspace({
      repoKey: key,
      analysis,
      python,
      others,
      fetchOther: source.fetchOther,
      linter: superviseLinter(linter, startLinter),
      edits,
    });
    handedOver = true;
    onProgress(progressEvent("done"));
    return workspace;
  } finally {
    if (!handedOver) linterPromise.then((linter) => linter.dispose(), () => undefined);
  }
}

/**
 * The non-Python files. The ones with stored edits get their original
 * downloaded now (alongside linting), so the list of changes and the
 * exports can show them; if that download fails, the file opens as unedited
 * this time and its stored edit waits for the next visit.
 */
async function loadEditedOthers(source: WorkspaceSource, stored: RepoEdits): Promise<OtherFile[]> {
  return Promise.all(
    source.others.map(async (entry): Promise<OtherFile> => {
      const saved = stored.get(entry.path);
      if (saved === undefined) return { path: entry.path, size: entry.size, original: null, saved: null };
      const original = await source.fetchOther(entry.path).catch(() => null);
      if (original === null) return { path: entry.path, size: entry.size, original: null, saved: null };
      return { path: entry.path, size: entry.size, original, saved: saved === original ? null : saved };
    }),
  );
}

/** Lints each stored saved text that differs from its original and wasn't linted yet. */
async function lintEditedTexts(
  source: WorkspaceSource,
  stored: RepoEdits,
  linter: LintClient,
  diagnosticsBySource: Map<string, RawDiagnostic[]>,
  signal?: AbortSignal,
): Promise<void> {
  for (const file of source.python) {
    const saved = stored.get(file.path);
    if (file.source === null || saved === undefined || diagnosticsBySource.has(saved)) continue;
    throwIfAborted(signal);
    try {
      diagnosticsBySource.set(saved, await linter.lint(saved));
    } catch (error) {
      console.warn(`Lintlands: Ruff could not lint the edited ${file.path}`, error);
    }
  }
}

/** The `lint` function handed to the analysis: a lookup in the results above (a miss means Ruff failed on that text). */
function lookUpDiagnostics(diagnosticsBySource: ReadonlyMap<string, RawDiagnostic[]>): LintFunction {
  return (source) => {
    const diagnostics = diagnosticsBySource.get(source);
    if (diagnostics === undefined) throw new Error("This file could not be linted.");
    return diagnostics;
  };
}

/** `promise`'s value if it settles within `ms`, otherwise null (the promise is then simply ignored). */
function arrivedInTime<T>(promise: Promise<T | null>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}
