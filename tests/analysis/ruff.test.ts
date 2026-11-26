/**
 * Runs the REAL Ruff (Node.js WebAssembly build, same version as the browser)
 * with Lintlands' options on fixture files. If a Ruff upgrade changes field
 * names, codes or positions, these tests are the ones that will tell you.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyzeFile } from "@/lib/analysis/analyzeSources";
import { normalizeDiagnostic } from "@/lib/analysis/normalize";
import { MONSTER_RULES, PROBE_RULES } from "@/lib/analysis/rules";
import { createNodeLint, ruffVersion } from "./nodeLint";

const fixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8");
const lint = createNodeLint();

describe("Ruff with RUFF_OPTIONS", () => {
  it("is the pinned version", () => {
    expect(ruffVersion()).toBe("0.17.6");
  });

  it("finds the minion, elite and boss in buggy.py", () => {
    const file = analyzeFile({ path: "shop/buggy.py", size: 1, source: fixture("buggy.py") }, lint);
    const summary = file.findings.map((f) => [f.line, f.code, f.monster, f.severity]);
    expect(summary).toEqual([
      [3, "F401", "dustBunny", "minion"],
      [6, "B006", "mimic", "elite"],
      [14, "S307", "evalSerpent", "boss"],
    ]);

    const unusedImport = file.findings[0];
    expect(unusedImport.id).toBe("shop/buggy.py:3:8:F401");
    expect(unusedImport.message).toContain("`os`");
    expect(unusedImport.snippet.find((line) => line.hit)).toEqual({ n: 3, text: "import os", hit: true });
  });

  it("turns a syntax error into a single Glitch King", () => {
    const file = analyzeFile({ path: "syntax_error.py", size: 1, source: fixture("syntax_error.py") }, lint);
    expect(file.findings).toHaveLength(1);
    expect(file.findings[0]).toMatchObject({ code: "SYNTAX", monster: "glitchKing", severity: "boss", category: "syntax", line: 4 });
  });

  it("reads Ruff's raw diagnostic fields correctly (normalizeDiagnostic)", () => {
    const raw = lint('"""Module docstring."""\nimport os\n');
    expect(raw.map(normalizeDiagnostic)).toEqual([
      {
        code: "F401",
        message: "`os` imported but unused",
        line: 2,
        col: 8,
        endLine: 2,
        endCol: 10,
        fix: { message: "Remove unused import: `os`", edits: [{ line: 2, col: 1, endLine: 3, endCol: 1, text: "" }] },
      },
    ]);
  });

  it("applies the nested options (Ruff silently ignores misspelled keys)", () => {
    // 11 branches → complexity 12 > max-complexity 10.
    const branches = Array.from({ length: 11 }, (_, i) => `    if x == ${i}:\n        return ${i}`).join("\n");
    const codes = lint(`def pick(x):\n${branches}\n    return -1\n`).map((d) => d.code);
    expect(codes).toContain("C901");
    // max-args is 8: seven arguments are fine.
    expect(lint("def f(a, b, c, d, e, f, g):\n    return a\n").map((d) => d.code)).not.toContain("PLR0913");
    // `id` is on the builtins ignore list, `list` is not.
    expect(lint("def f(id, list):\n    return id, list\n").map((d) => d.message)).toEqual(
      expect.arrayContaining([expect.stringContaining("`list`")]),
    );
    expect(lint("def f(id):\n    return id\n").map((d) => d.code)).not.toContain("A002");
  });

  it("does not let a selected rule code go unrecognised", () => {
    // Ruff throws on unknown selectors, so constructing the workspace is the test.
    expect(() => createNodeLint()).not.toThrow();
    expect(MONSTER_RULES.length).toBeGreaterThan(10);
    expect(PROBE_RULES).toContain("D103");
  });

  it("keeps fake passwords in test files from becoming bosses", () => {
    const source = 'TEST_PASSWORD = "hunter2"\n';
    expect(analyzeFile({ path: "app/settings.py", size: 1, source }, lint).findings.map((f) => f.code)).toEqual(["S105"]);
    expect(analyzeFile({ path: "tests/test_login.py", size: 1, source }, lint).findings).toEqual([]);
  });
});
