/** The game screen's small Workshop decisions: the shortcut key, routing engine events, and the words that tell squashed from fixed. */
import { describe, expect, it } from "vitest";
import { shortcutFor } from "@/components/app/GameScreen";
import { overlayForEvent, workshopForEvent } from "@/components/app/gameEvents";
import { bugStatus, findFinding, groupFindings } from "@/components/overlays/parts/codexData";
import { CLASSIC_TAKEAWAY, victoryTakeaway } from "@/components/overlays/parts/victoryText";
import { emptyProgress } from "@/lib/game/progress";
import { makeAnalysis, makeFile, makeFinding } from "../game/helpers";

describe("shortcutFor", () => {
  it("keeps the game's keys and adds F for the Workshop", () => {
    expect(shortcutFor("i")).toEqual({ kind: "bag" });
    expect(shortcutFor("B")).toEqual({ kind: "bag" });
    expect(shortcutFor("c")).toEqual({ kind: "codex" });
    expect(shortcutFor("f")).toBe("workshop");
    expect(shortcutFor("F")).toBe("workshop");
    expect(shortcutFor("e")).toBeNull();
  });
});

describe("engine events", () => {
  it("routes a workshop event to the Workshop, not to an overlay", () => {
    const event = { type: "workshop", target: { path: "a.py", line: 3 } } as const;
    expect(workshopForEvent(event)).toEqual({ path: "a.py", line: 3 });
    expect(overlayForEvent(event)).toBeNull();
    expect(workshopForEvent({ type: "menu" })).toBeNull();
  });

  it("carries a plaque's edit button into the dialog, and only when there is one", () => {
    const edit = { label: "Edit this function", target: { path: "a.py", line: 9 } };
    expect(overlayForEvent({ type: "dialog", speaker: "Plaque", lines: ["hi"], edit })).toEqual({ kind: "dialog", speaker: "Plaque", lines: ["hi"], edit });
    expect(overlayForEvent({ type: "dialog", speaker: "Bob", lines: ["hi"] })).toStrictEqual({ kind: "dialog", speaker: "Bob", lines: ["hi"] });
  });
});

describe("the codex tells squashed from fixed", () => {
  const live = makeFinding("a.py", 3);
  const squashed = makeFinding("a.py", 5, "phantom", { code: "F821" });
  const fixed = makeFinding("a.py", 8, "mimic", { code: "B006" });
  const allFixed = makeFinding("b.py", 2);
  const analysis = makeAnalysis([
    { ...makeFile("a.py", { findings: [live, squashed] }), realFixes: 1, fixedFindings: [fixed] },
    { ...makeFile("b.py"), realFixes: 1, fixedFindings: [allFixed] },
    makeFile("clean.py"),
  ]);
  const progress = { ...emptyProgress(), defeated: [squashed.id] };

  it("lists files with fixed bugs too, a fully fixed one as purified", () => {
    const groups = groupFindings(analysis, progress);
    expect(groups.map((g) => [g.file.path, g.defeated, g.fixed.length, g.purified])).toEqual([
      ["a.py", 1, 1, false],
      ["b.py", 0, 1, true],
    ]);
  });

  it("finds a fixed bug and knows where each bug stands", () => {
    expect(findFinding(analysis, fixed.id)).toBe(fixed);
    expect(bugStatus(analysis, progress, live)).toBe("lurking");
    expect(bugStatus(analysis, progress, squashed)).toBe("squashed");
    expect(bugStatus(analysis, progress, fixed)).toBe("fixed");
  });
});

describe("victoryTakeaway", () => {
  it("keeps the game's own line for a player who never fixed code", () => {
    expect(victoryTakeaway({ defeated: 12, fixed: 0 })).toBe(CLASSIC_TAKEAWAY);
  });

  it("counts what is left in the code once some bugs were fixed for real", () => {
    expect(victoryTakeaway({ defeated: 3, fixed: 2 })).toBe("You fixed 2 in the code, but 3 squashed bugs are still there. Fix them for real in the Workshop!");
    expect(victoryTakeaway({ defeated: 1, fixed: 2 })).toContain("1 squashed bug is still there");
    expect(victoryTakeaway({ defeated: 0, fixed: 5 })).toContain("You fixed every bug in the code itself!");
  });
});
