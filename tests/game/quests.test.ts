/**
 * Quests: the board is chosen deterministically from the repo, stays varied
 * and never empty, and each kind of quest completes on exactly the right
 * change to the code (and not on a near miss).
 *
 * Most tests edit the real demo kingdom and re-run the real linter on the
 * edited file, exactly as a forge does.
 */
import { describe, expect, it } from "vitest";
import { analyzeFile } from "@/lib/analysis/analyzeSources";
import { analyzeDemoSources, DEMO_SOURCES } from "@/lib/analysis/demo";
import { emptyProgress } from "@/lib/game/progress";
import { QUEST_BOARD_SIZE, QUEST_REWARDS, questId } from "@/lib/game/quests";
import { emptyQuests, questBoard, updateBoard } from "@/lib/game/questsBoard";
import { checkQuest } from "@/lib/game/questsCheck";
import { findCandidates } from "@/lib/game/questsFind";
import type { FixQuestSpec, QuestSpec, RepoQuests } from "@/lib/game/questsTypes";
import type { AnalyzedFile, Definition, RepoAnalysis, RepoProgress } from "@/lib/types";
import { createNodeLint } from "../analysis/nodeLint";
import { makeAnalysis, makeFile, makeFinding } from "./helpers";

const lint = createNodeLint();
const demo = analyzeDemoSources(lint);

function sourceOf(path: string): string {
  const file = DEMO_SOURCES.find((f) => f.path === path);
  if (!file) throw new Error(`no demo file ${path}`);
  return file.source;
}

/** The analysis after "forging" new text for one file: that file is linted again, like the workspace does. */
function forged(analysis: RepoAnalysis, path: string, source: string, realFixes = 0): RepoAnalysis {
  const file: AnalyzedFile = { ...analyzeFile({ path, size: source.length, source }, lint), realFixes };
  return { ...analysis, files: analysis.files.map((f) => (f.path === path ? file : f)) };
}

/** The demo file with one piece of text replaced (the test fails loudly if the text is not there). */
function edited(path: string, from: string, to: string): string {
  const source = sourceOf(path);
  if (!source.includes(from)) throw new Error(`"${from}" not in ${path}`);
  return source.replace(from, to);
}

function posted(analysis: RepoAnalysis, progress: RepoProgress = emptyProgress()): RepoQuests {
  return updateBoard(undefined, analysis, progress).quests;
}

function definition(name: string, line: number, docstring: string | null = null): Definition {
  return { name, kind: "function", line, endLine: line + 3, branches: 0, docstring };
}

function withDefinitions(file: AnalyzedFile, definitions: Definition[]): AnalyzedFile {
  return { ...file, outline: { ...file.outline, definitions } };
}

describe("choosing the board", () => {
  const board = posted(demo);

  it("posts a full, varied board for the demo: one quest of every kind", () => {
    expect(board.active).toHaveLength(QUEST_BOARD_SIZE);
    expect(board.active.map((quest) => quest.kind)).toEqual(["fix", "document", "grade", "purify", "tidy"]);
    const specificPaths = board.active.filter((quest) => quest.kind !== "tidy").map((quest) => quest.path);
    expect(new Set(specificPaths).size).toBe(QUEST_BOARD_SIZE - 1);
  });

  it("names real places in the code, with a specific title", () => {
    const view = questBoard(emptyProgress(), demo).active;
    const fix = view.find((quest) => quest.kind === "fix")!;
    expect(fix.title).toMatch(/^Remove the unused import at line 3 of bakery\/recipes\.py$/);
    expect(fix.target).toEqual({ path: "bakery/recipes.py", line: 3 });
    const doc = view.find((quest) => quest.kind === "document")!;
    expect(doc.title).toBe("Document make_printers() in potions/labels.py");
    expect(doc.target).toEqual({ path: "potions/labels.py", line: 17, name: "make_printers" });
    expect(view.every((quest) => quest.reward === QUEST_REWARDS[quest.kind])).toBe(true);
  });

  it("is deterministic for a repo and changes with the commit", () => {
    expect(posted(demo)).toEqual(board);
    const tied = makeAnalysis(Array.from({ length: 30 }, (_, i) => makeFile(`f${i}.py`, { findings: [makeFinding(`f${i}.py`, 2)] })));
    const fixFor = (sha: string) => posted({ ...tied, repo: { ...tied.repo, sha } }).active[0].path;
    expect(fixFor("a".repeat(40))).toBe(fixFor("a".repeat(40)));
    expect(new Set(["a", "b", "c", "d", "e", "f"].map((c) => fixFor(c.repeat(40)))).size).toBeGreaterThan(1);
  });

  it("prefers plain fixes, purifying files with two or three bugs, and public functions", () => {
    const candidates = findCandidates(demo);
    expect(candidates.fix.slice(0, 5).every((spec) => ["F401", "F841", "E711", "ERA001", "FIX001", "FIX002", "F632", "SIM118", "PLW0133", "B006"].includes(spec.code))).toBe(true);
    expect(candidates.purify[0].bugs).toBeGreaterThan(1);
    expect(candidates.document.map((spec) => spec.name)).not.toContain("Cauldron.__init__");
    expect(candidates.document[0].name).toBe("make_printers");
  });

  it("is never empty: one file, no functions, no findings, a spotless repo, 150 files", () => {
    const shapes: RepoAnalysis[] = [
      makeAnalysis([makeFile("solo.py", { findings: [makeFinding("solo.py", 1)] })]),
      makeAnalysis([makeFile("constants.py", { grade: "A" })]),
      makeAnalysis([withDefinitions(makeFile("tidy.py", { grade: "S" }), [definition("helper", 3, "Helps.")])]),
      makeAnalysis(Array.from({ length: 150 }, (_, i) => makeFile(`pkg/m${i}.py`, { findings: i % 3 === 0 ? [makeFinding(`pkg/m${i}.py`, 4)] : [] }))),
      forged(demo, "bakery/recipes.py", sourceOf("bakery/oven.py")),
    ];
    for (const analysis of shapes) {
      const quests = posted(analysis);
      expect(quests.active.length).toBeGreaterThan(0);
      expect(quests.active.at(-1)?.kind).toBe("tidy");
      expect(quests.active.length).toBeLessThanOrEqual(QUEST_BOARD_SIZE);
    }
    // The 150-file repo still gets a full board, spread over different files.
    const big = posted(shapes[3]);
    expect(big.active).toHaveLength(QUEST_BOARD_SIZE);
  });

  it("asks a spotless repo for a note when there is nothing to fix or document", () => {
    const spotless = makeAnalysis([withDefinitions(makeFile("tidy.py", { grade: "S" }), [definition("helper", 3, "Helps.")])]);
    const [tidy] = posted(spotless).active;
    expect(tidy).toMatchObject({ kind: "tidy", task: "comment", path: "tidy.py", goal: 1 });
  });

  it("gives every saved quest an id built only from its target (never from a line number)", () => {
    for (const spec of board.active) expect(spec.id).toBe(questId(spec));
    const fix = board.active[0] as FixQuestSpec;
    expect(questId({ ...fix, line: fix.line + 7 })).toBe(fix.id);
  });
});

describe("completing each kind of quest", () => {
  const board = posted(demo);
  const quest = (kind: QuestSpec["kind"]) => board.active.find((spec) => spec.kind === kind)!;
  const state = (spec: QuestSpec, analysis: RepoAnalysis, progress = emptyProgress()) => checkQuest(spec, analysis, progress).state;

  it("fix: done when the bug is gone, not when a line is inserted above it or another bug is fixed", () => {
    const fix = quest("fix");
    expect(state(fix, demo)).toBe("open");
    expect(state(fix, forged(demo, "bakery/recipes.py", edited("bakery/recipes.py", "import os\n", "")))).toBe("done");

    const shifted = forged(demo, "bakery/recipes.py", edited("bakery/recipes.py", "import os\n", "\nimport os\n"));
    expect(state(fix, shifted)).toBe("open");
    expect(checkQuest(fix, shifted, emptyProgress()).target.line).toBe(4);

    const otherFixed = forged(demo, "bakery/recipes.py", edited("bakery/recipes.py", "    leftovers = recipe.get(\"leftovers\")\n", ""));
    expect(state(fix, otherFixed)).toBe("open");

    // A syntax error hides Ruff's other findings: the bug only looks gone, so the quest waits.
    const broken = forged(demo, "bakery/recipes.py", edited("bakery/recipes.py", "    return scaled\n", "    return scaled(\n"));
    expect(broken.files.find((f) => f.path === "bakery/recipes.py")!.findings.map((f) => f.code)).not.toContain("F401");
    expect(state(fix, broken)).toBe("open");
  });

  it("document: done when that function gets a docstring, not a different one; gone when it is renamed", () => {
    const doc = quest("document");
    const documented = edited("potions/labels.py", "def make_printers(colors):\n", 'def make_printers(colors):\n    """One printer per ink colour."""\n');
    expect(state(doc, forged(demo, "potions/labels.py", documented))).toBe("done");

    const otherDocumented = edited("tools/inventory.py", "def merge_shelves(*shelves):\n", 'def merge_shelves(*shelves):\n    """Add up several shelves."""\n');
    expect(state(doc, forged(demo, "tools/inventory.py", otherDocumented))).toBe("open");
    const commentOnly = edited("potions/labels.py", "def make_printers(colors):\n", "def make_printers(colors):\n    # One printer per ink colour.\n");
    expect(state(doc, forged(demo, "potions/labels.py", commentOnly))).toBe("open");

    const renamed = edited("potions/labels.py", "def make_printers(colors):", "def build_printers(colors):");
    expect(state(doc, forged(demo, "potions/labels.py", renamed))).toBe("gone");
  });

  it("grade: done when the file reaches the next grade, with the score as progress", () => {
    const grade = quest("grade");
    expect(grade).toMatchObject({ path: "potions/cauldron.py", from: "A", to: "S" });
    expect(checkQuest(grade, demo, emptyProgress())).toMatchObject({ state: "open", current: 80, goal: 85 });
    const mended = edited("potions/cauldron.py", "self.contents.append(ingredient\n", "self.contents.append(ingredient)\n");
    const after = forged(demo, "potions/cauldron.py", mended);
    expect(after.files.find((f) => f.path === "potions/cauldron.py")!.quality.grade).toBe("S");
    expect(state(grade, after)).toBe("done");
    // A grade that only looks higher because a syntax error hides the bugs does not count.
    const hidden = { ...after, files: after.files.map((f) => (f.path === grade.path ? { ...f, findings: demo.files.find((d) => d.path === grade.path)!.findings } : f)) };
    expect(state(grade, hidden)).toBe("open");
  });

  it("purify: done only when every bug in the file is fixed by editing (defeating monsters does not count)", () => {
    const config = posted(demo).active.find((spec) => spec.kind === "purify")!;
    const path = config.path;
    const file = demo.files.find((f) => f.path === path)!;
    expect(checkQuest(config, demo, emptyProgress())).toMatchObject({ state: "open", current: 0, goal: file.findings.length });
    const fought = { ...emptyProgress(), defeated: file.findings.map((f) => f.id) };
    expect(state(config, demo, fought)).toBe("open");

    const oneLeft = { ...file, findings: file.findings.slice(1) };
    const partly = { ...demo, files: demo.files.map((f) => (f.path === path ? oneLeft : f)) };
    expect(checkQuest(config, partly, emptyProgress())).toMatchObject({ state: "open", current: 1 });
    const clean = { ...demo, files: demo.files.map((f) => (f.path === path ? { ...file, findings: [] } : f)) };
    expect(state(config, clean)).toBe("done");
  });

  it("tidy: counts real fixes, docstrings, defeated monsters or comments made after it was posted", () => {
    const fixAny = quest("tidy");
    expect(fixAny).toMatchObject({ task: "fixAny", baseline: 0, goal: 2 });
    const oneFix = forged(demo, "bakery/recipes.py", edited("bakery/recipes.py", "import os\n", ""), 1);
    expect(checkQuest(fixAny, oneFix, emptyProgress())).toMatchObject({ state: "open", current: 1, goal: 2 });
    const twoFixes = forged(demo, "bakery/recipes.py", edited("bakery/recipes.py", "import os\n", ""), 2);
    expect(state(fixAny, twoFixes)).toBe("done");

    const note: QuestSpec = { kind: "tidy", id: "tidy:9", path: "config.py", task: "comment", round: 9, baseline: 2, goal: 1 };
    expect(state(note, demo)).toBe("open");
    const commented = forged(demo, "config.py", `# Settings live here.\n${sourceOf("config.py")}`);
    expect(state(note, commented)).toBe("done");

    const squash: QuestSpec = { kind: "tidy", id: "tidy:10", path: "config.py", task: "squash", round: 10, baseline: 0, goal: 3 };
    const ids = demo.files.flatMap((f) => f.findings.map((finding) => finding.id));
    expect(state(squash, demo, { ...emptyProgress(), defeated: ids.slice(0, 2) })).toBe("open");
    expect(state(squash, demo, { ...emptyProgress(), defeated: ids.slice(0, 3) })).toBe("done");
  });

  it("tidy: gone when the code can no longer give what it asks for", () => {
    const fixAny: QuestSpec = { kind: "tidy", id: "tidy:1", path: "solo.py", task: "fixAny", round: 1, baseline: 0, goal: 2 };
    const oneBugLeft = makeAnalysis([makeFile("solo.py", { findings: [makeFinding("solo.py", 1)] })]);
    expect(state(fixAny, oneBugLeft)).toBe("gone");
  });

  it("any quest about a file that disappeared (or failed to load) is gone", () => {
    for (const spec of board.active.filter((s) => s.kind !== "tidy")) {
      const without = { ...demo, files: demo.files.map((f) => (f.path === spec.path ? { ...f, status: "failed" as const } : f)) };
      expect(state(spec, without)).toBe("gone");
    }
  });
});

describe("updating the board", () => {
  it("moves completed quests to done and recent, and refills with a different quest", () => {
    const board = posted(demo);
    const after = forged(demo, "bakery/recipes.py", edited("bakery/recipes.py", "import os\n", ""));
    const { quests, completed } = updateBoard(board, after, emptyProgress());
    expect(completed.map((spec) => spec.kind)).toEqual(["fix"]);
    expect(quests.done).toEqual([board.active[0].id]);
    expect(quests.recent).toEqual([board.active[0]]);
    expect(quests.active).toHaveLength(QUEST_BOARD_SIZE);
    expect(quests.active.map((spec) => spec.id)).not.toContain(board.active[0].id);
    expect(quests.active.at(-1)?.kind).toBe("tidy");
  });

  it("quietly replaces a quest whose target vanished, without completing it", () => {
    const board = posted(demo);
    const renamed = forged(demo, "potions/labels.py", edited("potions/labels.py", "def make_printers(colors):", "def build_printers(colors):"));
    const { quests, completed } = updateBoard(board, renamed, emptyProgress());
    expect(completed).toEqual([]);
    expect(quests.done).toEqual([]);
    expect(quests.active.map((spec) => spec.id)).not.toContain("document:potions/labels.py:make_printers");
    // Another "Light the lantern" quest takes its place, so the board keeps its variety.
    const kinds = (specs: QuestSpec[]) => specs.map((spec) => spec.kind).sort();
    expect(kinds(quests.active)).toEqual(kinds(board.active));
    expect(quests.active).toHaveLength(QUEST_BOARD_SIZE);
  });

  it("never posts a completed quest again, even if the bug comes back", () => {
    const board = posted(demo);
    const fixed = forged(demo, "bakery/recipes.py", edited("bakery/recipes.py", "import os\n", ""));
    const once = updateBoard(board, fixed, emptyProgress()).quests;
    const reverted = updateBoard(once, demo, emptyProgress()).quests;
    expect(reverted.active.map((spec) => spec.id)).not.toContain(board.active[0].id);
  });

  it("returns the very same board when nothing changed", () => {
    const board = posted(demo);
    expect(updateBoard(board, demo, emptyProgress()).quests).toBe(board);
    const empty = emptyQuests();
    expect(updateBoard(empty, makeAnalysis([]), emptyProgress()).quests).toBe(empty);
  });

  it("numbers each tidy-up chore anew and rotates what it asks", () => {
    const board = posted(demo);
    const twoFixes = forged(demo, "bakery/recipes.py", edited("bakery/recipes.py", "import os\n", ""), 2);
    const next = updateBoard(board, twoFixes, emptyProgress()).quests;
    const tidy = next.active.at(-1)!;
    expect(tidy).toMatchObject({ kind: "tidy", id: "tidy:2", round: 2, task: "documentAny" });
    expect(next.tidyRounds).toBe(2);
  });
});
