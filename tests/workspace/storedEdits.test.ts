/**
 * The edit store: bounded, least recently edited repo forgotten first,
 * failing storage degrades to memory with one warning, and whatever is read
 * back is treated as hostile.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEditStore, EDITS_STORAGE_KEY, MAX_EDITED_REPOS, MAX_STORED_EDIT_CHARS, MAX_STORED_FILE_CHARS } from "@/lib/workspace/storedEdits";
import { demoSource, MemoryStorage, openDemo, viewOf } from "./helpers";

const PATHS = new Set(["a.py", "b.py", "README.md"]);
const stored = (storage: MemoryStorage) => JSON.parse(storage.getItem(EDITS_STORAGE_KEY) ?? "{}") as Record<string, Record<string, string>>;

afterEach(() => vi.restoreAllMocks());

describe("createEditStore", () => {
  it("remembers saved texts per repo and forgets a file set back to null", () => {
    const storage = new MemoryStorage();
    const edits = createEditStore(storage);
    edits.save("o/r@1", "a.py", "x = 1\n");
    edits.save("o/r@1", "b.py", "y = 2\n");
    edits.save("o/r@2", "a.py", "other commit\n");
    expect([...edits.load("o/r@1", PATHS)]).toEqual([
      ["a.py", "x = 1\n"],
      ["b.py", "y = 2\n"],
    ]);
    edits.save("o/r@1", "a.py", null);
    expect([...edits.load("o/r@1", PATHS).keys()]).toEqual(["b.py"]);
    edits.save("o/r@1", "b.py", null);
    expect(Object.keys(stored(storage))).toEqual(["o/r@2"]);
  });

  it("keeps at most MAX_EDITED_REPOS repos, forgetting the least recently edited", () => {
    const storage = new MemoryStorage();
    const edits = createEditStore(storage);
    for (let i = 0; i <= MAX_EDITED_REPOS; i++) edits.save(`o/r@${i}`, "a.py", `${i}\n`);
    edits.save("o/r@1", "a.py", "edited again\n"); // now the most recent
    edits.save("o/r@new", "a.py", "new\n");
    const keys = Object.keys(stored(storage));
    expect(keys).toHaveLength(MAX_EDITED_REPOS);
    expect(keys).not.toContain("o/r@0");
    expect(keys).not.toContain("o/r@2");
    expect(keys.slice(-2)).toEqual(["o/r@1", "o/r@new"]);
  });

  it("keeps the total under MAX_STORED_EDIT_CHARS by dropping old repos", () => {
    const storage = new MemoryStorage();
    const edits = createEditStore(storage);
    const big = "x".repeat(MAX_STORED_FILE_CHARS);
    const reposThatFit = Math.floor(MAX_STORED_EDIT_CHARS / MAX_STORED_FILE_CHARS);
    for (let i = 0; i <= reposThatFit; i++) edits.save(`o/r@${i}`, "a.py", big);
    const keys = Object.keys(stored(storage));
    expect(keys).toHaveLength(reposThatFit);
    expect(keys).not.toContain("o/r@0");
  });

  it("never stores a file over MAX_STORED_FILE_CHARS (and drops its older version)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const storage = new MemoryStorage();
    const edits = createEditStore(storage);
    edits.save("o/r@1", "a.py", "small\n");
    edits.save("o/r@1", "a.py", "x".repeat(MAX_STORED_FILE_CHARS + 1));
    expect(edits.load("o/r@1", PATHS).size).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("degrades to memory with a single warning when storage is full or missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const full = new MemoryStorage();
    full.failWrites = true;
    const edits = createEditStore(full);
    expect(() => {
      edits.save("o/r@1", "a.py", "x\n");
      edits.save("o/r@1", "b.py", "y\n");
    }).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);

    const none = createEditStore(null);
    none.save("o/r@1", "a.py", "x\n");
    none.save("o/r@1", "a.py", "y\n");
    expect(none.load("o/r@1", PATHS).size).toBe(0);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("treats stored data as hostile: unknown paths, non-strings, oversized texts and garbage are ignored", () => {
    const storage = new MemoryStorage();
    const repo = { "a.py": "fine\n", "../../etc/passwd": "nope", "b.py": 42, README: { nested: true }, "README.md": "x".repeat(MAX_STORED_FILE_CHARS + 1) };
    // Written as text: an object literal can't hold an own "__proto__" key, but JSON can.
    storage.setItem(EDITS_STORAGE_KEY, `{"o/r@1": ${JSON.stringify(repo)}, "__proto__": {"a.py": "polluted"}, "o/r@2": "not an object"}`);
    const edits = createEditStore(storage);
    expect([...edits.load("o/r@1", PATHS)]).toEqual([["a.py", "fine\n"]]);
    expect(edits.load("o/r@2", PATHS).size).toBe(0);
    edits.save("o/r@1", "b.py", "y\n"); // rewriting must not turn the hostile key into a prototype
    expect(({} as Record<string, unknown>)["a.py"]).toBeUndefined();
    expect(Object.getPrototypeOf(JSON.parse(storage.getItem(EDITS_STORAGE_KEY)!))).toBe(Object.prototype);

    for (const garbage of ["{not json", "null", "[1,2,3]", '"text"', "42"]) {
      storage.setItem(EDITS_STORAGE_KEY, garbage);
      expect(createEditStore(storage).load("o/r@1", PATHS).size).toBe(0);
    }
  });

  it("survives storage whose reads throw", () => {
    const throwing = { getItem: () => { throw new Error("SecurityError"); }, setItem: () => undefined };
    expect(createEditStore(throwing).load("o/r@1", PATHS).size).toBe(0);
  });
});

describe("stored edits in a workspace", () => {
  it("never break opening the world, whatever is stored", async () => {
    const storage = new MemoryStorage();
    storage.setItem(EDITS_STORAGE_KEY, '{"lintlands/demo-kingdom@d3c0de5ca1ab": {"bakery/recipes.py": 7, "zzz.py": "x"}}');
    const workspace = await openDemo(storage);
    expect(workspace.changes()).toEqual([]);
  });

  it("keep a forge working in memory when the quota is full", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const storage = new MemoryStorage();
    storage.failWrites = true;
    const workspace = await openDemo(storage);
    const report = await workspace.forge("bakery/recipes.py", demoSource("bakery/recipes.py").replace("import os\n", ""));
    expect(report.fixed).toHaveLength(1);
    expect(viewOf(workspace, "bakery/recipes.py").realFixes).toBe(1);
    expect(workspace.changes()).toHaveLength(1);
  });
});
