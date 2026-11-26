/**
 * The whole forge story on the Demo Kingdom, with the real Ruff (Node build):
 * fixing, moving, breaking and repairing code, reverting, and what the world
 * (`workspace.analysis`) and the report say each time.
 */
import { describe, expect, it } from "vitest";
import { MAX_MONSTERS_PER_FILE } from "@/lib/analysis/normalize";
import { demoSource, MemoryStorage, openDemo, viewOf } from "./helpers";

const RECIPES = "bakery/recipes.py";
const ORDERS = "bakery/orders.py";
const codes = (findings: readonly { code: string }[]) => findings.map((finding) => finding.code);

describe("forging a Python file", () => {
  it("reports a real fix, banishes its monster and counts it in realFixes", async () => {
    const workspace = await openDemo();
    const report = await workspace.forge(RECIPES, demoSource(RECIPES).replace("import os\n", ""));

    expect(report.linted).toBe(true);
    expect(report.fixed.map((f) => f.id)).toEqual([`${RECIPES}:3:8:F401`]);
    expect(report.introduced).toEqual([]);
    expect(report.before.findingCount).toBe(report.after.findingCount + 1);
    const view = viewOf(workspace, RECIPES);
    expect(view.realFixes).toBe(1);
    expect(view.fixedFindings?.map((f) => f.id)).toEqual([`${RECIPES}:3:8:F401`]);
    expect(codes(view.findings)).not.toContain("F401");
    expect(report.file).toBe(view);
  });

  it("follows findings that only moved: nothing fixed, nothing new, new ids for the moved ones", async () => {
    const workspace = await openDemo();
    const source = demoSource(RECIPES);
    const report = await workspace.forge(RECIPES, source.replace('"""Secret recipes of the Crumbleton Bakery."""\n', '"""Secret recipes of the Crumbleton Bakery."""\n\n# Shh.\n'));

    expect(report.fixed).toEqual([]);
    expect(report.introduced).toEqual([]);
    expect(report.kept.length).toBe(report.before.findingCount);
    for (const pair of report.kept) {
      expect(pair.after.line).toBe(pair.before.line + 2);
      expect(pair.after.id).not.toBe(pair.before.id);
    }
    expect(viewOf(workspace, RECIPES).realFixes).toBeUndefined();
  });

  it("counts a fix even when another bug is added in the same forge", async () => {
    const workspace = await openDemo();
    const report = await workspace.forge(RECIPES, demoSource(RECIPES).replace("import os\n", "").replace("import random\n", "import random\nimport sys\n"));

    expect(report.fixed.map((f) => f.message)).toEqual(["`os` imported but unused"]);
    expect(report.introduced.map((f) => f.message)).toEqual(["`sys` imported but unused"]);
    expect(viewOf(workspace, RECIPES).realFixes).toBe(1);
  });

  it("never counts breaking the code as fixing it, and compares a repair with the code before it broke", async () => {
    const workspace = await openDemo();
    const original = demoSource(ORDERS);
    // First a real fix, so there is credit to keep.
    const fixedText = original.replace("def add_to_basket(item, basket=[]):", "def add_to_basket(item, basket=None):");
    expect((await workspace.forge(ORDERS, fixedText)).fixed.map((f) => f.code)).toEqual(["B006"]);

    const broken = fixedText.replace("def total_price(order):", "def total_price(order)");
    const breakReport = await workspace.forge(ORDERS, broken);
    expect(codes(breakReport.introduced)).toEqual(["SYNTAX"]);
    expect(breakReport.fixed).toEqual([]);
    expect(breakReport.kept.length).toBe(breakReport.before.findingCount);
    const brokenView = viewOf(workspace, ORDERS);
    expect(codes(brokenView.findings)).toEqual(["SYNTAX"]); // the world shows the Glitch King only
    expect(brokenView.realFixes).toBe(1); // the earlier fix still counts, nothing more

    const repair = await workspace.forge(ORDERS, fixedText);
    expect(codes(repair.fixed)).toEqual(["SYNTAX"]);
    expect(repair.introduced).toEqual([]);
    expect(repair.kept.every((pair) => pair.before.id === pair.after.id)).toBe(true);
    expect(viewOf(workspace, ORDERS).realFixes).toBe(1);
  });

  it("pays for repairing a file that was broken in the repo, and shows what Ruff can now see", async () => {
    const workspace = await openDemo();
    const path = "potions/cauldron.py";
    const report = await workspace.forge(path, demoSource(path).replace("self.contents.append(ingredient\n", "self.contents.append(ingredient)\n"));
    expect(codes(report.fixed)).toEqual(["SYNTAX"]);
    expect(viewOf(workspace, path).realFixes).toBe(1);
    expect(report.purified).toBe(report.after.findingCount === 0);
  });

  it("takes the credit back on revert", async () => {
    const workspace = await openDemo();
    await workspace.forge(RECIPES, demoSource(RECIPES).replace("import os\n", ""));
    const report = await workspace.revert(RECIPES);

    expect(codes(report.introduced)).toEqual(["F401"]);
    expect(report.fixed).toEqual([]);
    const view = viewOf(workspace, RECIPES);
    expect(view.realFixes).toBeUndefined();
    expect(view.findings.map((f) => f.id)).toContain(`${RECIPES}:3:8:F401`);
    expect(workspace.changes()).toEqual([]);
    expect(workspace.entries().find((entry) => entry.path === RECIPES)?.modified).toBe(false);
  });

  it("reports no changes for unchanged text and leaves the world alone", async () => {
    const workspace = await openDemo();
    const before = workspace.analysis.get();
    const report = await workspace.forge(RECIPES, demoSource(RECIPES));
    expect(report.fixed).toEqual([]);
    expect(report.introduced).toEqual([]);
    expect(report.kept.every((pair) => pair.before === pair.after)).toBe(true);
    expect(workspace.analysis.get()).toBe(before);
  });

  it("replaces the analysis with a new object instead of changing it, and tells subscribers", async () => {
    const workspace = await openDemo();
    const before = workspace.analysis.get();
    const snapshot = JSON.stringify(before);
    let calls = 0;
    workspace.subscribe(() => calls++);
    await workspace.forge(RECIPES, demoSource(RECIPES).replace("import os\n", ""));
    expect(workspace.analysis.get()).not.toBe(before);
    expect(JSON.stringify(before)).toBe(snapshot);
    expect(workspace.analysis.get().stats.findingCount).toBe(before.stats.findingCount - 1);
    expect(calls).toBe(1);
  });

  it("reconciles the full list, not the dungeon's capped one", async () => {
    const workspace = await openDemo();
    const names = Array.from({ length: 14 }, (_, i) => `mod_${String(i).padStart(2, "0")}`);
    const crowded = demoSource(RECIPES).replace("import os\n", `import os\n${names.map((name) => `import ${name}\n`).join("")}`);
    const crowdedReport = await workspace.forge(RECIPES, crowded);
    expect(crowdedReport.introduced).toHaveLength(14);
    const view = viewOf(workspace, RECIPES);
    expect(view.findings.length).toBeLessThanOrEqual(MAX_MONSTERS_PER_FILE);
    expect(view.overflow).toBeGreaterThan(0);

    // Removing an import whose finding didn't fit in the dungeon is still a fix…
    const hiddenRemoved = await workspace.forge(RECIPES, crowded.replace("import mod_13\n", ""));
    expect(hiddenRemoved.fixed.map((f) => f.message)).toEqual(["`mod_13` imported but unused"]);
    // …and a finding moving into the dungeon after a fix is not reported as new.
    const shownRemoved = await workspace.forge(RECIPES, crowded.replace("import mod_13\n", "").replace("import os\n", ""));
    expect(shownRemoved.fixed.map((f) => f.message)).toEqual(["`os` imported but unused"]);
    expect(shownRemoved.introduced).toEqual([]);
    expect(viewOf(workspace, RECIPES).realFixes).toBe(1); // only `os` was in the original
  });

  it("runs forges one at a time, each compared with the one before", async () => {
    const workspace = await openDemo();
    const once = demoSource(RECIPES).replace("import os\n", "");
    const twice = once.replace("import random\n", "import random\nimport json\n");
    const [first, second] = await Promise.all([workspace.forge(RECIPES, once), workspace.forge(RECIPES, twice)]);
    expect(codes(first.fixed)).toEqual(["F401"]);
    expect(second.fixed).toEqual([]);
    expect(second.introduced.map((f) => f.message)).toEqual(["`json` imported but unused"]);
  });

  it("refuses unknown paths and text that is far too long", async () => {
    const workspace = await openDemo();
    await expect(workspace.forge("nope.py", "x = 1\n")).rejects.toThrow("no such file");
    await expect(workspace.forge(RECIPES, "#".repeat(600_000))).rejects.toThrow("too much text");
  });
});

describe("forging other files", () => {
  it("saves a README without linting it, and lists and reverts the change", async () => {
    const storage = new MemoryStorage();
    const workspace = await openDemo(storage);
    const { original } = await workspace.read("README.md");
    const report = await workspace.forge("README.md", `${original}\nNew opening hours!\n`);

    expect(report).toMatchObject({ path: "README.md", linted: false, fixed: [], introduced: [], kept: [], purified: false, file: null });
    expect(workspace.changes().map((change) => [change.path, change.linesAdded, change.linesRemoved])).toEqual([["README.md", 2, 0]]);
    expect(workspace.entries().find((entry) => entry.path === "README.md")).toMatchObject({ kind: "other", modified: true });
    expect((await workspace.read("README.md")).saved).toContain("New opening hours!");

    await workspace.revert("README.md");
    expect(workspace.changes()).toEqual([]);
  });

  it("lists Python files first, each group sorted by path", async () => {
    const workspace = await openDemo();
    const entries = workspace.entries();
    const firstOther = entries.findIndex((entry) => entry.kind === "other");
    expect(entries.slice(0, firstOther).every((entry) => entry.kind === "python")).toBe(true);
    expect(entries.slice(firstOther).map((entry) => entry.path)).toEqual(["README.md", "pyproject.toml", "requirements.txt", "shop.yaml"]);
    expect(entries.slice(0, firstOther).map((entry) => entry.path)).toEqual([...entries.slice(0, firstOther).map((entry) => entry.path)].sort());
  });

  it("doesn't check non-Python files", async () => {
    const workspace = await openDemo();
    await expect(workspace.check("README.md", "# hi\n")).rejects.toThrow("Only Python files");
  });
});
