/**
 * The one error type the analysis pipeline throws. The UI can switch on
 * `code` (to show the right screen) and show `message` as-is (it is already
 * friendly).
 */
import type { ApiErrorCode } from "@/lib/types";

export type AnalyzeErrorCode =
  | ApiErrorCode // problems reported by /api/repo (bad input, not found, rate limited, …)
  | "aborted" // the caller cancelled via AbortSignal
  | "linter_failed" // Ruff's WebAssembly could not be loaded
  | "network"; // the browser could not reach our server or GitHub

export class AnalyzeError extends Error {
  readonly code: AnalyzeErrorCode;
  /** Only for "rate_limited": seconds until GitHub allows new requests. */
  readonly retryAfterSec?: number;

  constructor(code: AnalyzeErrorCode, message: string, retryAfterSec?: number) {
    super(message);
    this.name = "AnalyzeError";
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }
}

/** Thrown whenever the caller's AbortSignal fires. */
export function abortedError(): AnalyzeError {
  return new AnalyzeError("aborted", "Analysis cancelled.");
}

/** Throws the "aborted" error if the signal has fired; call between steps. */
export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw abortedError();
}
