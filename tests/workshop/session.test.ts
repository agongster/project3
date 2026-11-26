import { describe, expect, it } from "vitest";
import {
  EMPTY_SESSION,
  closeTab,
  dirtyPaths,
  editBuffer,
  isDirty,
  loadBuffer,
  markForged,
  openTab,
  resetBuffer,
  sessionFor,
} from "@/components/workshop/logic/session";

const FILE = { original: "a = 1\n", saved: "a = 1\n" };

describe("tabs", () => {
  it("opens tabs at the end and brings them to the front", () => {
    let state = openTab(EMPTY_SESSION, "a.py");
    state = openTab(state, "b.py");
    state = openTab(state, "a.py");
    expect(state.tabs).toEqual(["a.py", "b.py"]);
    expect(state.active).toBe("a.py");
  });

  it("returns the same state when nothing changes", () => {
    const state = openTab(EMPTY_SESSION, "a.py");
    expect(openTab(state, "a.py")).toBe(state);
    expect(closeTab(state, "missing.py")).toBe(state);
  });

  it("brings the right-hand neighbour to the front when the active tab closes", () => {
    let state = ["a.py", "b.py", "c.py"].reduce(openTab, EMPTY_SESSION);
    state = openTab(state, "b.py");
    expect(closeTab(state, "b.py").active).toBe("c.py");
    expect(closeTab(openTab(state, "c.py"), "c.py").active).toBe("b.py");
    expect(closeTab(openTab(EMPTY_SESSION, "a.py"), "a.py").active).toBeNull();
  });
});

describe("buffers", () => {
  it("tracks unforged typing", () => {
    let state = loadBuffer(EMPTY_SESSION, "a.py", FILE);
    expect(isDirty(state.buffers.get("a.py"))).toBe(false);
    state = editBuffer(state, "a.py", "a = 2\n");
    expect(isDirty(state.buffers.get("a.py"))).toBe(true);
    expect(dirtyPaths(state)).toEqual(["a.py"]);
    state = markForged(state, "a.py", "a = 2\n");
    expect(isDirty(state.buffers.get("a.py"))).toBe(false);
  });

  it("keeps typing done while a forge was running", () => {
    let state = editBuffer(loadBuffer(EMPTY_SESSION, "a.py", FILE), "a.py", "a = 3\n");
    state = markForged(state, "a.py", "a = 2\n");
    expect(state.buffers.get("a.py")).toEqual({ original: "a = 1\n", saved: "a = 2\n", text: "a = 3\n" });
  });

  it("keeps unforged text when the file is read again", () => {
    let state = editBuffer(loadBuffer(EMPTY_SESSION, "a.py", FILE), "a.py", "typed");
    state = loadBuffer(state, "a.py", FILE);
    expect(state.buffers.get("a.py")?.text).toBe("typed");
  });

  it("keeps unforged text when the tab is closed", () => {
    let state = editBuffer(loadBuffer(openTab(EMPTY_SESSION, "a.py"), "a.py", FILE), "a.py", "typed");
    state = closeTab(state, "a.py");
    expect(state.buffers.get("a.py")?.text).toBe("typed");
    expect(dirtyPaths(state)).toEqual(["a.py"]);
  });

  it("resets every version on revert", () => {
    let state = editBuffer(loadBuffer(EMPTY_SESSION, "a.py", { original: "o", saved: "s" }), "a.py", "t");
    state = resetBuffer(state, "a.py", "o");
    expect(state.buffers.get("a.py")).toEqual({ original: "o", saved: "o", text: "o" });
  });

  it("treats odd file names as plain keys", () => {
    const state = loadBuffer(EMPTY_SESSION, "constructor", FILE);
    expect(state.buffers.get("constructor")?.text).toBe(FILE.saved);
    expect(EMPTY_SESSION.buffers.get("constructor")).toBeUndefined();
  });

  it("lists dirty open tabs first, then closed ones", () => {
    let state = ["a.py", "b.py", "c.py"].reduce((s, path) => editBuffer(loadBuffer(s, path, FILE), path, "x"), EMPTY_SESSION);
    state = openTab(openTab(state, "c.py"), "b.py");
    expect(dirtyPaths(state)).toEqual(["c.py", "b.py", "a.py"]);
  });
});

describe("sessionFor", () => {
  it("gives each workspace one session that survives re-opening", () => {
    const workspace = {};
    const first = sessionFor(workspace);
    first.store.set((state) => openTab(state, "a.py"));
    expect(sessionFor(workspace)).toBe(first);
    expect(sessionFor(workspace).store.get().tabs).toEqual(["a.py"]);
    expect(sessionFor({})).not.toBe(first);
  });
});
