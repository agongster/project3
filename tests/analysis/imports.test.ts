/** rankPackages: which outside packages a repo leans on most (the Town Square merchants). */
import { describe, expect, it } from "vitest";
import { ownModuleNames, rankPackages, STDLIB_MODULES } from "@/lib/analysis/imports";
import { emptyOutline } from "@/lib/analysis/outline";
import type { AnalyzedFile } from "@/lib/types";
import { makeFile } from "../game/helpers";

function fileWith(path: string, imports: string[], lineCount = 40, status: AnalyzedFile["status"] = "ok"): AnalyzedFile {
  return { ...makeFile(path, { status }), lineCount, outline: { ...emptyOutline(), imports } };
}

describe("rankPackages", () => {
  const files = [
    fileWith("train.py", ["os", "numpy", "torch", "model", "tiktoken"], 300),
    fileWith("sample.py", ["torch", "tiktoken", "model", "json"], 80),
    fileWith("bench.py", ["numpy", "torch"], 120),
    fileWith("model.py", ["math", "torch", "inspect", "__future__"], 330),
    fileWith("data/prepare.py", ["requests", "numpy", "data", "_private"], 60),
    fileWith("broken.py", ["pandas"], 0, "failed"),
  ];
  const ranking = rankPackages(files);

  it("counts files per package, most-imported first, ties alphabetical", () => {
    expect(ranking.map((p) => [p.name, p.importers.length])).toEqual([
      ["torch", 4],
      ["numpy", 3],
      ["tiktoken", 2],
      ["requests", 1],
    ]);
  });

  it("leaves out the standard library, the repo's own modules, private names and failed files", () => {
    const names = ranking.map((p) => p.name);
    for (const left of ["os", "json", "math", "inspect", "__future__", "model", "data", "_private", "pandas"]) expect(names).not.toContain(left);
  });

  it("lists importers biggest file first", () => {
    expect(ranking[0].importers).toEqual(["model.py", "train.py", "bench.py", "sample.py"]);
  });

  it("is empty for a repo without outside imports or without any outline", () => {
    expect(rankPackages([fileWith("a.py", ["os", "sys"])])).toEqual([]);
    expect(rankPackages([makeFile("a.py")])).toEqual([]);
    expect(rankPackages([])).toEqual([]);
  });

  it("knows the common standard-library modules", () => {
    for (const name of ["os", "sys", "re", "json", "typing", "dataclasses", "pathlib", "collections"]) expect(STDLIB_MODULES.has(name)).toBe(true);
    expect(STDLIB_MODULES.has("numpy")).toBe(false);
  });
});

describe("ownModuleNames", () => {
  it("collects folder and file names of the repo", () => {
    expect([...ownModuleNames([fileWith("src/pkg/core.py", []), fileWith("setup.py", [])])].sort()).toEqual(["core", "pkg", "setup", "src"]);
  });
});
