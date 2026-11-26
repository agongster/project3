/**
 * reconcileFindings: pairing the findings of two versions of a file. Plain
 * fake findings built from real lines of text (the pairing reads each
 * finding's offending line from its snippet), plus property-style checks
 * with seeded random edits.
 */
import { describe, expect, it } from "vitest";
import { buildFinding, splitLines } from "@/lib/analysis/normalize";
import { mulberry32 } from "@/lib/rng";
import type { Finding } from "@/lib/types";
import { lineSimilarity, MAX_CANDIDATE_PAIRS, reconcileFindings } from "@/lib/workspace/reconcile";

interface Spec {
  code: string;
  line: number;
  col?: number;
  message?: string;
}

/** Findings of `source` (one per spec), in line order like a real full list. */
function findingsOf(source: string, specs: Spec[]): Finding[] {
  const lines = splitLines(source);
  return specs
    .map((spec) => buildFinding("pkg/mod.py", { code: spec.code, message: spec.message ?? `${spec.code} here`, line: spec.line, col: spec.col ?? 1, endLine: spec.line, endCol: (spec.col ?? 1) + 3 }, lines))
    .sort((a, b) => a.line - b.line || a.col - b.col);
}

const ids = (findings: readonly Finding[]) => findings.map((finding) => finding.id);

describe("reconcileFindings", () => {
  const before = "import os\nimport sys\n\nx = 1\nif x == None:\n    pass\n";
  const beforeFindings = findingsOf(before, [
    { code: "F401", line: 1, col: 8, message: "`os` imported but unused" },
    { code: "F401", line: 2, col: 8, message: "`sys` imported but unused" },
    { code: "E711", line: 5, col: 9 },
  ]);

  it("reports nothing for the same findings", () => {
    const result = reconcileFindings(beforeFindings, beforeFindings);
    expect(result.fixed).toEqual([]);
    expect(result.introduced).toEqual([]);
    expect(result.kept.map((pair) => [pair.before.id, pair.after.id])).toEqual(ids(beforeFindings).map((id) => [id, id]));
  });

  it("follows findings that moved because a line was added above them", () => {
    const after = `# a comment\n${before}`;
    const afterFindings = findingsOf(after, [
      { code: "F401", line: 2, col: 8, message: "`os` imported but unused" },
      { code: "F401", line: 3, col: 8, message: "`sys` imported but unused" },
      { code: "E711", line: 6, col: 9 },
    ]);
    const result = reconcileFindings(beforeFindings, afterFindings);
    expect(result.fixed).toEqual([]);
    expect(result.introduced).toEqual([]);
    expect(result.kept.map((pair) => [pair.before.line, pair.after.line])).toEqual([
      [1, 2],
      [2, 3],
      [5, 6],
    ]);
  });

  it("ignores re-indentation and spacing on the offending line", () => {
    const after = "import os\nimport sys\n\nx = 1\nif True:\n    if x==None:\n        pass\n";
    const afterFindings = findingsOf(after, [
      { code: "F401", line: 1, col: 8, message: "`os` imported but unused" },
      { code: "F401", line: 2, col: 8, message: "`sys` imported but unused" },
      { code: "E711", line: 6, col: 11 },
    ]);
    expect(reconcileFindings(beforeFindings, afterFindings).kept).toHaveLength(3);
  });

  it("reports a fixed finding and a new one, never pairing different rules", () => {
    const after = "import sys\n\nx = 1\nif x is None:\n    print(y)\n";
    const afterFindings = findingsOf(after, [
      { code: "F401", line: 1, col: 8, message: "`sys` imported but unused" },
      { code: "F821", line: 5, col: 11, message: "Undefined name `y`" },
    ]);
    const result = reconcileFindings(beforeFindings, afterFindings);
    expect(result.fixed.map((f) => f.message)).toEqual(["`os` imported but unused", "E711 here"]);
    expect(result.introduced.map((f) => f.code)).toEqual(["F821"]);
    expect(result.kept.map((pair) => pair.after.message)).toEqual(["`sys` imported but unused"]);
  });

  it("keeps a finding whose line was edited a little, preferring the same message", () => {
    const old = "def price_of(pastry, day, customer, weather, coupon):\n    pass\n";
    const edited = "def price_of(pastry, day, customer, weather, coupon, extra=None):\n    pass\n";
    const result = reconcileFindings(findingsOf(old, [{ code: "C901", line: 1, col: 5 }]), findingsOf(edited, [{ code: "C901", line: 1, col: 5 }]));
    expect(result.kept).toHaveLength(1);

    const two = "from x import a, b\n";
    const one = "from x import b\n";
    const both = findingsOf(two, [
      { code: "F401", line: 1, col: 15, message: "`a` unused" },
      { code: "F401", line: 1, col: 18, message: "`b` unused" },
    ]);
    const onlyB = findingsOf(one, [{ code: "F401", line: 1, col: 15, message: "`b` unused" }]);
    const result2 = reconcileFindings(both, onlyB);
    expect(result2.fixed.map((f) => f.message)).toEqual(["`a` unused"]);
    expect(result2.kept.map((pair) => pair.before.message)).toEqual(["`b` unused"]);
  });

  it("treats a line rewritten to blame something else as a fix plus a new bug", () => {
    const result = reconcileFindings(
      findingsOf("import os\n", [{ code: "F401", line: 1, col: 8, message: "`os` imported but unused" }]),
      findingsOf("import sys\n", [{ code: "F401", line: 1, col: 8, message: "`sys` imported but unused" }]),
    );
    expect(result.fixed).toHaveLength(1);
    expect(result.introduced).toHaveLength(1);
    // Numbers in the message may change: it is still the same finding.
    const complex = reconcileFindings(
      findingsOf("def f(a, b):\n", [{ code: "C901", line: 1, col: 5, message: "`f` is too complex (13 > 10)" }]),
      findingsOf("def f(a, b, c):\n", [{ code: "C901", line: 1, col: 5, message: "`f` is too complex (12 > 10)" }]),
    );
    expect(complex.kept).toHaveLength(1);
  });

  it("does not pair lines that were rewritten beyond recognition", () => {
    const result = reconcileFindings(findingsOf("value = compute(a, b)\n", [{ code: "F821", line: 1, col: 9 }]), findingsOf("print(zzz)\n", [{ code: "F821", line: 1, col: 7 }]));
    expect(result.kept).toEqual([]);
    expect(result.fixed).toHaveLength(1);
    expect(result.introduced).toHaveLength(1);
  });

  it("among identical findings, keeps the nearest one and gets the count right either way", () => {
    const old = "try:\n    a()\nexcept:\n    pass\ntry:\n    b()\nexcept:\n    pass\n";
    const oldFindings = findingsOf(old, [
      { code: "E722", line: 3 },
      { code: "E722", line: 7 },
    ]);
    // The second try/except is deleted.
    const firstOnly = "try:\n    a()\nexcept:\n    pass\n";
    const result = reconcileFindings(oldFindings, findingsOf(firstOnly, [{ code: "E722", line: 3 }]));
    expect(result.fixed.map((f) => f.line)).toEqual([7]);
    expect(result.kept.map((pair) => [pair.before.line, pair.after.line])).toEqual([[3, 3]]);

    // The first one is deleted instead: identical findings can't be told apart,
    // so they may trade places, but exactly one is fixed and nothing is new.
    const secondOnly = "try:\n    b()\nexcept:\n    pass\n";
    const swapped = reconcileFindings(oldFindings, findingsOf(secondOnly, [{ code: "E722", line: 3 }]));
    expect(swapped.fixed).toHaveLength(1);
    expect(swapped.kept).toHaveLength(1);
    expect(swapped.introduced).toEqual([]);
  });

  it("pairs each finding at most once", () => {
    const old = findingsOf("except:\n", [{ code: "E722", line: 1 }]);
    const now = findingsOf("except:\nexcept:\n", [
      { code: "E722", line: 1 },
      { code: "E722", line: 2 },
    ]);
    const result = reconcileFindings(old, now);
    expect(result.kept).toHaveLength(1);
    expect(result.introduced).toHaveLength(1);
  });

  it("stays fast on absurdly many identical findings", () => {
    const count = Math.ceil(Math.sqrt(MAX_CANDIDATE_PAIRS)) + 50;
    const source = "import os\n".repeat(count);
    const specs = Array.from({ length: count }, (_, i) => ({ code: "F401", line: i + 1, col: 8 }));
    const started = performance.now();
    const result = reconcileFindings(findingsOf(source, specs), findingsOf(`\n${source}`, specs.map((spec) => ({ ...spec, line: spec.line + 1 }))));
    expect(result.kept).toHaveLength(count);
    expect(performance.now() - started).toBeLessThan(2000);
  });
});

describe("lineSimilarity", () => {
  it("is 1 for equal lines and drops as the middle changes", () => {
    expect(lineSimilarity("abc", "abc")).toBe(1);
    expect(lineSimilarity("", "")).toBe(1);
    expect(lineSimilarity("importos,sys", "importsys")).toBe(0.75);
    expect(lineSimilarity("abc", "xyz")).toBe(0);
  });
});

// ─────────────────────── Property-style checks ───────────────────────

const CODES = ["F401", "E711", "B006", "F841"];

/** A random file of distinct-looking lines with findings on some of them (seeded, so failures reproduce). */
function randomFile(seed: number) {
  const rng = mulberry32(seed);
  const lineCount = 20 + Math.floor(rng() * 60);
  // A few lines repeat on purpose, so identical findings exist too.
  const lines = Array.from({ length: lineCount }, (_, i) => (rng() < 0.15 ? "except:" : `statement_${i} = value_${Math.floor(rng() * 1000)}`));
  const specs: Spec[] = [];
  lines.forEach((_, i) => {
    if (rng() < 0.3) specs.push({ code: CODES[Math.floor(rng() * CODES.length)], line: i + 1, col: 1 + Math.floor(rng() * 4) });
  });
  return { rng, lines, specs };
}

/**
 * Inserts blank / unrelated lines anywhere and deletes lines that carry no
 * finding; returns the new text and where each old line went.
 */
function shuffleAround(rng: () => number, lines: string[], findingLines: ReadonlySet<number>) {
  const out: string[] = [];
  const newLineOf = new Map<number, number>();
  lines.forEach((text, i) => {
    while (rng() < 0.2) out.push(rng() < 0.5 ? "" : `# note ${Math.floor(rng() * 1e6)}`);
    if (!findingLines.has(i + 1) && rng() < 0.15) return; // deleted
    out.push(text);
    newLineOf.set(i + 1, out.length);
  });
  return { text: out.join("\n"), newLineOf };
}

describe("reconcileFindings properties", () => {
  it("never invents a fix (or a new bug) when lines are only added or removed around findings", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { rng, lines, specs } = randomFile(seed);
      const before = findingsOf(lines.join("\n"), specs);
      const { text, newLineOf } = shuffleAround(rng, lines, new Set(specs.map((spec) => spec.line)));
      const after = findingsOf(text, specs.map((spec) => ({ ...spec, line: newLineOf.get(spec.line)! })));
      const result = reconcileFindings(before, after);
      expect(result.fixed, `seed ${seed}`).toEqual([]);
      expect(result.introduced, `seed ${seed}`).toEqual([]);
      for (const pair of result.kept) {
        expect(pair.after.code).toBe(pair.before.code);
        expect(pair.after.snippet.find((l) => l.n === pair.after.line)?.text.trim()).toBe(pair.before.snippet.find((l) => l.n === pair.before.line)?.text.trim());
      }
    }
  });

  it("finds exactly the deleted findings, and follows unique findings to their new lines", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { rng, lines, specs } = randomFile(seed + 1000);
      const unique = lines.map((line, i) => (line === "except:" ? `handler_${i}()` : line));
      const before = findingsOf(unique.join("\n"), specs);
      // Remove some finding lines (the fix) and shuffle the rest around.
      const fixedLines = new Set(specs.filter(() => rng() < 0.25).map((spec) => spec.line));
      const survivors = unique.filter((_, i) => !fixedLines.has(i + 1));
      const oldLineOf = unique.flatMap((_, i) => (fixedLines.has(i + 1) ? [] : [i + 1]));
      const keptSpecs = specs.filter((spec) => !fixedLines.has(spec.line));
      const { text, newLineOf } = shuffleAround(rng, survivors, new Set(keptSpecs.map((spec) => oldLineOf.indexOf(spec.line) + 1)));
      const after = findingsOf(text, keptSpecs.map((spec) => ({ ...spec, line: newLineOf.get(oldLineOf.indexOf(spec.line) + 1)! })));

      const result = reconcileFindings(before, after);
      expect(result.fixed.map((f) => f.line).sort((a, b) => a - b), `seed ${seed}`).toEqual(specs.filter((spec) => fixedLines.has(spec.line)).map((spec) => spec.line).sort((a, b) => a - b));
      expect(result.introduced).toEqual([]);
      for (const pair of result.kept) {
        expect(pair.after.line).toBe(newLineOf.get(oldLineOf.indexOf(pair.before.line) + 1));
      }
    }
  });
});
