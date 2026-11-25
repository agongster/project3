import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeDiagnostic } from "@/lib/analysis/normalize";
import { gradeFile, gradeFor, type ProbeHit } from "@/lib/analysis/quality";
import { isProbeRule } from "@/lib/analysis/rules";
import { createNodeLint } from "./nodeLint";

const fixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8");
const lint = createNodeLint();

/** Grades a file the way analyzeSources does: real Ruff, probe rules only. */
function grade(source: string, monsterCount = 0) {
  const probes: ProbeHit[] = lint(source)
    .map(normalizeDiagnostic)
    .filter((hit) => isProbeRule(hit.code));
  return gradeFile(source, probes, monsterCount);
}

describe("gradeFile", () => {
  it("gives a documented, typed, commented file an S", () => {
    const quality = grade(fixture("well_written.py"));
    expect(quality.grade).toBe("S");
    expect(quality.metrics.docCoverage).toBe(1);
    expect(quality.metrics.hintCoverage).toBe(1);
    expect(quality.highlights).toEqual(["Every function has a docstring", "Fully type-hinted", "Short, focused functions"]);
  });

  it("gives an undocumented, untyped, cramped file a C", () => {
    const quality = grade(fixture("sloppy.py"));
    expect(quality.grade).toBe("C");
    expect(quality.metrics.docCoverage).toBe(0);
    expect(quality.metrics.hintCoverage).toBe(0);
    expect(quality.metrics.probeHits).toBeGreaterThan(0); // long line, `a; b`, camelCase names
  });

  it("gives tiny and empty files a modest grade", () => {
    for (const source of ["", '"""Package marker."""\n', "from .core import run\n"]) {
      const quality = grade(source);
      expect(["B", "C"]).toContain(quality.grade);
      expect(quality.highlights).toEqual(["Small and tidy"]);
    }
  });

  it("only goes down as quality gets worse", () => {
    const steps = [
      fixture("well_written.py"),
      // drop the comments
      fixture("well_written.py").replace(/^\s*#.*\n/gm, ""),
      // …and the type hints
      fixture("well_written.py")
        .replace(/^\s*#.*\n/gm, "")
        .replace(/: (str|float)/g, "")
        .replace(/ -> (str|float)/g, ""),
      fixture("sloppy.py"),
    ];
    const scores = steps.map((source) => grade(source).score);
    for (let i = 1; i < scores.length; i++) expect(scores[i]).toBeLessThan(scores[i - 1]);
  });

  it("takes points off for every monster", () => {
    const clean = grade(fixture("well_written.py"), 0).score;
    expect(grade(fixture("well_written.py"), 2).score).toBe(clean - 20);
  });
});

describe("gradeFor", () => {
  it("maps scores to letters", () => {
    expect([100, 85, 84, 70, 69, 50, 49, 0].map(gradeFor)).toEqual(["S", "S", "A", "A", "B", "B", "C", "C"]);
  });
});
