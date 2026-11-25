import { describe, expect, it } from "vitest";
import {
  buildFinding,
  MAX_MONSTERS_PER_FILE,
  MAX_MONSTERS_PER_RULE,
  normalizeDiagnostic,
  selectMonsters,
  SNIPPET_MAX_LINE_LENGTH,
  splitLines,
} from "@/lib/analysis/normalize";
import { isProbeRule, ruleInfo } from "@/lib/analysis/rules";
import { MONSTERS } from "@/lib/game/catalog";
import type { Finding } from "@/lib/types";

const LINES = splitLines(Array.from({ length: 40 }, (_, i) => `line ${i + 1}`).join("\n"));

/** A finding for `code` on `line` (one code per row keeps them distinct). */
function finding(code: string, line: number): Finding {
  return buildFinding("pkg/mod.py", { code, message: "msg", line, col: 1, endLine: line, endCol: 5 }, LINES);
}

describe("normalizeDiagnostic", () => {
  it("maps every known syntax-error spelling to SYNTAX", () => {
    for (const code of [null, "invalid-syntax", "E999"]) {
      expect(normalizeDiagnostic({ code, message: "oops", start_location: { row: 2, column: 3 }, end_location: { row: 2, column: 4 } }).code).toBe("SYNTAX");
    }
  });

  it("survives missing locations", () => {
    expect(normalizeDiagnostic({ code: "F401", message: "m" })).toMatchObject({ line: 1, col: 1, endLine: 1, endCol: 1 });
  });
});

describe("buildFinding", () => {
  it("clamps positions past the end of the file (syntax errors at EOF)", () => {
    const f = buildFinding("a.py", { code: "SYNTAX", message: "EOF", line: 99, col: 1, endLine: 99, endCol: 1 }, ["x = (", ""]);
    expect(f.line).toBe(2);
    expect(f.endLine).toBe(2);
    expect(f.id).toBe("a.py:2:1:SYNTAX");
  });

  it("shows ±3 lines of context and trims very long lines", () => {
    const long = "x".repeat(500);
    const lines = ["a", "b", "c", "d", long, "f", "g", "h", "i"];
    const f = buildFinding("a.py", { code: "F841", message: "m", line: 5, col: 1, endLine: 5, endCol: 2 }, lines);
    expect(f.snippet.map((s) => s.n)).toEqual([2, 3, 4, 5, 6, 7, 8]);
    expect(f.snippet.filter((s) => s.hit).map((s) => s.n)).toEqual([5]);
    expect(f.snippet[3].text.length).toBe(SNIPPET_MAX_LINE_LENGTH);
    expect(f.snippet[3].text.endsWith("…")).toBe(true);
  });
});

describe("selectMonsters", () => {
  it("caps a file at 10 monsters, bosses first, then top to bottom", () => {
    const minionCodes = ["F401", "F841", "ERA001", "FIX002", "E711", "SIM102"];
    const minions = Array.from({ length: 12 }, (_, i) => finding(minionCodes[i % minionCodes.length], i + 1));
    const boss = finding("S307", 30);
    const { findings, overflow } = selectMonsters([...minions, boss]);

    expect(findings).toHaveLength(MAX_MONSTERS_PER_FILE);
    expect(overflow).toBe(3);
    // The boss on line 30 made it in; the three lowest minions (lines 10–12) did not.
    expect(findings.map((f) => f.line)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 30]);
  });

  it("allows at most 3 monsters per rule and 1 syntax error", () => {
    const unusedImports = Array.from({ length: 5 }, (_, i) => finding("F401", i + 1));
    const syntaxErrors = [finding("SYNTAX", 20), finding("SYNTAX", 21)];
    const { findings, overflow } = selectMonsters([...unusedImports, ...syntaxErrors]);
    expect(findings.filter((f) => f.code === "F401")).toHaveLength(MAX_MONSTERS_PER_RULE);
    expect(findings.filter((f) => f.code === "SYNTAX")).toHaveLength(1);
    expect(overflow).toBe(3);
  });

  it("merges rules that flag the same line as the same monster", () => {
    // C901 and PLR0915 both point at one big function's name.
    const { findings, overflow } = selectMonsters([finding("C901", 4), finding("PLR0915", 4), finding("F401", 4)]);
    expect(findings.map((f) => f.code)).toEqual(["C901", "F401"]);
    expect(overflow).toBe(0);
  });
});

describe("ruleInfo", () => {
  it("has exact entries for important rules", () => {
    expect(ruleInfo("B006")).toMatchObject({ monster: "mimic", severity: "elite", category: "trap", title: "Mutable default argument" });
    expect(ruleInfo("S105")).toMatchObject({ monster: "keyThief", severity: "boss" });
    expect(ruleInfo("F821")).toMatchObject({ monster: "phantom" });
    expect(ruleInfo("SYNTAX")).toMatchObject({ monster: "glitchKing", severity: "boss" });
  });

  it("falls back by prefix, most specific first", () => {
    expect(ruleInfo("S999")).toMatchObject({ monster: "evalSerpent", severity: "boss", category: "security" });
    expect(ruleInfo("SIM999")).toMatchObject({ monster: "echoBat", severity: "minion" });
    expect(ruleInfo("B999")).toMatchObject({ monster: "gremlin", severity: "elite" });
    expect(ruleInfo("PLR9999")).toMatchObject({ monster: "spaghetti" });
    expect(ruleInfo("ZZZ1")).toMatchObject({ monster: "gremlin" });
  });

  it("always agrees with the catalog about severity", () => {
    for (const code of ["F401", "B006", "S307", "C901", "ERA001", "E722", "S113", "S999", "XYZ"]) {
      const info = ruleInfo(code);
      expect(info.severity).toBe(MONSTERS[info.monster].severity);
      expect(info.tip.length).toBeGreaterThan(10);
    }
  });

  it("knows which rules are only quality probes", () => {
    expect(isProbeRule("D103")).toBe(true);
    expect(isProbeRule("ANN001")).toBe(true);
    expect(isProbeRule("F401")).toBe(false);
  });
});
