import { describe, expect, it } from "vitest";
import { CLOSEST_PAIRING_LIMIT, forgePreview, forgePreviewText, matchFindings } from "@/components/workshop/logic/findingDiff";

function bug(line: number, code = "B006", message = "Do not use mutable data structures for argument defaults") {
  return { code, message, line };
}

describe("matchFindings", () => {
  it("keeps a bug whose line moved", () => {
    const result = matchFindings([bug(4)], [bug(9)]);
    expect(result.kept).toHaveLength(1);
    expect(result.gone).toEqual([]);
    expect(result.added).toEqual([]);
  });

  it("reports the fixed one of two identical bugs by pairing the closest lines", () => {
    // The bug on line 5 was fixed; the one on line 20 moved up a line.
    const before = [bug(5), bug(20)];
    const result = matchFindings(before, [bug(19)]);
    expect(result.gone).toEqual([before[0]]);
    expect(result.kept[0].before).toBe(before[1]);
  });

  it("tells different bugs apart by code and message", () => {
    const os = bug(1, "F401", "`os` imported but unused");
    const sys = bug(2, "F401", "`sys` imported but unused");
    const result = matchFindings([os, sys], [sys]);
    expect(result.gone).toEqual([os]);
    expect(result.added).toEqual([]);
  });

  it("counts brand-new bugs as added", () => {
    const fresh = bug(3, "F821", "Undefined name `PRICES`");
    expect(matchFindings([], [fresh]).added).toEqual([fresh]);
  });

  it("falls back to line order for very large groups", () => {
    const many = Array.from({ length: CLOSEST_PAIRING_LIMIT + 5 }, (_, i) => bug(i + 1));
    const result = matchFindings(many, many.slice(1));
    expect(result.kept).toHaveLength(many.length - 1);
    expect(result.gone).toHaveLength(1);
  });
});

describe("forgePreview", () => {
  it("counts fixes and new bugs against the saved text", () => {
    const saved = [bug(4), bug(10, "E722", "Do not use bare `except`")];
    const live = [bug(4), bug(12, "F821", "Undefined name `x`")];
    expect(forgePreview(saved, live)).toEqual({ fixes: 1, fresh: 1 });
  });

  it("words the status line", () => {
    expect(forgePreviewText({ fixes: 2, fresh: 1 }, true)).toBe("Ready to save: 2 fixes · 1 new");
    expect(forgePreviewText({ fixes: 1, fresh: 0 }, true)).toBe("Ready to save: 1 fix");
    expect(forgePreviewText({ fixes: 0, fresh: 0 }, true)).toBe("Unsaved changes");
    expect(forgePreviewText({ fixes: 3, fresh: 0 }, false)).toBe("All saved");
  });
});
