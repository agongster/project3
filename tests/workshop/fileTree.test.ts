import { describe, expect, it } from "vitest";
import { ancestorFolders, buildFileTree, fuzzyScore, matchesFilter, rankPaths, visibleRows } from "@/components/workshop/logic/fileTree";
import type { WorkspaceEntry } from "@/lib/workspace/contract";

function entry(path: string): WorkspaceEntry {
  return { path, size: 10, kind: path.endsWith(".py") ? "python" : "other", modified: false };
}

const ENTRIES = ["main.py", "bakery/oven.py", "bakery/orders.py", "README.md", "bakery/sub/deep.py", "Zeta.py", "constructor"].map(entry);

function names(rows: ReturnType<typeof visibleRows>): string[] {
  return rows.map((row) => `${"  ".repeat(row.depth)}${row.node.name}`);
}

describe("buildFileTree", () => {
  it("puts folders first, then files, in case-insensitive order", () => {
    const tree = buildFileTree(ENTRIES);
    expect(tree.children.map((node) => node.name)).toEqual(["bakery", "constructor", "main.py", "README.md", "Zeta.py"]);
    const bakery = tree.children[0];
    expect(bakery.kind === "folder" && bakery.children.map((node) => node.name)).toEqual(["sub", "orders.py", "oven.py"]);
  });

  it("ignores empty path parts", () => {
    const tree = buildFileTree([entry("a//b.py"), entry("/")]);
    expect(names(visibleRows(tree, new Set(["a"]), ""))).toEqual(["a", "  b.py"]);
  });
});

describe("visibleRows", () => {
  const tree = buildFileTree(ENTRIES);

  it("shows only open folders' children", () => {
    expect(names(visibleRows(tree, new Set(), ""))).toEqual(["bakery", "constructor", "main.py", "README.md", "Zeta.py"]);
    expect(names(visibleRows(tree, new Set(["bakery"]), "")).slice(0, 4)).toEqual(["bakery", "  sub", "  orders.py", "  oven.py"]);
  });

  it("opens every folder on the way to a filter hit and hides the rest", () => {
    expect(names(visibleRows(tree, new Set(), "deep"))).toEqual(["bakery", "  sub", "    deep.py"]);
    expect(names(visibleRows(tree, new Set(), "bakery or"))).toEqual(["bakery", "  orders.py"]);
  });

  it("matches filter words anywhere, ignoring case", () => {
    expect(matchesFilter("bakery/Orders.py", "ORD bak")).toBe(true);
    expect(matchesFilter("bakery/orders.py", "oven")).toBe(false);
  });
});

describe("ancestorFolders", () => {
  it("lists the folders above a file", () => {
    expect(ancestorFolders("a/b/c.py")).toEqual(["a", "a/b"]);
    expect(ancestorFolders("top.py")).toEqual([]);
  });
});

describe("quick-open ranking", () => {
  it("needs every letter in order", () => {
    expect(fuzzyScore("bord", "bakery/orders.py")).not.toBeNull();
    expect(fuzzyScore("drob", "bakery/orders.py")).toBeNull();
    expect(fuzzyScore("", "anything")).toBe(0);
  });

  it("ranks file-name and word-start matches first", () => {
    const paths = ["potions/brewing.py", "bakery/orders.py", "tools/restock.py", "bakery/oven.py"];
    expect(rankPaths(paths, "orders")[0]).toBe("bakery/orders.py");
    expect(rankPaths(paths, "ov")[0]).toBe("bakery/oven.py");
    expect(rankPaths(paths, "zzz")).toEqual([]);
  });

  it("keeps the original order for an empty query, up to the limit", () => {
    expect(rankPaths(["b", "a", "c"], "", 2)).toEqual(["b", "a"]);
  });
});
