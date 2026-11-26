/**
 * Checking while typing (exact ranges, Ruff's quick fixes, results that
 * can't arrive out of order), formatting, and what happens when Ruff or its
 * worker fails.
 */
import { describe, expect, it } from "vitest";
import { LinterDiedError, type LintClient } from "@/lib/analysis/lintClient";
import { isSuperseded, LinterUnavailableError, type LiveFinding } from "@/lib/workspace";
import { latestOnly, SupersededError } from "@/lib/workspace/latestOnly";
import { superviseLinter } from "@/lib/workspace/linter";
import { nodeLintClient } from "../analysis/nodeLint";
import { demoSource, MemoryStorage, openDemo, viewOf } from "./helpers";

const RECIPES = "bakery/recipes.py";

/** The text a live finding's range covers (columns are JavaScript string indices + 1, end exclusive). */
function covered(source: string, finding: LiveFinding): string {
  const lines = source.split("\n");
  const { line, col, endLine, endCol } = finding.range;
  if (line !== endLine) throw new Error("single-line ranges only in this test");
  return lines[line - 1].slice(col - 1, endCol - 1);
}

/** Applies a quick fix's edits in the given order (last first), like the editor will. */
function applyQuickFix(source: string, finding: LiveFinding): string {
  const lines = source.split("\n");
  const offset = (line: number, col: number) => lines.slice(0, line - 1).reduce((sum, text) => sum + text.length + 1, 0) + col - 1;
  let text = source;
  for (const edit of finding.quickFix!.edits) {
    text = text.slice(0, offset(edit.line, edit.col)) + edit.text + text.slice(offset(edit.endLine, edit.endCol));
  }
  return text;
}

describe("check", () => {
  it("returns every finding with its exact range, even after emoji and tabs", async () => {
    const workspace = await openDemo();
    const source = 'import os\nlabel = "😀 crème brûlée"; total = undefined_name\nif label:\n\tif label == None:\n\t\tpass\n';
    const live = await workspace.check(RECIPES, source);
    const byCode = new Map(live.findings.map((finding) => [finding.finding.code, finding]));

    expect(covered(source, byCode.get("F401")!)).toBe("os");
    expect(covered(source, byCode.get("F821")!)).toBe("undefined_name");
    expect(covered(source, byCode.get("E711")!)).toBe("None");
    expect(live.findings.map((finding) => finding.range.line)).toEqual([...live.findings.map((finding) => finding.range.line)].sort((a, b) => a - b));
    expect(live.quality.grade).toMatch(/[SABC]/);
  });

  it("offers Ruff's quick fix, marks which ones are safe, and the fix really fixes", async () => {
    const workspace = await openDemo();
    const source = demoSource(RECIPES);
    const live = await workspace.check(RECIPES, source);
    const unusedImport = live.findings.find((finding) => finding.finding.code === "F401")!;
    expect(unusedImport.quickFix).toMatchObject({ title: "Remove unused import: `os`", safe: true });
    const noneCompare = live.findings.find((finding) => finding.finding.code === "E711")!;
    expect(noneCompare.quickFix?.safe).toBe(false);
    expect(live.findings.find((finding) => finding.finding.code === "FIX002")!.quickFix).toBeNull();

    const fixedText = applyQuickFix(source, unusedImport);
    expect(fixedText).not.toContain("import os\n");
    const after = await workspace.check(RECIPES, fixedText);
    expect(after.findings.map((finding) => finding.finding.code)).not.toContain("F401");
  });

  it("orders a multi-edit fix last edit first", async () => {
    const workspace = await openDemo();
    const live = await workspace.check("bakery/orders.py", demoSource("bakery/orders.py"));
    const edits = live.findings.find((finding) => finding.finding.code === "B006")!.quickFix!.edits;
    expect(edits.length).toBeGreaterThan(1);
    for (let i = 1; i < edits.length; i++) expect(edits[i - 1].line > edits[i].line || (edits[i - 1].line === edits[i].line && edits[i - 1].col >= edits[i].col)).toBe(true);
  });

  it("changes nothing in the world", async () => {
    const workspace = await openDemo();
    const before = workspace.analysis.get();
    await workspace.check(RECIPES, "import os\nimport sys\n");
    expect(workspace.analysis.get()).toBe(before);
    expect(workspace.changes()).toEqual([]);
  });

  it("only resolves the newest check of a file; older ones reject as superseded", async () => {
    const workspace = await openDemo();
    const first = workspace.check(RECIPES, "import os\n");
    const second = workspace.check(RECIPES, "import os\nimport sys\n");
    const third = workspace.check(RECIPES, "import os\nimport sys\nimport json\n");
    const other = workspace.check("main.py", "import os\n");
    const results = await Promise.allSettled([first, second, third, other]);
    expect(results.map((result) => result.status)).toEqual(["rejected", "rejected", "fulfilled", "fulfilled"]);
    expect(isSuperseded((results[0] as PromiseRejectedResult).reason)).toBe(true);
    expect(isSuperseded((results[1] as PromiseRejectedResult).reason)).toBe(true);
    expect((results[2] as PromiseFulfilledResult<{ findings: unknown[] }>).value.findings).toHaveLength(3);
  });
});

describe("latestOnly", () => {
  it("runs one request per key at a time and skips the ones replaced while waiting", async () => {
    const ran: string[] = [];
    const release: (() => void)[] = [];
    const run = latestOnly((key, input) => {
      ran.push(`${key}:${input}`);
      return new Promise<string>((resolve) => release.push(() => resolve(input)));
    });
    const a = run("f", "a");
    const b = run("f", "b");
    const c = run("f", "c");
    await expect(b).rejects.toBeInstanceOf(SupersededError); // replaced before it ever ran
    release.shift()!();
    await expect(a).rejects.toBeInstanceOf(SupersededError); // finished, but "c" was asked for since
    await Promise.resolve();
    release.shift()!();
    await expect(c).resolves.toBe("c");
    expect(ran).toEqual(["f:a", "f:c"]);
  });

  it("passes errors of the newest request through", async () => {
    const run = latestOnly(async () => {
      throw new Error("ruff panic");
    });
    await expect(run("f", "x")).rejects.toThrow("ruff panic");
  });
});

describe("format", () => {
  it("formats with Ruff's formatter", async () => {
    const workspace = await openDemo();
    expect(await workspace.format("x = (1,\n2)\n")).toBe("x = (1, 2)\n");
  });

  it("rejects text with a syntax error with a friendly message", async () => {
    const workspace = await openDemo();
    await expect(workspace.format("def broken(:\n    pass\n")).rejects.toThrow("syntax error");
  });
});

describe("when Ruff or its worker fails", () => {
  /** A Node Ruff client whose lint throws (like a Ruff panic) for texts containing `poison`. */
  async function touchyClient(): Promise<LintClient> {
    const client = await nodeLintClient();
    return { ...client, lint: (source) => (source.includes("poison") ? Promise.reject(new Error("RuntimeError: unreachable")) : client.lint(source)) };
  }

  it("a forge Ruff can't read changes nothing and says so kindly", async () => {
    const storage = new MemoryStorage();
    const workspace = await openDemo(storage, touchyClient);
    const before = workspace.analysis.get();
    await expect(workspace.forge(RECIPES, "poison = 1\n")).rejects.toThrow("wasn't forged");
    expect(workspace.analysis.get()).toBe(before);
    expect(workspace.changes()).toEqual([]);
    expect(storage.data.size).toBe(0);
    expect((await workspace.read(RECIPES)).saved).toBe(demoSource(RECIPES));
    // The next forge works normally.
    expect((await workspace.forge(RECIPES, demoSource(RECIPES).replace("import os\n", ""))).fixed).toHaveLength(1);
    expect(viewOf(workspace, RECIPES).realFixes).toBe(1);
  });

  it("a dead worker is replaced by a fresh one and the request retried", async () => {
    let started = 0;
    const flaky = async (): Promise<LintClient> => {
      started++;
      const client = await nodeLintClient();
      // The first worker dies on its first request after loading.
      if (started === 1) return { ...client, lint: async () => Promise.reject(new LinterDiedError("The bug detector crashed.")) };
      return client;
    };
    const linter = superviseLinter(await flaky(), flaky);
    expect((await linter.lint("import os\n")).map((diagnostic) => diagnostic.code)).toContain("F401");
    expect(started).toBe(2);
  });

  it("gives up with a friendly error when no worker will start", async () => {
    const dying = async (): Promise<LintClient> => ({ ...(await nodeLintClient()), lint: () => Promise.reject(new LinterDiedError("gone")) });
    const linter = superviseLinter(await dying(), () => Promise.reject(new Error("wasm 404")));
    await expect(linter.lint("x = 1\n")).rejects.toBeInstanceOf(LinterUnavailableError);
    // …and passes Ruff's own complaints about a text straight through.
    const plain = superviseLinter(await nodeLintClient(), nodeLintClient);
    await expect(plain.format("def (:\n")).rejects.not.toBeInstanceOf(LinterUnavailableError);
  });
});
