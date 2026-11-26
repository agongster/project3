import { describe, expect, it } from "vitest";
import { BRANCH_CACHE_SEC, COMMIT_CACHE_SEC, fetchRepoListing, RepoLookupError } from "@/lib/repo/github";
import { handleRepoRequest } from "@/lib/repo/repoEndpoint";
import type { ApiErrorBody, RepoListing } from "@/lib/types";

const SHA = "a".repeat(40);
const NOW_MS = 1_700_000_000_000;

interface FakeCall {
  url: string;
  headers: Record<string, string>;
  /** How long Next.js may reuse the answer (the `next.revalidate` fetch option), in seconds. */
  cacheSec: number | undefined;
}

/** A fake GitHub: maps URL substrings to responses, and records every call. */
function fakeGitHub(routes: Record<string, () => Response>) {
  const calls: FakeCall[] = [];
  const fetchFake = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const revalidate = init?.next?.revalidate;
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string>, cacheSec: typeof revalidate === "number" ? revalidate : undefined });
    const route = Object.keys(routes).find((pattern) => url.includes(pattern));
    return route ? routes[route]() : new Response("not found", { status: 404 });
  }) as typeof fetch;
  return { fetch: fetchFake, calls };
}

const repoInfo = () => Response.json({ name: "Shop", owner: { login: "Bakery" }, default_branch: "main", description: "Pastries", stargazers_count: 42 });
const commitSha = () => new Response(SHA);
const tree = (paths: string[], truncated = false) => () =>
  Response.json({ truncated, tree: paths.map((path) => ({ path, type: "blob", mode: "100644", size: 1234 })) });

describe("fetchRepoListing", () => {
  it("lists Python files (and other text files) at the resolved commit", async () => {
    // After the first call, GitHub's own spelling ("Bakery/Shop") is used.
    const github = fakeGitHub({
      "/repos/Bakery/Shop/commits/main": commitSha,
      [`/git/trees/${SHA}?recursive=1`]: tree(["app.py", "README.md", "venv/x.py", "pkg/util.py"]),
      "/repos/bakery/shop": repoInfo,
    });
    const listing = await fetchRepoListing({ owner: "bakery", repo: "shop" }, { fetch: github.fetch });

    expect(listing).toEqual<RepoListing>({
      repo: { owner: "Bakery", repo: "Shop", ref: "main", sha: SHA },
      description: "Pastries",
      stars: 42,
      files: [
        { path: "app.py", size: 1234 },
        { path: "pkg/util.py", size: 1234 },
      ],
      otherFiles: [{ path: "README.md", size: 1234 }],
      skipped: { vendored: 1, tooLarge: 0, overCap: 0 },
      truncated: false,
    });
    expect(github.calls).toHaveLength(3);
    expect(github.calls[0].headers["User-Agent"]).toBeTruthy();
    expect(github.calls[0].headers["X-GitHub-Api-Version"]).toBeTruthy();
    expect(github.calls[0].headers.Authorization).toBeUndefined();
  });

  it("asks Next.js to cache every GitHub answer, the commit's file tree for much longer", async () => {
    const github = fakeGitHub({
      "/commits/main": commitSha,
      "/git/trees/": tree(["a.py"]),
      "/repos/bakery/shop": repoInfo,
    });
    await fetchRepoListing({ owner: "bakery", repo: "shop" }, { fetch: github.fetch });
    // Order of calls: repo details, branch → commit, the commit's tree.
    expect(github.calls.map((call) => call.cacheSec)).toEqual([BRANCH_CACHE_SEC, BRANCH_CACHE_SEC, COMMIT_CACHE_SEC]);
    expect(COMMIT_CACHE_SEC).toBeGreaterThan(BRANCH_CACHE_SEC);
  });

  it("sends the token only as a Bearer header, and keeps slashes in branch names", async () => {
    const github = fakeGitHub({
      "/commits/feature/login": commitSha,
      "/git/trees/": tree(["a.py"]),
      "/repos/bakery/shop": repoInfo,
    });
    const listing = await fetchRepoListing({ owner: "bakery", repo: "shop", ref: "feature/login" }, { fetch: github.fetch, token: "secret-token" });
    expect(listing.repo.ref).toBe("feature/login");
    for (const call of github.calls) expect(call.headers.Authorization).toBe("Bearer secret-token");
  });

  it("maps 404 to not_found", async () => {
    const github = fakeGitHub({});
    await expect(fetchRepoListing({ owner: "nobody", repo: "nothing" }, { fetch: github.fetch })).rejects.toMatchObject({
      code: "not_found",
      message: expect.stringContaining("public repos"),
    });
  });

  it("maps an exhausted rate limit to rate_limited with the seconds until reset", async () => {
    const resetAt = NOW_MS / 1000 + 600;
    const github = fakeGitHub({
      "/repos/": () => new Response("{}", { status: 403, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(resetAt) } }),
    });
    const error = await fetchRepoListing({ owner: "a", repo: "b" }, { fetch: github.fetch, now: () => NOW_MS }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RepoLookupError);
    expect(error).toMatchObject({ code: "rate_limited", retryAfterSec: 600, message: expect.stringContaining("10 minutes") });
  });

  it("treats a 403 without rate-limit headers as an upstream problem", async () => {
    const github = fakeGitHub({ "/repos/": () => new Response("{}", { status: 403 }) });
    await expect(fetchRepoListing({ owner: "a", repo: "b" }, { fetch: github.fetch })).rejects.toMatchObject({ code: "upstream" });
  });

  it("reports no_python when nothing survives the filter", async () => {
    const github = fakeGitHub({
      "/commits/": commitSha,
      "/git/trees/": tree(["index.js", "node_modules/x.py"]),
      "/repos/bakery/shop": repoInfo,
    });
    await expect(fetchRepoListing({ owner: "bakery", repo: "shop" }, { fetch: github.fetch })).rejects.toMatchObject({ code: "no_python" });
  });

  it("maps network failures to upstream", async () => {
    const failing = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    await expect(fetchRepoListing({ owner: "a", repo: "b" }, { fetch: failing })).rejects.toMatchObject({ code: "upstream" });
  });
});

describe("handleRepoRequest (/api/repo)", () => {
  const request = (query: string) => handleRepoRequest(new URLSearchParams(query), { fetch: fakeGitHub({}).fetch });

  it("rejects bad input with 400 before calling GitHub", async () => {
    const response = await request("repo=not a repo");
    expect(response.status).toBe(400);
    const body = (await response.json()) as ApiErrorBody;
    expect(body.error.code).toBe("bad_input");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 404 for unknown repos", async () => {
    const response = await request("repo=https://github.com/nobody/nothing");
    expect(response.status).toBe(404);
    expect(((await response.json()) as ApiErrorBody).error.code).toBe("not_found");
  });

  it("returns 429 with Retry-After when rate limited", async () => {
    const github = fakeGitHub({ "/repos/": () => new Response("{}", { status: 429, headers: { "retry-after": "30" } }) });
    const response = await handleRepoRequest(new URLSearchParams("repo=a/b"), { fetch: github.fetch });
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(((await response.json()) as ApiErrorBody).error).toMatchObject({ code: "rate_limited", retryAfterSec: 30 });
  });

  it("returns the listing with CDN caching on success", async () => {
    const github = fakeGitHub({ "/commits/": commitSha, "/git/trees/": tree(["a.py"]), "/repos/bakery/shop": repoInfo });
    const response = await handleRepoRequest(new URLSearchParams("repo=bakery/shop&ref=dev"), { fetch: github.fetch });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=300");
    expect(((await response.json()) as RepoListing).repo.ref).toBe("dev");
    expect(github.calls[1].url).toContain("/commits/dev");
  });
});
