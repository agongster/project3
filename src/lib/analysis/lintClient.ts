/**
 * Promise-based wrapper around the lint Web Worker (public/lint-worker.js).
 *
 *   const client = await createLintClient();   // loads Ruff's WebAssembly once
 *   const diagnostics = await client.lint(source);
 *   client.dispose();                           // stops the worker
 *
 * Browser-only (it needs `Worker`).
 */
import { BASE_PATH } from "@/lib/hosting";
import type { RawDiagnostic } from "./normalize";
import { RUFF_OPTIONS } from "./rules";

/** Served from /public; the worker itself imports ./ruff/ruff_wasm.js from next to it. */
export const LINT_WORKER_URL = `${BASE_PATH}/lint-worker.js`;
/** Loading ~10 MB of WebAssembly on a slow connection can take a while. */
export const LINT_INIT_TIMEOUT_MS = 30_000;

export interface LintClient {
  /** Lints one file. Rejects if Ruff crashed on this particular file. */
  lint(source: string): Promise<RawDiagnostic[]>;
  /** Stops the worker; pending lint calls are rejected. */
  dispose(): void;
}

/** Messages the worker sends back (mirrors the comment in lint-worker.js). */
type WorkerReply =
  | { type: "ready"; version: string }
  | { type: "init-error"; message: string }
  | { type: "lint-result"; id: number; diagnostics?: RawDiagnostic[]; error?: string };

interface PendingLint {
  resolve: (diagnostics: RawDiagnostic[]) => void;
  reject: (error: Error) => void;
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
  const pending = new Map<number, PendingLint>();
  let nextId = 1;
  let disposed = false;

  function rejectAll(error: Error) {
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  }

  worker.onmessage = (event: MessageEvent<WorkerReply>) => {
    const reply = event.data;
    if (reply.type !== "lint-result") return;
    const request = pending.get(reply.id);
    if (!request) return;
    pending.delete(reply.id);
    if (reply.error !== undefined) request.reject(new Error(reply.error));
    else request.resolve(reply.diagnostics ?? []);
  };
  worker.onerror = (event: ErrorEvent) => {
    event.preventDefault();
    rejectAll(new Error("The bug detector crashed."));
  };

  return {
    lint(source: string) {
      if (disposed) return Promise.reject(new Error("The bug detector was already shut down."));
      const id = nextId++;
      return new Promise<RawDiagnostic[]>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker.postMessage({ type: "lint", id, source });
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      worker.terminate();
      rejectAll(new Error("The bug detector was shut down."));
    },
  };
}
