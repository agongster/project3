/**
 * The workspace's Ruff worker, kept alive for as long as the world is open.
 *
 * If the worker dies (the browser killed it, it crashed, or it stopped
 * answering), the request that noticed starts a fresh worker and is retried
 * on it, so the player never has to reload the page because of it. If Ruff
 * merely rejects one particular text, nothing is restarted: that error is
 * passed on unchanged.
 */
import { LinterDiedError, type LintClient } from "@/lib/analysis/lintClient";
import type { RawDiagnostic } from "@/lib/analysis/normalize";

/** Shown when no worker can be started (or every one dies) for a request. */
export const LINTER_UNAVAILABLE_MESSAGE = "The bug detector stopped working. Reload the page to wake it up.";

/** No Ruff worker could be had for a request (as opposed to Ruff rejecting one text). */
export class LinterUnavailableError extends Error {
  constructor() {
    super(LINTER_UNAVAILABLE_MESSAGE);
    this.name = "LinterUnavailableError";
  }
}

/** A request is tried on at most this many workers (the first, plus one fresh restart). */
export const LINT_ATTEMPTS = 2;

export interface Linter {
  lint(source: string): Promise<RawDiagnostic[]>;
  format(source: string): Promise<string>;
  /** Stops the worker for good; later requests reject. */
  dispose(): void;
}

/**
 * @param first   the worker that analyzed the repo while it loaded
 * @param restart starts a new worker (createLintClient in the browser)
 */
export function superviseLinter(first: LintClient, restart: () => Promise<LintClient>): Linter {
  /** The worker in use, or null when the next request must start a new one. */
  let current: Promise<LintClient> | null = Promise.resolve(first);
  let disposed = false;

  function client(): Promise<LintClient> {
    if (current === null) {
      const starting = restart();
      current = starting;
      // A worker that fails to start is forgotten, so the next request tries again.
      starting.catch(() => {
        if (current === starting) current = null;
      });
    }
    return current;
  }

  async function withClient<T>(task: (client: LintClient) => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      if (disposed) throw new Error("This world was closed.");
      const pending = client();
      let worker: LintClient;
      try {
        worker = await pending;
      } catch (error) {
        console.error("Lintlands: the Ruff lint worker could not be restarted", error);
        throw new LinterUnavailableError();
      }
      try {
        return await task(worker);
      } catch (error) {
        if (!(error instanceof LinterDiedError) || disposed) throw error;
        if (current === pending) current = null; // that worker is gone: the next try starts a new one
        if (attempt >= LINT_ATTEMPTS) throw new LinterUnavailableError();
      }
    }
  }

  return {
    lint: (source) => withClient((worker) => worker.lint(source)),
    format: (source) => withClient((worker) => worker.format(source)),
    dispose() {
      if (disposed) return;
      disposed = true;
      current?.then((worker) => worker.dispose(), () => undefined);
      current = null;
    },
  };
}
