/**
 * Loading a real GitHub repo for the workspace:
 *
 *   1. listing      GET /api/repo           → which files, at which commit
 *                   (on a static host there is no server, so the same lookup
 *                   runs here in the browser, without a token)
 *   2. downloading  raw.githubusercontent   → the Python files' text (8 at a
 *                                             time), and the README for the
 *                                             town's welcome
 *   later           raw.githubusercontent   → any other text file, the first
 *                                             time the player opens it
 *
 * Every failure of steps 1–2 becomes an AnalyzeError with a friendly message.
 * Files are downloaded straight from GitHub's CDN by the browser, so our
 * server never sees any source code (and raw downloads don't use up the API
 * rate limit).
 */
import type { ApiErrorBody, ApiErrorCode, RepoListing } from "@/lib/types";
import { plural, type SourceFile } from "@/lib/analysis/analyzeSources";
import { AnalyzeError, throwIfAborted } from "@/lib/analysis/errors";
import { progressEvent, type ProgressCallback } from "@/lib/analysis/progress";
import { readmeBlurb } from "@/lib/analysis/readme";
import { STATIC_HOST } from "@/lib/hosting";
import type { RepoTarget } from "@/lib/repo/github";
import { handleRepoRequest } from "@/lib/repo/repoEndpoint";
import { NO_PACING, type WorkspaceSource } from "./sources";

/** How many files are downloaded at the same time. */
export const DOWNLOAD_CONCURRENCY = 8;
/** A single file download is abandoned after this long. */
export const DOWNLOAD_TIMEOUT_MS = 10_000;
/** README file names tried, in this order (the first one that exists wins). */
export const README_NAMES: readonly string[] = ["README.md", "readme.md", "README.rst", "README"];

/**
 * Lists and downloads `owner/repo` (at `ref`, or the default branch).
 * @param fetchImpl the browser's fetch (tests pass a fake GitHub)
 */
export async function repoSource(target: RepoTarget, onProgress: ProgressCallback, signal: AbortSignal | undefined, fetchImpl: typeof fetch): Promise<WorkspaceSource> {
  onProgress(progressEvent("listing"));
  const listing = await fetchListing(target, fetchImpl, signal);
  const warnings = listingWarnings(listing);

  // The README downloads alongside the code; it never holds the load up (see openWorkspace).
  const readmePromise = fetchReadmeBlurb(listing, fetchImpl, signal);
  const python = await downloadFiles(listing, fetchImpl, onProgress, signal);
  const failedDownloads = python.filter((file) => file.source === null).length;
  if (failedDownloads === python.length) {
    throw new AnalyzeError("network", "Couldn't download any files from GitHub. Check your connection and try again.");
  }
  if (failedDownloads > 0) warnings.push(`${plural(failedDownloads, "file")} couldn't be downloaded and appear as ruins.`);

  return {
    meta: { repo: listing.repo, description: listing.description, stars: listing.stars, demo: false, warnings },
    readme: readmePromise,
    python,
    others: Array.isArray(listing.otherFiles) ? listing.otherFiles : [],
    fetchOther: (path) => downloadOtherFile(listing, path, fetchImpl),
    pacing: NO_PACING,
  };
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
export function rawFileUrl(listing: Pick<RepoListing, "repo">, path: string): string {
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

/** One non-Python file's text, for the Workshop. Rejects with a message the player can read. */
export async function downloadOtherFile(listing: Pick<RepoListing, "repo">, path: string, fetchImpl: typeof fetch): Promise<string> {
  const text = await downloadText(rawFileUrl(listing, path), fetchImpl);
  if (text === null) throw new Error(`Couldn't download ${path} from GitHub. Check your connection and try again.`);
  return text;
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

// ─────────────────────────────── README ───────────────────────────────

/**
 * The repo's README as a short blurb for the town's welcome (see readme.ts),
 * or null. Tries README_NAMES in order from the raw-file CDN, which does not
 * count against the GitHub API budget. Never throws: a missing or broken
 * README just means the guide falls back to the description.
 */
export async function fetchReadmeBlurb(listing: Pick<RepoListing, "repo">, fetchImpl: typeof fetch, signal?: AbortSignal): Promise<string | null> {
  for (const name of README_NAMES) {
    if (signal?.aborted) return null;
    const text = await downloadText(rawFileUrl(listing, name), fetchImpl, signal);
    if (text !== null) return readmeBlurb(text);
  }
  return null;
}
