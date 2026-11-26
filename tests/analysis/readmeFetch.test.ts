/**
 * The README is fetched from the raw-file CDN alongside the code: it tries
 * the common names in order and never breaks or slows the load.
 */
import { describe, expect, it } from "vitest";
import { analyzeRepo, fetchReadmeBlurb, README_NAMES } from "@/lib/analysis/analyzeRepo";
import type { LintClient } from "@/lib/analysis/lintClient";
import type { RepoListing } from "@/lib/types";
import { createNodeLint } from "./nodeLint";

const SHA = "c".repeat(40);
const LISTING: RepoListing = {
  repo: { owner: "tea", repo: "pot", ref: "main", sha: SHA },
  description: "A teapot",
  stars: 1,
  files: [{ path: "pot.py", size: 10 }],
  skipped: { vendored: 0, tooLarge: 0, overCap: 0 },
  truncated: false,
};
const raw = (path: string) => `https://raw.githubusercontent.com/tea/pot/${SHA}/${path}`;

/** A fake network: the listing API, the code, and whichever README files `readmes` holds. */
function fakeFetch(readmes: Record<string, string>, requested: string[] = []): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    requested.push(url);
    if (url.startsWith("/api/repo?")) return Response.json(LISTING);
    if (url === raw("pot.py")) return new Response("x = 1\n");
    const name = README_NAMES.find((n) => url === raw(n));
    return name && readmes[name] !== undefined ? new Response(readmes[name]) : new Response("missing", { status: 404 });
  }) as typeof fetch;
}

function nodeLintClient(): Promise<LintClient> {
  const lint = createNodeLint();
  return Promise.resolve({ lint: async (source: string) => lint(source), dispose: () => undefined });
}

describe("fetchReadmeBlurb", () => {
  it("tries README.md, readme.md, README.rst and README in that order", async () => {
    const requested: string[] = [];
    const blurb = await fetchReadmeBlurb(LISTING, fakeFetch({ "README.rst": "Pot\n===\n\nA teapot that brews itself every single morning." }, requested));
    expect(blurb).toBe("A teapot that brews itself every single morning.");
    expect(requested).toEqual([raw("README.md"), raw("readme.md"), raw("README.rst")]);
  });

  it("gives up quietly when there is no README or the network fails", async () => {
    expect(await fetchReadmeBlurb(LISTING, fakeFetch({}))).toBeNull();
    const broken = (async () => {
      throw new Error("offline");
    }) as typeof fetch;
    expect(await fetchReadmeBlurb(LISTING, broken)).toBeNull();
  });

  it("stops when the load is cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    expect(await fetchReadmeBlurb(LISTING, fakeFetch({ "README.md": "Words words words words words words." }), controller.signal)).toBeNull();
  });
});

describe("analyzeRepo with a README", () => {
  it("puts the blurb on the analysis", async () => {
    const analysis = await analyzeRepo({ owner: "tea", repo: "pot" }, () => undefined, undefined, {
      fetch: fakeFetch({ "README.md": "# Pot\n\n![badge](b.svg)\n\nA teapot that brews itself every single morning." }),
      createLintClient: nodeLintClient,
    });
    expect(analysis.readme).toBe("A teapot that brews itself every single morning.");
  });

  it("loads fine without one", async () => {
    const analysis = await analyzeRepo({ owner: "tea", repo: "pot" }, () => undefined, undefined, { fetch: fakeFetch({}), createLintClient: nodeLintClient });
    expect(analysis.readme).toBeNull();
    expect(analysis.files).toHaveLength(1);
  });
});
