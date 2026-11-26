/**
 * Promise-based wrapper around the lint Web Worker (public/lint-worker.js).
 *
 *   const client = await createLintClient();   // loads Ruff's WebAssembly once
 *   const diagnostics = await client.lint(source);
 *   const tidy = await client.format(source);
 *   client.dispose();                           // stops the worker
 *
 * Browser-only (it needs `Worker`). Also home to `lintFiles`, the "lint every
 * file" stage of loading a world, which works with any LintClient.
 */
import { BASE_PATH } from "@/lib/hosting";
import { AnalyzeError, throwIfAborted } from "./errors";
import type { RawDiagnostic } from "./normalize";
import { progressEvent, type ProgressCallback } from "./progress";
import { RUFF_OPTIONS } from "./rules";

/**
 * Version of the messages exchanged with lint-worker.js. It is part of the
 * worker's URL, so a browser that cached an older worker (with other
 * messages) fetches the new one. Bump it whenever the messages change.
 */
export const LINT_WORKER_PROTOCOL = 2;
/** Served from /public; the worker itself imports ./ruff/ruff_wasm.js from next to it. */
export const LINT_WORKER_URL = `${BASE_PATH}/lint-worker.js?v=${LINT_WORKER_PROTOCOL}`;
/** Loading ~10 MB of WebAssembly on a slow connection can take a while. */
export const LINT_INIT_TIMEOUT_MS = 30_000;
/**
 * A single lint or format request that takes longer than this means the
 * worker hung (a file of the maximum size takes well under a second), so it
 * is stopped and every waiting request fails with LinterDiedError.
 */
export const LINT_REQUEST_TIMEOUT_MS = 20_000;

export interface LintClient {
  /** Lints one file. Rejects if Ruff crashed on this particular file. */
  lint(source: string): Promise<RawDiagnostic[]>;
  /** Formats one file with Ruff's formatter. Rejects with Ruff's message if it can't (e.g. a syntax error). */
  format(source: string): Promise<string>;
  /** Stops the worker; pending requests are rejected. */
  dispose(): void;
}

/**
 * The worker itself is gone (it crashed, stopped answering, or was shut
 * down): this client can't be used any more and a new one is needed. Any
 * other rejection means Ruff refused that one text, and the client still works.
 */
export class LinterDiedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LinterDiedError";
  }
}

/** Messages the worker sends back (mirrors the comment in lint-worker.js). */
type WorkerReply =
  | { type: "ready"; version: string }
  | { type: "init-error"; message: string }
  | { type: "result"; id: number; value?: unknown; error?: string };

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** Starts the worker and waits until Ruff is ready. Rejects with a clear Error if it can't load. */
export async function createLintClient(): Promise<LintClient> {
  const worker = new Worker(LINT_WORKER_URL, { type: "module" });
  try {
    await waitUntilReady(worker);
  } catch (error) {
    worker.terminate();
    throw error;
  }
  return connect(worker);
}

/** Sends the Ruff options and waits for "ready", "init-error", a load error or the timeout. */
function waitUntilReady(worker: Worker): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error("The bug detector took too long to load.")), LINT_INIT_TIMEOUT_MS);

    function finish(error?: Error) {
      clearTimeout(timer);
      worker.onmessage = null;
      worker.onerror = null;
      if (error) reject(error);
      else resolve();
    }

    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      if (event.data.type === "ready") finish();
      else if (event.data.type === "init-error") finish(new Error(`The bug detector failed to start: ${event.data.message}`));
    };
    // Fires when the worker script (or its Ruff import) can't be loaded at all.
    worker.onerror = (event: ErrorEvent) => {
      event.preventDefault();
      finish(new Error(`The bug detector failed to load${event.message ? `: ${event.message}` : "."}`));
    };
    worker.postMessage({ type: "init", options: RUFF_OPTIONS });
  });
}

/** Wires up request/response matching by id once the worker is ready. */
function connect(worker: Worker): LintClient {
  const pending = new Map<number, PendingRequest>();
  let nextId = 1;
  /** Set once the worker is gone; every later request fails with it. */
  let death: LinterDiedError | null = null;

  /** Stops the worker for good and fails every waiting request. */
  function die(error: LinterDiedError) {
    if (death) return;
    death = error;
    worker.terminate();
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    pending.clear();
  }

  worker.onmessage = (event: MessageEvent<WorkerReply>) => {
    const reply = event.data;
    if (reply.type !== "result") return;
    const request = pending.get(reply.id);
    if (!request) return;
    pending.delete(reply.id);
    clearTimeout(request.timer);
    if (reply.error !== undefined) request.reject(new Error(reply.error));
    else request.resolve(reply.value);
  };
  worker.onerror = (event: ErrorEvent) => {
    event.preventDefault();
    die(new LinterDiedError("The bug detector crashed."));
  };

  function request(type: "lint" | "format", source: string): Promise<unknown> {
    if (death) return Promise.reject(death);
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => die(new LinterDiedError("The bug detector stopped answering.")), LINT_REQUEST_TIMEOUT_MS);
      pending.set(id, { resolve, reject, timer });
      worker.postMessage({ type, id, source });
    });
  }

  return {
    async lint(source) {
      const value = await request("lint", source);
      return Array.isArray(value) ? (value as RawDiagnostic[]) : [];
    },
    async format(source) {
      const value = await request("format", source);
      if (typeof value !== "string") throw new Error("The formatter returned no text.");
      return value;
    },
    dispose() {
      die(new LinterDiedError("The bug detector was shut down."));
    },
  };
}

// ───────────────────────── The linting stage ─────────────────────────

/** Waits for a client that was started earlier; a failure becomes the friendly "linter_failed" AnalyzeError. */
export async function startedLinter(linterPromise: Promise<LintClient>): Promise<LintClient> {
  try {
    return await linterPromise;
  } catch (error) {
    console.error("Lintlands: the Ruff lint worker failed to start", error);
    throw new AnalyzeError("linter_failed", "Couldn't start the bug detector. Try reloading the page.");
  }
}

/** One file to lint; `source` is null when it could not be downloaded. */
export interface LintInput {
  path: string;
  source: string | null;
}

/**
 * Lints every downloaded file, reporting "linting i/n" progress. Results are
 * keyed by source text: Ruff's output depends only on the text, so identical
 * files (e.g. many empty __init__.py) are linted once. Files Ruff crashes on
 * are left out of the map (they become ruins).
 * @param afterEach awaited after each file (the demo pauses there so the loading screen is visible)
 */
export async function lintFiles(
  files: readonly LintInput[],
  linter: LintClient,
  onProgress: ProgressCallback,
  signal?: AbortSignal,
  afterEach?: () => Promise<void>,
): Promise<Map<string, RawDiagnostic[]>> {
  const diagnosticsBySource = new Map<string, RawDiagnostic[]>();
  onProgress(progressEvent("linting", 0, files.length));
  for (let i = 0; i < files.length; i++) {
    throwIfAborted(signal);
    const source = files[i].source;
    if (source !== null && !diagnosticsBySource.has(source)) {
      try {
        diagnosticsBySource.set(source, await linter.lint(source));
      } catch (error) {
        console.warn(`Lintlands: Ruff could not lint ${files[i].path}`, error);
      }
    }
    await afterEach?.();
    onProgress(progressEvent("linting", i + 1, files.length));
  }
  return diagnosticsBySource;
}
