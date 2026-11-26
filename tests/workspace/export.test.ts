/**
 * Exporting the player's edits: the patch must be one `git apply` accepts
 * (checked with the real git, in a temporary folder outside the project),
 * and the zip must hold the changed files' full new text.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { strFromU8, unzipSync } from "fflate";
import { afterEach, describe, expect, it } from "vitest";
import type { FileChange } from "@/lib/workspace";
import { describeChange, gitQuotePath, unifiedDiff, zipChanges } from "@/lib/workspace/exportChanges";
import { demoSource, openDemo } from "./helpers";

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

/** Writes each change's original into a fresh folder, then runs `git apply` on the patch there. */
function gitApply(changes: readonly FileChange[], patch: string, check: boolean): string {
  const folder = mkdtempSync(join(tmpdir(), "lintlands-patch-"));
  folders.push(folder);
  for (const change of changes) {
    mkdirSync(dirname(join(folder, change.path)), { recursive: true });
    writeFileSync(join(folder, change.path), change.original);
  }
  writeFileSync(join(folder, "changes.patch"), patch);
  execFileSync("git", ["apply", ...(check ? ["--check"] : []), "changes.patch"], { cwd: folder, stdio: "pipe" });
  return folder;
}

const awkwardChanges: FileChange[] = [
  describeChange("pkg/mod.py", "a = 1\nb = 2\nc = 3\n", "a = 1\nb = 20\nc = 3\n"),
  // Neither version ends with a newline.
  describeChange("notes.txt", "first\nlast line", "first\nsecond\nlast line"),
  // The newline at the end is removed.
  describeChange("docs/guide.md", "# Guide\n\nRead me.\n", "# Guide\n\nRead me please."),
  describeChange("my folder/util.py", "x = 1\n", "x = 2\n"),
  describeChange("windows.py", "a = 1\r\nb = 2\r\n", "a = 1\r\nb = 3\r\n"),
  describeChange("café/ünïcode.py", "s = 'é'\n", "s = 'è'\n"),
];

describe("unifiedDiff", () => {
  it("writes git-style headers with a/ and b/ prefixes", () => {
    const patch = unifiedDiff([awkwardChanges[0]]);
    expect(patch.startsWith("diff --git a/pkg/mod.py b/pkg/mod.py\n--- a/pkg/mod.py\n+++ b/pkg/mod.py\n@@ -1,3 +1,3 @@\n")).toBe(true);
    expect(patch).toContain("-b = 2\n+b = 20\n");
    expect(unifiedDiff([])).toBe("");
  });

  it("is accepted and applied by git, including files without a final newline", () => {
    const patch = unifiedDiff(awkwardChanges);
    expect(patch).toContain("\\ No newline at end of file");
    gitApply(awkwardChanges, patch, true);
    const folder = gitApply(awkwardChanges, patch, false);
    for (const change of awkwardChanges) expect(readFileSync(join(folder, change.path), "utf8")).toBe(change.saved);
  });

  it("quotes paths git would quote", () => {
    expect(gitQuotePath("a/plain path.py")).toBe("a/plain path.py");
    expect(gitQuotePath('a/say "hi".py')).toBe('"a/say \\"hi\\".py"');
    expect(gitQuotePath("a/tab\there.py")).toBe('"a/tab\\there.py"');
    expect(gitQuotePath("a/bell\u0007.py")).toBe('"a/bell\\007.py"');
  });
});

describe("exporting from a workspace", () => {
  it("exports a patch of every forged file that git applies to the original repo", async () => {
    const workspace = await openDemo();
    await workspace.forge("bakery/recipes.py", demoSource("bakery/recipes.py").replace("import os\n", ""));
    await workspace.forge("requirements.txt", "# Everything the shop needs to open its doors.\nrich>=13.0\nrequests>=2.31\n");
    const changes = workspace.changes();
    expect(changes.map((change) => [change.path, change.linesAdded, change.linesRemoved])).toEqual([
      ["bakery/recipes.py", 0, 1],
      ["requirements.txt", 1, 0],
    ]);
    const folder = gitApply(changes, workspace.exportPatch(), false);
    expect(readFileSync(join(folder, "requirements.txt"), "utf8")).toContain("requests>=2.31");
  });

  it("zips the changed files with their full new text", async () => {
    const workspace = await openDemo();
    expect(workspace.exportPatch()).toBe("");
    await workspace.forge("main.py", "print('hello')\n");
    const files = unzipSync(workspace.exportZip());
    expect(Object.keys(files)).toEqual(["main.py"]);
    expect(strFromU8(files["main.py"])).toBe("print('hello')\n");
    expect(Object.keys(unzipSync(zipChanges(awkwardChanges)))).toEqual(awkwardChanges.map((change) => change.path));
  });
});
