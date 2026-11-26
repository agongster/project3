/**
 * Server-side GitHub client: turns "owner/repo" into a RepoListing (which
 * Python files exist at which exact commit).
 *
 * Three REST calls per repo:
 *   1. GET /repos/{owner}/{repo}                    → default branch, description, stars
 *   2. GET /repos/{owner}/{repo}/commits/{ref}      → the commit SHA the branch points at
 *   3. GET /repos/{owner}/{repo}/git/trees/{sha}    → every file path + size at that commit
 *
 * Successful answers are kept in Next.js's server-side cache (see the
 * `*_CACHE_SEC` constants), so a popular repo costs three GitHub calls every
 * few minutes instead of three per visitor. That matters because every
 * visitor shares this server's GitHub rate limit.
 *
 * `fetch` is injectable so tests can fake GitHub without any network.
 * The token (if any) is only ever put in the Authorization header: it is never
 * logged and never included in a response.
 */
import type { ApiErrorCode, RepoListing } from "@/lib/types";
import { filterFiles, type TreeEntry } from "./filterFiles";

export const GITHUB_API = "https://api.github.com";
/** Give up on a single GitHub call after this long (serverless functions are time-limited). */
export const GITHUB_TIMEOUT_MS = 10_000;
/** Repo details and "which commit is this branch on?" can change, so re-ask after 5 minutes. */
export const BRANCH_CACHE_SEC = 300;
/** The file tree of one exact commit can never change, so it is kept for a day. */
export const COMMIT_CACHE_SEC = 86_400;
/** Used when GitHub says "rate limited" without saying until when. */
const UNKNOWN_RATE_LIMIT_WAIT_SEC = 60;

export const MESSAGES = {
  notFound: "Couldn't find that repo. Lintlands only works with public repos.",
  noPython: "No Python found here. Try a Python repo!",
  emptyRepo: "That repo is empty — there's nothing to explore yet.",
  unreachable: "Couldn't reach GitHub. Try again in a moment.",
} as const;

/** What to look up. `ref` is a branch, tag or commit; the default branch if omitted. */
export interface RepoTarget {
  owner: string;
  repo: string;
  ref?: string;
}

export interface GitHubOptions {
  /** Defaults to the global fetch. Tests pass a fake. */
  fetch?: typeof fetch;
  /** Optional GitHub token (raises the rate limit from 60 to 5,000 requests/hour). */
  token?: string;
  /** Current time in ms; injectable so rate-limit tests are deterministic. */
  now?: () => number;
}

/** A failure we can explain to the player. Maps 1:1 onto ApiErrorBody. */
export class RepoLookupError extends Error {
  readonly code: ApiErrorCode;
  readonly retryAfterSec?: number;

  constructor(code: ApiErrorCode, message: string, retryAfterSec?: number) {
    super(message);
    this.name = "RepoLookupError";
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }
}

/** Fetches repo metadata and its filtered Python file list. Throws RepoLookupError. */
export async function fetchRepoListing(target: RepoTarget, options: GitHubOptions = {}): Promise<RepoListing> {
  const github = new GitHubCalls(options);

  const info = await github.json<RepoInfo>(`/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}`, MESSAGES.notFound, BRANCH_CACHE_SEC);
  // Use GitHub's spelling of the names (it also follows renamed repos).
  const owner = info.owner?.login ?? target.owner;
  const repo = info.name ?? target.repo;
  const ref = target.ref ?? info.default_branch;
  const repoPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  const sha = await github.commitSha(`${repoPath}/commits/${encodeRef(ref)}`, `Couldn't find a branch or tag called “${ref}” in ${owner}/${repo}.`);
  const tree = await github.json<TreeResponse>(`${repoPath}/git/trees/${sha}?recursive=1`, MESSAGES.notFound, COMMIT_CACHE_SEC);

  const { files, skipped } = filterFiles(tree.tree ?? []);
  if (files.length === 0) throw new RepoLookupError("no_python", MESSAGES.noPython);

  return {
    repo: { owner, repo, ref, sha },
    description: info.description ?? null,
    stars: info.stargazers_count ?? 0,
    files,
    skipped,
    truncated: tree.truncated === true,
  };
}

// ───────────────────────── GitHub responses ─────────────────────────

/** The fields of GET /repos/{owner}/{repo} that we use. */
interface RepoInfo {
  name?: string;
  owner?: { login?: string };
  default_branch: string;
  description?: string | null;
  stargazers_count?: number;
}

/** The fields of GET /repos/{owner}/{repo}/git/trees/{sha} that we use. */
interface TreeResponse {
  tree?: TreeEntry[];
  truncated?: boolean;
}

// ─────────────────────────── HTTP helpers ───────────────────────────

/** Branch names may contain slashes ("feature/login"): encode each part separately. */
function encodeRef(ref: string): string {
  return ref.split("/").map(encodeURIComponent).join("/");
}

/** Small wrapper that adds headers and turns HTTP failures into RepoLookupErrors. */
class GitHubCalls {
  private readonly fetchImpl: typeof fetch;
  private readonly token?: string;
  private readonly now: () => number;

  constructor(options: GitHubOptions) {
    this.fetchImpl = options.fetch ?? fetch;
    this.token = options.token || undefined;
    this.now = options.now ?? Date.now;
  }

  async json<T>(path: string, notFoundMessage: string, cacheSec: number): Promise<T> {
    const response = await this.get(path, "application/vnd.github+json", notFoundMessage, cacheSec);
    try {
      return (await response.json()) as T;
    } catch {
      throw new RepoLookupError("upstream", "GitHub sent back something unexpected. Try again in a moment.");
    }
  }

  /** The `vnd.github.sha` media type makes GitHub answer with just the 40-character SHA. */
  async commitSha(path: string, notFoundMessage: string): Promise<string> {
    const response = await this.get(path, "application/vnd.github.sha", notFoundMessage, BRANCH_CACHE_SEC);
    const sha = (await response.text()).trim();
    if (!/^[0-9a-f]{40}$/.test(sha)) throw new RepoLookupError("upstream", "GitHub sent back something unexpected. Try again in a moment.");
    return sha;
  }

  private async get(path: string, accept: string, notFoundMessage: string, cacheSec: number): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: accept,
      "User-Agent": "lintlands",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    let response: Response;
    try {
      // `next.revalidate` is Next.js's extension to fetch: reuse a stored 200 answer for this many seconds.
      response = await this.fetchImpl(`${GITHUB_API}${path}`, {
        headers,
        signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
        next: { revalidate: cacheSec },
      });
    } catch {
      throw new RepoLookupError("upstream", MESSAGES.unreachable);
    }
    if (!response.ok) throw this.errorFor(response, notFoundMessage);
    return response;
  }

  /** Maps a failed GitHub response onto one of our error codes. */
  private errorFor(response: Response, notFoundMessage: string): RepoLookupError {
    const retryAfterSec = this.rateLimitWait(response);
    if (retryAfterSec !== null) {
      const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
      return new RepoLookupError("rate_limited", `GitHub needs a breather — try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`, retryAfterSec);
    }
    // 422 = "No commit found for SHA" when a branch doesn't exist.
    if (response.status === 404 || response.status === 422) return new RepoLookupError("not_found", notFoundMessage);
    // 409 = "Git Repository is empty."
    if (response.status === 409) return new RepoLookupError("no_python", MESSAGES.emptyRepo);
    return new RepoLookupError("upstream", `GitHub had a hiccup (HTTP ${response.status}). Try again in a moment.`);
  }

  /**
   * Seconds until we may call GitHub again, or null if this isn't a rate
   * limit. GitHub signals the primary limit with `x-ratelimit-remaining: 0`
   * plus a reset time (Unix seconds), and secondary limits with `retry-after`.
   */
  private rateLimitWait(response: Response): number | null {
    if (response.status !== 403 && response.status !== 429) return null;
    const retryAfter = Number(response.headers.get("retry-after"));
    if (retryAfter > 0) return Math.ceil(retryAfter);
    if (response.headers.get("x-ratelimit-remaining") !== "0") return null;
    const resetAtSec = Number(response.headers.get("x-ratelimit-reset") ?? NaN);
    if (!Number.isFinite(resetAtSec)) return UNKNOWN_RATE_LIMIT_WAIT_SEC;
    return Math.max(1, Math.ceil(resetAtSec - this.now() / 1000));
  }
}
