/**
 * Understands whatever a player types into the "which repo?" box.
 *
 * Accepted (surrounding whitespace is ignored):
 *   owner/repo
 *   owner/repo.git
 *   github.com/owner/repo/            (with or without https://, http://, www.)
 *   https://github.com/owner/repo/tree/feature/login   → ref "feature/login"
 *   https://github.com/owner/repo/issues?q=1            (extra pages are ignored)
 *   git@github.com:owner/repo.git
 *
 * Used both by the landing page (instant feedback) and by /api/repo (never
 * trust the client), so both agree on what a valid repo name is.
 */

export type ParsedRepoInput = { ok: true; owner: string; repo: string; ref?: string } | { ok: false; message: string };

export const BAD_INPUT_MESSAGE = "Try `owner/repo` or a github.com URL.";
const NOT_GITHUB_MESSAGE = "Lintlands only visits GitHub repos. Try `owner/repo` or a github.com URL.";

/** GitHub usernames: letters, digits and single hyphens, max 39 characters. */
const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
/** Repo names: letters, digits, `.`, `_`, `-`, max 100 characters. */
const REPO_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;
/** Branch/tag names: no spaces or the few characters git forbids. */
const REF_PATTERN = /^[^\s~^:?*[\\]+$/;

/** Matches `https://`, `http://`, `www.`, `github.com/` and `git@github.com:` prefixes. */
const GITHUB_PREFIX = /^(?:(?:https?:\/\/)?(?:www\.)?github\.com\/|git@github\.com:)/i;

export function parseRepoInput(text: string): ParsedRepoInput {
  const trimmed = text.trim();
  if (trimmed === "") return fail(BAD_INPUT_MESSAGE);

  const hasGithubPrefix = GITHUB_PREFIX.test(trimmed);
  if (!hasGithubPrefix && looksLikeOtherWebsite(trimmed)) return fail(NOT_GITHUB_MESSAGE);

  const path = trimmed.replace(GITHUB_PREFIX, "").replace(/[?#].*$/, "");
  const segments = path.split("/").filter((segment) => segment !== "");
  if (segments.length < 2) return fail(BAD_INPUT_MESSAGE);

  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/i, "");
  if (!OWNER_PATTERN.test(owner) || !isValidRepoName(repo)) return fail(BAD_INPUT_MESSAGE);

  // A bare "a/b/c" is probably a typo; on a pasted URL, extra pages are fine.
  const rest = segments.slice(2);
  if (rest.length > 0 && !hasGithubPrefix && rest[0] !== "tree") return fail(BAD_INPUT_MESSAGE);

  if (rest[0] === "tree" && rest.length > 1) {
    const ref = safeDecode(rest.slice(1).join("/"));
    if (ref === null || !isValidRef(ref)) return fail(BAD_INPUT_MESSAGE);
    return { ok: true, owner, repo, ref };
  }
  return { ok: true, owner, repo };
}

/** Branch/tag names as git allows them (roughly): no spaces, no `..`, no `~^:?*[\`. */
export function isValidRef(ref: string): boolean {
  return ref.length <= 255 && REF_PATTERN.test(ref) && !ref.includes("..") && !ref.startsWith("/") && !ref.endsWith("/");
}

function isValidRepoName(repo: string): boolean {
  return REPO_PATTERN.test(repo) && repo !== "." && repo !== "..";
}

/**
 * "gitlab.com/a/b" or "https://example.org/x": the first part has a dot or a
 * scheme. GitHub owner names can't contain dots, so this is never a repo.
 */
function looksLikeOtherWebsite(text: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(text) || text.split("/")[0].includes(".");
}

function safeDecode(text: string): string | null {
  try {
    return decodeURIComponent(text);
  } catch {
    return null;
  }
}

function fail(message: string): ParsedRepoInput {
  return { ok: false, message };
}
