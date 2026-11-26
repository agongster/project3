/**
 * Browser entry point: analyze a real GitHub repo.
 *
 *   1. listing      GET /api/repo           → which Python files, at which commit
 *                   (on a static host there is no server, so the same lookup
 *                   runs here in the browser, without a token)
 *   2. downloading  raw.githubusercontent   → the files' text (8 at a time)
 *   3. linting      Ruff in a Web Worker    → raw diagnostics per file
 *   4. building     analyzeSources()        → RepoAnalysis
 *
 * Every failure becomes an AnalyzeError with a friendly message. Files are
 * downloaded straight from GitHub's CDN by the browser, so our server never
 * sees any source code (and raw downloads don't use up the API rate limit).
 */
import type { ApiErrorBody, ApiErrorCode, RepoAnalysis, RepoListing } from "@/lib/types";
import { STATIC_HOST } from "@/lib/hosting";
import type { RepoTarget } from "@/lib/repo/github";
import { handleRepoRequest } from "@/lib/repo/repoEndpoint";
import { analyzeSources, plural, type SourceFile } from "./analyzeSources";
import { AnalyzeError, throwIfAborted } from "./errors";
import { createLintClient, type LintClient } from "./lintClient";
import type { RawDiagnostic } from "./normalize";
import { progressEvent, type ProgressCallback } from "./progress";

/** How many files are downloaded at the same time. */
export const DOWNLOAD_CONCURRENCY = 8;
/** A single file download is abandoned after this long. */
export const DOWNLOAD_TIMEOUT_MS = 10_000;

/** Things the analysis talks to; tests replace them with fakes. */
export interface AnalyzeDeps {
  fetch: typeof fetch;
  createLintClient: () => Promise<LintClient>;
}

/**
 * Analyzes `owner/repo` (at `ref`, or the default branch).
 * @param onProgress called many times with loading-screen updates
 * @param signal     abort it to cancel; the promise then rejects with code "aborted"
 * @param deps       only for tests
 */
export async function analyzeRepo(
  input: RepoTarget,
  onProgress: ProgressCallback,
  signal?: AbortSignal,
  deps: Partial<AnalyzeDeps> = {},
): Promise<RepoAnalysis> {
  // Wrapped so the browser's fetch is always called with the right `this`.
  const fetchImpl: typeof fetch = deps.fetch ?? ((url, init) => fetch(url, init));
  throwIfAborted(signal);

  // Start loading Ruff right away so it downloads while we talk to GitHub.
  const linterPromise = (deps.createLintClient ?? createLintClient)();
  linterPromise.catch(() => undefined); // handled below; don't report it as "unhandled"

  try {
    onProgress(progressEvent("listing"));
    const listing = await fetchListing(input, fetchImpl, signal);
    const warnings = listingWarnings(listing);

    const files = await downloadFiles(listing, fetchImpl, onProgress, signal);
    const failedDownloads = files.filter((file) => file.source === null).length;
    if (failedDownloads === files.length) {
      throw new AnalyzeError("network", "Couldn't download any files from GitHub. Check your connection and try again.");
    }
    if (failedDownloads > 0) warnings.push(`${plural(failedDownloads, "file")} couldn't be downloaded and appear as ruins.`);

    const linter = await startedLinter(linterPromise);
    const diagnosticsBySource = await lintFiles(files, linter, onProgress, signal);

    onProgress(progressEvent("building"));
    const analysis = analyzeSources(
      { repo: listing.repo, description: listing.description, stars: listing.stars, demo: false, warnings },
      files,
      (source) => lookUpDiagnostics(diagnosticsBySource, source),
    );
    onProgress(progressEvent("done"));
    return analysis;
  } finally {
    linterPromise.then((linter) => linter.dispose(), () => undefined);
  }
}

// ───────────────────────────── Listing ─────────────────────────────

const API_ERROR_CODES: readonly ApiErrorCode[] = ["bad_input", "not_found", "rate_limited", "no_python", "upstream"];

async function fetchListing(input: RepoTarget, fetchImpl: typeof fetch, signal?: AbortSignal): Promise<RepoListing> {
  const params = new URLSearchParams({ repo: `${input.owner}/${input.repo}` });
  if (input.ref) params.set("ref", input.ref);

  let response: Response;
  try {
    response = STATIC_HOST
      ? // The server's own handler, run in the browser. The wrapper keeps `fetch` bound to the window.
        await handleRepoRequest(params, { fetch: (url, init) => fetchImpl(url, init) })
      : await fetchImpl(`/api/repo?${params}`, { signal });
  } catch {
    throwIfAborted(signal);
    throw new AnalyzeError("network", "Couldn't reach the Lintlands server. Check your connection and try again.");
  }

  // A crashed server may answer with an HTML error page instead of JSON.
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || body === null) throw errorFromApiBody(body);
  return body as RepoListing;
}

/** Converts an ApiErrorBody (or anything unexpected) into an AnalyzeError. */
function errorFromApiBody(body: unknown): AnalyzeError {
  const error = (body as Partial<ApiErrorBody> | null)?.error;
  if (error && API_ERROR_CODES.includes(error.code) && typeof error.message === "string") {
    return new AnalyzeError(error.code, error.message, error.retryAfterSec);
  }
  return new AnalyzeError("upstream", "Something went wrong while reading the repo. Try again in a moment.");
}

function listingWarnings(listing: RepoListing): string[] {
  const warnings: string[] = [];
  if (listing.truncated) warnings.push("This repo is so big that GitHub only listed part of it.");
  if (listing.skipped.overCap > 0) {
    warnings.push(`Showing the first ${listing.files.length} Python files (${listing.skipped.overCap} more were left out).`);
  }
  return warnings;
}

// ──────────────────────────── Downloading ────────────────────────────

/** Raw file URL pinned to the exact commit, with each path segment escaped. */
export function rawFileUrl(listing: RepoListing, path: string): string {
  const { owner, repo, sha } = listing.repo;
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `https://raw.githubusercontent.com/${owner}/${repo}/${sha}/${encodedPath}`;
}

async function downloadFiles(listing: RepoListing, fetchImpl: typeof fetch, onProgress: ProgressCallback, signal?: AbortSignal): Promise<SourceFile[]> {
  const total = listing.files.length;
  let done = 0;
  onProgress(progressEvent("downloading", 0, total));

  const files = await mapWithConcurrency(listing.files, DOWNLOAD_CONCURRENCY, async (entry) => {
    throwIfAborted(signal);
    const source = await downloadText(rawFileUrl(listing, entry.path), fetchImpl, signal);
    onProgress(progressEvent("downloading", ++done, total));
    return { path: entry.path, size: entry.size, source };
  });
  throwIfAborted(signal); // downloads cut short by an abort look like failures
  return files;
}

/** Downloads one file as text; null if it fails or takes longer than DOWNLOAD_TIMEOUT_MS. */
async function downloadText(url: string, fetchImpl: typeof fetch, signal?: AbortSignal): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  const abortDownload = () => controller.abort();
  signal?.addEventListener("abort", abortDownload);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    return response.ok ? await response.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abortDownload);
  }
}

/**
 * Like `Promise.all(items.map(task))`, but with at most `limit` tasks running
 * at once. Results keep the order of `items`.
 */
async function mapWithConcurrency<T, R>(items: readonly T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await task(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// ───────────────────────────── Linting ─────────────────────────────

async function startedLinter(linterPromise: Promise<LintClient>): Promise<LintClient> {
  try {
    return await linterPromise;
  } catch (error) {
    console.error("Lintlands: the Ruff lint worker failed to start", error);
    throw new AnalyzeError("linter_failed", "Couldn't start the bug detector. Try reloading the page.");
  }
}

/**
 * Lints every downloaded file. Results are keyed by source text: Ruff's output
 * depends only on the text, so identical files (e.g. many empty __init__.py)
 * are linted once. Files Ruff crashes on are simply left out of the map.
 */
async function lintFiles(files: readonly SourceFile[], linter: LintClient, onProgress: ProgressCallback, signal?: AbortSignal): Promise<Map<string, RawDiagnostic[]>> {
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
    onProgress(progressEvent("linting", i + 1, files.length));
  }
  return diagnosticsBySource;
}

/** The `lint` function handed to analyzeSources: a lookup in the results above. */
function lookUpDiagnostics(diagnosticsBySource: ReadonlyMap<string, RawDiagnostic[]>, source: string): RawDiagnostic[] {
  const diagnostics = diagnosticsBySource.get(source);
  if (diagnostics === undefined) throw new Error("This file could not be linted.");
  return diagnostics;
}
