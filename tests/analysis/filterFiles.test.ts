import { describe, expect, it } from "vitest";
import { filterFiles, MAX_FILE_BYTES, MAX_FILES, type TreeEntry } from "@/lib/repo/filterFiles";

const blob = (path: string, size = 100): TreeEntry => ({ path, type: "blob", mode: "100644", size });

describe("filterFiles", () => {
  it("keeps only Python files (no directories, submodules or symlinks)", () => {
    const { files } = filterFiles([
      blob("app.py"),
      blob("README.md"),
      blob("pkg/stub.pyi"),
      { path: "pkg", type: "tree" },
      { path: "vendored-lib", type: "commit" },
      { path: "link.py", type: "blob", mode: "120000", size: 10 },
    ]);
    expect(files).toEqual([{ path: "app.py", size: 100 }]);
  });

  it("skips vendored and generated directories at any depth", () => {
    const { files, skipped } = filterFiles([
      blob("src/main.py"),
      blob("venv/lib/thing.py"),
      blob("src/node_modules/x.py"),
      blob("app/migrations/0001_initial.py"),
      blob("build/lib/copy.py"),
      blob("third_party/lib.py"),
      blob("src/environment.py"), // "environment" is not "env"
    ]);
    expect(files.map((f) => f.path)).toEqual(["src/environment.py", "src/main.py"]);
    expect(skipped.vendored).toBe(5);
  });

  it("skips files over the size cap", () => {
    const { files, skipped } = filterFiles([blob("small.py", MAX_FILE_BYTES), blob("huge.py", MAX_FILE_BYTES + 1)]);
    expect(files.map((f) => f.path)).toEqual(["small.py"]);
    expect(skipped.tooLarge).toBe(1);
  });

  it("caps the file count, keeping files closest to the root", () => {
    const deep = Array.from({ length: MAX_FILES }, (_, i) => blob(`pkg/sub/deep_${String(i).padStart(3, "0")}.py`));
    const shallow = [blob("setup.py"), blob("pkg/core.py")];
    const { files, skipped } = filterFiles([...deep, ...shallow]);

    expect(files).toHaveLength(MAX_FILES);
    expect(skipped.overCap).toBe(2);
    const paths = files.map((f) => f.path);
    expect(paths).toContain("setup.py");
    expect(paths).toContain("pkg/core.py");
    // Among equally deep files, alphabetical order decides: the last two lose.
    expect(paths).not.toContain("pkg/sub/deep_149.py");
    expect(paths).not.toContain("pkg/sub/deep_148.py");
    // The result itself is sorted by path.
    expect(paths).toEqual([...paths].sort());
  });
});
