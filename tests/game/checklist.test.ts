import { describe, expect, it } from "vitest";
import { buildChecklist } from "@/lib/game/checklist";
import { emptyProgress } from "@/lib/game/progress";
import { makeAnalysis, makeFile, makeFinding } from "./helpers";

const unused = makeFinding("potions/brew.py", 3);
const undefinedName = makeFinding("potions/brew.py", 42, "phantom", {
  code: "F821",
  title: "Undefined name",
  message: "Undefined name `cauldron`",
});
const initBug = makeFinding("pkg/__init__.py", 1, "todoMite", {
  code: "D104",
  title: "Missing docstring",
  message: "Missing docstring in public package __init__ *really*",
});

const analysis = makeAnalysis([
  makeFile("potions/brew.py", { findings: [unused, undefinedName], overflow: 2 }),
  makeFile("clean.py", { grade: "S" }),
  makeFile("pkg/__init__.py", { findings: [initBug] }),
  makeFile("broken.py", { status: "failed" }),
]);

describe("buildChecklist", () => {
  const markdown = buildChecklist(analysis, { ...emptyProgress(), defeated: [unused.id] });
  const lines = markdown.split("\n");

  it("starts with a header naming the repo, the short SHA and the totals", () => {
    expect(lines[0]).toBe("# Bug checklist: octocat/potions");
    expect(markdown).toContain("Commit `abc123d` on `main` · **1 of 3** bugs squashed in Lintlands (33%) · 2 files");
    expect(markdown).toContain("Plus 2 smaller findings not listed below.");
  });

  it("lists each finding as a task, ticked when defeated", () => {
    expect(lines).toContain("- [x] `potions/brew.py:3` — **F401** Unused import — `os` imported but unused");
    expect(lines).toContain("- [ ] `potions/brew.py:42` — **F821** Undefined name — Undefined name `cauldron`");
  });

  it("groups by file (alphabetically), with a per-file count and an overflow line", () => {
    const headings = lines.filter((line) => line.startsWith("## "));
    expect(headings).toEqual(["## `pkg/__init__.py` (0/1)", "## `potions/brew.py` (1/2)"]);
    const brewStart = lines.indexOf("## `potions/brew.py` (1/2)");
    expect(lines.slice(brewStart + 2, brewStart + 5)).toEqual([
      expect.stringContaining(":3`"),
      expect.stringContaining(":42`"),
      "- +2 more smaller findings not shown",
    ]);
  });

  it("leaves out clean and failed files", () => {
    expect(markdown).not.toContain("clean.py");
    expect(markdown).not.toContain("broken.py");
  });

  it("escapes Markdown in messages so __init__ does not turn bold", () => {
    expect(markdown).toContain("Missing docstring in public package \\_\\_init\\_\\_ \\*really\\*");
  });

  it("collapses multi-line messages onto one line", () => {
    const multi = makeFinding("a.py", 1, "dustBunny", { message: "first line\n  second line" });
    const out = buildChecklist(makeAnalysis([makeFile("a.py", { findings: [multi] })]), emptyProgress());
    expect(out).toContain("— first line second line");
  });

  it("congratulates a spotless repo", () => {
    const out = buildChecklist(makeAnalysis([makeFile("clean.py")]), emptyProgress());
    expect(out).toContain("No findings");
    expect(out).not.toContain("- [ ]");
  });

  it("ends with exactly one newline", () => {
    expect(markdown.endsWith("\n")).toBe(true);
    expect(markdown.endsWith("\n\n")).toBe(false);
  });
});
