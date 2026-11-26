/**
 * openWorkspace: the loading pipeline (fake server + fake GitHub CDN, Ruff's
 * Node build standing in for the Web Worker), the player's stored edits, and
 * the files of a real repo beyond Python.
 */
import { describe, expect, it } from "vitest";
import { AnalyzeError } from "@/lib/analysis/errors";
import type { LintClient } from "@/lib/analysis/lintClient";
import { repoKey } from "@/game/bridge";
import type { AnalyzeProgress, RepoListing } from "@/lib/types";
import { openWorkspace, type WorkspaceDeps } from "@/lib/workspace";
import { EDITS_STORAGE_KEY } from "@/lib/workspace/storedEdits";
import { nodeLintClient } from "../analysis/nodeLint";
import { demoSource, MemoryStorage, openDemo, viewOf } from "./helpers";

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
  otherFiles: [
    { path: "README.md", size: 30 },
    { path: "data/blob.json", size: 30 },
  ],
  skipped: { vendored: 0, tooLarge: 0, overCap: 7 },
  truncated: false,
};
const RAW = `https://raw.githubusercontent.com/bakery/shop/${SHA}`;
const SOURCES: Record<string, string> = {
  [`${RAW}/app.py`]: "import os\n",
  [`${RAW}/my%20pkg/util.py`]: '"""Utilities."""\n',
  [`${RAW}/README.md`]: "# Shop\n\nWe sell bread.\n",
  [`${RAW}/data/blob.json`]: "\u0000\u0001binary",
};
const SHOP_KEY = repoKey(LISTING);

function fakeFetch(apiResponse: () => Response, requested: string[] = []): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    requested.push(url);
    if (url.startsWith("/api/repo?")) return apiResponse();
    const source = SOURCES[url];
    return source === undefined ? new Response("missing", { status: 404 }) : new Response(source);
  }) as typeof fetch;
}

function openShop(deps: Partial<WorkspaceDeps> = {}, onProgress: (p: AnalyzeProgress) => void = () => undefined, signal?: AbortSignal) {
  return openWorkspace({ kind: "repo", owner: "bakery", repo: "shop" }, onProgress, signal, {
    fetch: fakeFetch(() => Response.json(LISTING)),
    createLintClient: nodeLintClient,
    storage: new MemoryStorage(),
    ...deps,
  });
}

describe("openWorkspace on a GitHub repo", () => {
  it("lists, downloads, lints and builds the analysis, with the same progress events as before", async () => {
    const progress: AnalyzeProgress[] = [];
    const workspace = await openShop({}, (p) => progress.push(p));
    const analysis = workspace.analysis.get();

    expect(analysis.demo).toBe(false);
    expect(analysis.files.map((f) => [f.path, f.status, f.findings.map((x) => x.code)])).toEqual([
      ["app.py", "ok", ["F401"]],
      ["my pkg/util.py", "ok", []],
      ["lost.py", "failed", []],
    ]);
    expect(analysis.warnings).toEqual(["Showing the first 3 Python files (7 more were left out).", "1 file couldn't be downloaded and appear as ruins."]);
    expect(progress.map((p) => p.stage)).toEqual(expect.arrayContaining(["listing", "downloading", "linting", "building", "done"]));
    expect(progress.at(-1)?.stage).toBe("done");
    expect(progress.find((p) => p.stage === "downloading" && p.done === 3)?.label).toBe("Unrolling scrolls… 3/3");
  });

  it("keeps the Python text in memory, and downloads other files only when opened", async () => {
    const requested: string[] = [];
    const workspace = await openShop({ fetch: fakeFetch(() => Response.json(LISTING), requested) });
    expect(await workspace.read("app.py")).toEqual({ original: "import os\n", saved: "import os\n" });
    expect(requested.some((url) => url.endsWith("/README.md") && requested.indexOf(url) > 3)).toBe(false);

    const before = requested.length;
    expect((await workspace.read("README.md")).original).toBe("# Shop\n\nWe sell bread.\n");
    expect(requested.length).toBe(before + 1);
    await workspace.read("README.md");
    expect(requested.length).toBe(before + 1); // downloaded once
  });

  it("refuses binary files, unknown paths and files that failed to download, with friendly messages", async () => {
    const workspace = await openShop();
    await expect(workspace.read("data/blob.json")).rejects.toThrow("binary");
    await expect(workspace.read("nowhere.txt")).rejects.toThrow("no such file");
    await expect(workspace.read("lost.py")).rejects.toThrow("couldn't be downloaded");
    await expect(workspace.forge("lost.py", "x = 1\n")).rejects.toThrow("couldn't be downloaded");
  });

  it("reports a failed download of another file without breaking anything", async () => {
    const offline = (async (input: RequestInfo | URL) => {
      if (String(input).startsWith("/api/repo?")) return Response.json(LISTING);
      if (String(input).endsWith("/README.md")) throw new TypeError("Failed to fetch");
      return new Response(SOURCES[String(input)] ?? "missing", { status: SOURCES[String(input)] ? 200 : 404 });
    }) as typeof fetch;
    const workspace = await openShop({ fetch: offline });
    await expect(workspace.read("README.md")).rejects.toThrow("Couldn't download README.md");
    await expect(workspace.forge("README.md", "new text")).rejects.toThrow("Couldn't download README.md");
    expect(workspace.changes()).toEqual([]);
  });

  it("turns API errors into AnalyzeErrors with the same code", async () => {
    const body = { error: { code: "rate_limited", message: "GitHub needs a breather", retryAfterSec: 120 } };
    const result = openShop({ fetch: fakeFetch(() => Response.json(body, { status: 429 })) });
    await expect(result).rejects.toBeInstanceOf(AnalyzeError);
    await expect(result).rejects.toMatchObject({ code: "rate_limited", retryAfterSec: 120 });
  });

  it("reports linter_failed when the worker can't start", async () => {
    await expect(openShop({ createLintClient: () => Promise.reject(new Error("wasm 404")) })).rejects.toMatchObject({ code: "linter_failed" });
  });

  it("stops with code 'aborted' when cancelled, and stops the worker", async () => {
    const controller = new AbortController();
    let disposed = 0;
    const client = async (): Promise<LintClient> => ({ ...(await nodeLintClient()), dispose: () => void disposed++ });
    const result = openShop({ createLintClient: client }, (p) => p.stage === "downloading" && controller.abort(), controller.signal);
    await expect(result).rejects.toMatchObject({ code: "aborted" });
    await Promise.resolve();
    expect(disposed).toBe(1);
  });

  it("keeps the worker alive in the workspace until dispose", async () => {
    let disposed = 0;
    const client = async (): Promise<LintClient> => ({ ...(await nodeLintClient()), dispose: () => void disposed++ });
    const workspace = await openShop({ createLintClient: client });
    expect(disposed).toBe(0);
    expect((await workspace.check("app.py", "import os\n")).findings).toHaveLength(1);
    workspace.dispose();
    await Promise.resolve();
    expect(disposed).toBe(1);
    await expect(workspace.check("app.py", "x\n")).rejects.toThrow("closed");
  });
});

describe("stored edits", () => {
  it("are applied before the analysis is first published, so a returning player sees their edited world", async () => {
    const storage = new MemoryStorage();
    const first = await openDemo(storage);
    await first.forge("bakery/recipes.py", demoSource("bakery/recipes.py").replace("import os\n", ""));
    await first.forge("README.md", "# Crumbleton\n\nNow with croissants.\n");
    first.dispose();
    expect(storage.getItem(EDITS_STORAGE_KEY)).toContain("bakery/recipes.py");

    const again = await openDemo(storage);
    const view = viewOf(again, "bakery/recipes.py");
    expect(view.realFixes).toBe(1);
    expect(view.findings.map((f) => f.code)).not.toContain("F401");
    expect(again.changes().map((change) => change.path)).toEqual(["README.md", "bakery/recipes.py"]);
    expect((await again.read("README.md")).saved).toBe("# Crumbleton\n\nNow with croissants.\n");
  });

  it("ignore stored text for files that don't exist, and for a file that failed to download (kept for later)", async () => {
    const storage = new MemoryStorage();
    storage.setItem(EDITS_STORAGE_KEY, JSON.stringify({ [SHOP_KEY]: { "lost.py": "x = 2\n", "ghost.py": "boo\n", "app.py": "import os\nimport sys\n" } }));
    const workspace = await openShop({ storage });
    expect(workspace.changes().map((change) => change.path)).toEqual(["app.py"]);
    expect(viewOf(workspace, "app.py").findings).toHaveLength(2);
    expect(viewOf(workspace, "lost.py").status).toBe("failed");
    expect(storage.getItem(EDITS_STORAGE_KEY)).toContain("lost.py");
  });

  it("never count breaking the code as a fix, even when the broken text is what was stored", async () => {
    const storage = new MemoryStorage();
    const first = await openDemo(storage);
    const orders = demoSource("bakery/orders.py");
    await first.forge("bakery/orders.py", orders.replace("def total_price(order):", "def total_price(order)"));
    const again = await openDemo(storage);
    const view = viewOf(again, "bakery/orders.py");
    expect(view.findings.map((f) => f.code)).toEqual(["SYNTAX"]);
    expect(view.realFixes).toBeUndefined();
    // Repairing it compares against the code before it broke: nothing fixed, nothing new.
    const repair = await again.forge("bakery/orders.py", orders);
    expect(repair.fixed.map((f) => f.code)).toEqual(["SYNTAX"]);
    expect(repair.introduced).toEqual([]);
  });

  it("are removed once a file is reverted", async () => {
    const storage = new MemoryStorage();
    const workspace = await openDemo(storage);
    await workspace.forge("main.py", `${demoSource("main.py")}\n# the end\n`);
    expect(storage.getItem(EDITS_STORAGE_KEY)).toContain("main.py");
    await workspace.revert("main.py");
    expect(storage.getItem(EDITS_STORAGE_KEY)).not.toContain("main.py");
  });
});

describe("openWorkspace on the demo", () => {
  it("builds the same world as the analysis-only demo", async () => {
    const workspace = await openDemo();
    const analysis = workspace.analysis.get();
    expect(analysis.demo).toBe(true);
    expect(analysis.files.every((file) => file.status === "ok")).toBe(true);
    expect(analysis.readme).toContain("friendliest");
    expect(workspace.entries().filter((entry) => entry.kind === "other").map((entry) => entry.path)).toContain("README.md");
  });
});
