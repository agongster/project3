import { describe, expect, it } from "vitest";
import { countCodeLines, gradeTips, nextGrade } from "@/components/workshop/logic/gradeTips";
import { outlineSource } from "@/lib/analysis/outline";
import type { FileQuality } from "@/lib/types";

function quality(metrics: Partial<FileQuality["metrics"]>, score = 50): FileQuality {
  return {
    score,
    grade: "B",
    highlights: [],
    metrics: { definitions: 2, docCoverage: 1, hintCoverage: 1, commentRatio: 0.1, probeHits: 0, ...metrics },
  };
}

const SOURCE = `"""Orders."""


def add(item, basket=[]):
    basket.append(item)
    return basket


def read(slip):
    """Read a slip."""
    return slip
`;

describe("gradeTips", () => {
  const outline = outlineSource(SOURCE);

  it("lists what is missing, most valuable first", () => {
    const tips = gradeTips(quality({ docCoverage: 2 / 3, hintCoverage: 0, commentRatio: 0, probeHits: 2 }), outline, 1, countCodeLines(SOURCE));
    expect(tips.map((tip) => [tip.label, tip.points])).toEqual([
      ["Add type hints to 2 functions", 25],
      ["Fix 1 bug", 10],
      ["Write 1 docstring", 10],
      ["Explain the tricky parts with a few # comments", 10],
      ["Tidy 2 style nits (long lines, a; b, odd names)", 6],
    ]);
    expect(tips[2].names).toEqual(["add"]);
  });

  it("asks for the file's own docstring when that is all that is missing", () => {
    const noModuleDoc = outlineSource(SOURCE.replace('"""Orders."""', "import os"));
    const tips = gradeTips(quality({ docCoverage: 1 / 3 }), noModuleDoc, 0, 20);
    expect(tips[0].label).toBe("Write 1 docstring, and one at the top of the file");
    const onlyModule = outlineSource('import os\n\n\ndef f():\n    """Doc."""\n');
    expect(gradeTips(quality({ docCoverage: 0.5 }), onlyModule, 0, 20)[0].label).toBe("Give the file a docstring at the top");
  });

  it("has nothing to add for a perfect file", () => {
    expect(gradeTips(quality({}), outline, 0, countCodeLines(SOURCE))).toEqual([]);
  });

  it("only suggests fixing bugs in a tiny file (its grade is flat)", () => {
    const tips = gradeTips(quality({ docCoverage: 0, hintCoverage: 0 }), outline, 2, 3);
    expect(tips).toEqual([{ label: "Fix 2 bugs", names: [], points: 20 }]);
  });

  it("caps the bug penalty like the grader", () => {
    expect(gradeTips(quality({}), outline, 9, 20)[0].points).toBe(50);
  });
});

describe("nextGrade", () => {
  it("names the next grade up and the points it needs", () => {
    expect(nextGrade(60)).toEqual({ grade: "A", needed: 10 });
    expect(nextGrade(0)).toEqual({ grade: "B", needed: 50 });
    expect(nextGrade(90)).toBeNull();
  });
});
