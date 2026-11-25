/**
 * The logic behind `GET /api/repo?repo=owner/name[&ref=branch]`, kept out of
 * the route file so tests can call it with a fake GitHub.
 *
 *   200 → RepoListing                 (cached by the CDN for 5 minutes)
 *   4xx/5xx → ApiErrorBody            (never cached)
 */
import type { ApiErrorBody, ApiErrorCode } from "@/lib/types";
import { fetchRepoListing, RepoLookupError, type GitHubOptions } from "./github";
import { isValidRef, parseRepoInput } from "./parseRepoInput";

/** Repeat visits within 5 min are free; for 10 more min a stale copy is served while refreshing. */
export const SUCCESS_CACHE_CONTROL = "s-maxage=300, stale-while-revalidate=600";

export const HTTP_STATUS: Record<ApiErrorCode, number> = {
  bad_input: 400,
  not_found: 404,
  rate_limited: 429,
  no_python: 422,
  upstream: 502,
};

export async function handleRepoRequest(params: URLSearchParams, options: GitHubOptions = {}): Promise<Response> {
  const parsed = parseRepoInput(params.get("repo") ?? "");
  if (!parsed.ok) return errorResponse(new RepoLookupError("bad_input", parsed.message));

  // An explicit ?ref= wins over a /tree/<branch> inside a pasted URL.
  const refParam = params.get("ref")?.trim() || undefined;
  if (refParam !== undefined && !isValidRef(refParam)) {
    return errorResponse(new RepoLookupError("bad_input", "That branch name doesn't look right."));
  }

  try {
    const listing = await fetchRepoListing({ owner: parsed.owner, repo: parsed.repo, ref: refParam ?? parsed.ref }, options);
    return Response.json(listing, { headers: { "Cache-Control": SUCCESS_CACHE_CONTROL } });
  } catch (error) {
    if (error instanceof RepoLookupError) return errorResponse(error);
    console.error("/api/repo: unexpected error", error);
    return errorResponse(new RepoLookupError("upstream", "Something went wrong while reading the repo. Try again in a moment."));
  }
}

function errorResponse(error: RepoLookupError): Response {
  const body: ApiErrorBody = { error: { code: error.code, message: error.message } };
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (error.retryAfterSec !== undefined) {
    body.error.retryAfterSec = error.retryAfterSec;
    headers["Retry-After"] = String(error.retryAfterSec);
  }
  return Response.json(body, { status: HTTP_STATUS[error.code], headers });
}
