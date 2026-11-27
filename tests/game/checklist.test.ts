import { describe, expect, it } from "vitest";
import { buildChecklist, codeSpan } from "@/lib/game/checklist";
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

  it("starts with a header naming the repo, the short SHA and the totals (a fight alone deals with nothing)", () => {
    expect(lines[0]).toBe("# Bug checklist: octocat/potions");
    expect(markdown).toContain(
      "Commit `abc123d` on `main` · **0 of 3** bugs dealt with in Lintlands (0%): 0 fixed in the code · 1 subdued in the game, waiting for a fix · 2 files",
    );
    expect(markdown).toContain("Plus 2 smaller findings not listed below.");
  });

  it("lists each finding as a task, still open when its monster is only subdued", () => {
    expect(lines).toContain("- [ ] `potions/brew.py:3` — **F401** Unused import — `os` imported but unused — _subdued in the game: now fix it in the code_");
    expect(lines).toContain("- [ ] `potions/brew.py:42` — **F821** Undefined name — Undefined name `cauldron`");
  });

  it("groups by file (alphabetically), with a per-file count and an overflow line", () => {
    const headings = lines.filter((line) => line.startsWith("## "));
    expect(headings).toEqual(["## `pkg/__init__.py` (0/1)", "## `potions/brew.py` (0/2)"]);
    const brewStart = lines.indexOf("## `potions/brew.py` (0/2)");
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

describe("buildChecklist with bugs fixed or sealed in the code", () => {
  const bareExcept = makeFinding("potions/brew.py", 7, "swallowToad", { code: "E722", title: "Bare except", message: "Do not use bare `except`" });
  const edited = makeAnalysis([
    { ...makeFile("potions/brew.py", { findings: [unused, undefinedName] }), realFixes: 1, fixedFindings: [bareExcept] },
    { ...makeFile("pkg/fixed.py"), realFixes: 1, fixedFindings: [makeFinding("pkg/fixed.py", 2)] },
  ]);
  const markdown = buildChecklist(edited, { ...emptyProgress(), defeated: [unused.id] });
  const lines = markdown.split("\n");

  it("counts fixed and subdued bugs apart in the header", () => {
    expect(markdown).toContain("**2 of 4** bugs dealt with in Lintlands (50%): 2 fixed in the code · 1 subdued in the game, waiting for a fix · 2 files");
  });

  it("lists a fixed bug as done and says it was fixed in the code", () => {
    expect(lines).toContain("- [x] `potions/brew.py:7` — **E722** Bare except — Do not use bare `except` — _fixed in the code_");
    expect(lines.filter((line) => line.includes("fixed in the code_"))).toHaveLength(2);
  });

  it("keeps a file whose every bug was fixed, and counts it per file", () => {
    expect(lines).toContain("## `pkg/fixed.py` (1/1)");
    expect(lines).toContain("## `potions/brew.py` (1/3)");
  });

  it("ticks a sealed bug but says it was only sealed", () => {
    const sealedList = buildChecklist(edited, { ...emptyProgress(), defeated: [unused.id], sealed: [bareExcept.id] });
    expect(sealedList).toContain("- [x] `potions/brew.py:7` — **E722** Bare except — Do not use bare `except` — _ignored with `# noqa`_");
    expect(sealedList).toContain("**2 of 4** bugs dealt with in Lintlands (50%): 1 fixed in the code, 1 ignored");
  });

  it("points at the Workshop's patch", () => {
    expect(markdown).toContain("download them as a patch (or a zip) from its Changes tab");
    expect(buildChecklist(analysis, emptyProgress())).not.toContain("Changes tab");
  });
});

describe("codeSpan", () => {
  it("uses a single backtick fence for ordinary names", () => {
    expect(codeSpan("potions/brew.py")).toBe("`potions/brew.py`");
  });

  it("fences with one more backtick than the name contains, so the span cannot end early", () => {
    expect(codeSpan("a`b.py")).toBe("``a`b.py``");
    expect(codeSpan("a``b`c.py")).toBe("```a``b`c.py```");
    // Padding keeps a leading or trailing backtick from merging into the fence.
    expect(codeSpan("`x")).toBe("`` `x ``");
  });

  it("keeps a hostile file name from injecting a link into the checklist", () => {
    const path = "x`[click](https://evil.example)`.py";
    const hostile = makeFinding(path, 1);
    const out = buildChecklist(makeAnalysis([makeFile(path, { findings: [hostile] })]), emptyProgress());
    expect(out).toContain(`## \`\`${path}\`\` (0/1)`);
    expect(out).toContain(`- [ ] \`\`${path}:1\`\` — `);
  });
});
