/**
 * analyzeRepo with a fake server, a fake GitHub CDN and Ruff's Node.js build
 * standing in for the Web Worker.
 */
import { describe, expect, it } from "vitest";
import { analyzeRepo } from "@/lib/analysis/analyzeRepo";
import { AnalyzeError } from "@/lib/analysis/errors";
import type { LintClient } from "@/lib/analysis/lintClient";
import type { AnalyzeProgress, RepoListing } from "@/lib/types";
import { createNodeLint } from "./nodeLint";

const SHA = "b".repeat(40);
const LISTING: RepoListing = {
  repo: { owner: "bakery", repo: "shop", ref: "main", sha: SHA },
  description: null,
  stars: 3,
  files: [
    { path: "app.py", size: 20 },
    { path: "my pkg/util.py", size: 20 },
    { path: "lost.py", size: 20 },
  ],
  skipped: { vendored: 0, tooLarge: 0, overCap: 7 },
  truncated: false,
};
const SOURCES: Record<string, string> = {
  [`https://raw.githubusercontent.com/bakery/shop/${SHA}/app.py`]: "import os\n",
  [`https://raw.githubusercontent.com/bakery/shop/${SHA}/my%20pkg/util.py`]: '"""Utilities."""\n',
};

function fakeFetch(apiResponse: () => Response): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("/api/repo?")) return apiResponse();
    const source = SOURCES[url];
    return source === undefined ? new Response("missing", { status: 404 }) : new Response(source);
  }) as typeof fetch;
}

function nodeLintClient(): Promise<LintClient> {
  const lint = createNodeLint();
  return Promise.resolve({ lint: async (source: string) => lint(source), dispose: () => undefined });
}

describe("analyzeRepo", () => {
  it("lists, downloads, lints and builds the analysis", async () => {
    const progress: AnalyzeProgress[] = [];
    const analysis = await analyzeRepo({ owner: "bakery", repo: "shop" }, (p) => progress.push(p), undefined, {
      fetch: fakeFetch(() => Response.json(LISTING)),
      createLintClient: nodeLintClient,
    });

    expect(analysis.demo).toBe(false);
    expect(analysis.files.map((f) => [f.path, f.status, f.findings.map((x) => x.code)])).toEqual([
      ["app.py", "ok", ["F401"]],
      ["my pkg/util.py", "ok", []],
      ["lost.py", "failed", []],
    ]);
    expect(analysis.warnings).toEqual([
      "Showing the first 3 Python files (7 more were left out).",
      "1 file couldn't be downloaded and appear as ruins.",
    ]);
    expect(progress.map((p) => p.stage)).toEqual(expect.arrayContaining(["listing", "downloading", "linting", "building", "done"]));
    expect(progress.at(-1)?.stage).toBe("done");
    expect(progress.find((p) => p.stage === "downloading" && p.done === 3)?.label).toBe("Unrolling scrolls… 3/3");
  });

  it("turns API errors into AnalyzeErrors with the same code", async () => {
    const body = { error: { code: "rate_limited", message: "GitHub needs a breather", retryAfterSec: 120 } };
    const result = analyzeRepo({ owner: "a", repo: "b" }, () => undefined, undefined, {
      fetch: fakeFetch(() => Response.json(body, { status: 429 })),
      createLintClient: nodeLintClient,
    });
    await expect(result).rejects.toBeInstanceOf(AnalyzeError);
    await expect(result).rejects.toMatchObject({ code: "rate_limited", retryAfterSec: 120 });
  });

  it("reports linter_failed when the worker can't start", async () => {
    const result = analyzeRepo({ owner: "bakery", repo: "shop" }, () => undefined, undefined, {
      fetch: fakeFetch(() => Response.json(LISTING)),
      createLintClient: () => Promise.reject(new Error("wasm 404")),
    });
    await expect(result).rejects.toMatchObject({ code: "linter_failed" });
  });

  it("stops with code 'aborted' when cancelled", async () => {
    const controller = new AbortController();
    const result = analyzeRepo(
      { owner: "bakery", repo: "shop" },
      (p) => {
        if (p.stage === "downloading") controller.abort();
      },
      controller.signal,
      { fetch: fakeFetch(() => Response.json(LISTING)), createLintClient: nodeLintClient },
    );
    await expect(result).rejects.toMatchObject({ code: "aborted" });
  });
});
