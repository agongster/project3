/** The game screen's small Workshop decisions: the shortcut key, routing engine events, and the words that tell subdued, fixed and sealed apart. */
import { describe, expect, it } from "vitest";
import { shortcutFor } from "@/components/app/GameScreen";
import { overlayForEvent, workshopForEvent } from "@/components/app/gameEvents";
import { bugStatus, findFinding, groupFindings } from "@/components/overlays/parts/codexData";
import { ALL_FIXED_TAKEAWAY, howDealtWith, victoryTakeaway } from "@/components/overlays/parts/victoryText";
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

describe("the codex shows all four states", () => {
  const live = makeFinding("a.py", 3);
  const subdued = makeFinding("a.py", 5, "phantom", { code: "F821" });
  const fixed = makeFinding("a.py", 8, "mimic", { code: "B006" });
  const sealed = makeFinding("a.py", 9, "keyThief", { code: "S105" });
  const allFixed = makeFinding("b.py", 2);
  const quietBug = makeFinding("c.py", 4);
  const analysis = makeAnalysis([
    { ...makeFile("a.py", { findings: [live, subdued] }), realFixes: 2, fixedFindings: [fixed, sealed] },
    { ...makeFile("b.py"), realFixes: 1, fixedFindings: [allFixed] },
    makeFile("c.py", { findings: [quietBug] }),
    makeFile("clean.py"),
  ]);
  const progress = { ...emptyProgress(), defeated: [subdued.id, quietBug.id], sealed: [sealed.id] };

  it("lists cursed dungeons first, then quiet ones, then purified ones", () => {
    const groups = groupFindings(analysis, progress);
    expect(groups.map((g) => [g.file.path, g.state, g.gone.length, g.tally])).toEqual([
      ["a.py", "cursed", 2, { alive: 1, subdued: 1, fixed: 1, sealed: 1 }],
      ["c.py", "quiet", 0, { alive: 0, subdued: 1, fixed: 0, sealed: 0 }],
      ["b.py", "purified", 1, { alive: 0, subdued: 0, fixed: 1, sealed: 0 }],
    ]);
  });

  it("finds a bug gone from the code and knows where each bug stands", () => {
    expect(findFinding(analysis, fixed.id)).toBe(fixed);
    expect(bugStatus(analysis, progress, live)).toBe("alive");
    expect(bugStatus(analysis, progress, subdued)).toBe("subdued");
    expect(bugStatus(analysis, progress, fixed)).toBe("fixed");
    expect(bugStatus(analysis, progress, sealed)).toBe("sealed");
  });
});

describe("victoryTakeaway", () => {
  it("celebrates a repo where every bug was fixed for real", () => {
    expect(victoryTakeaway({ fixed: 12, sealed: 0 })).toBe(ALL_FIXED_TAKEAWAY);
    expect(howDealtWith({ sealed: 0 })).toBe("fixed");
  });

  it("gently reminds that seals are not fixes", () => {
    expect(victoryTakeaway({ fixed: 2, sealed: 3 })).toBe("You fixed 2 for real, and 3 bugs are only ignored with # noqa. Come back and fix them properly some day!");
    expect(victoryTakeaway({ fixed: 2, sealed: 1 })).toContain("1 bug is only ignored");
    expect(howDealtWith({ sealed: 1 })).toBe("fixed or ignored");
  });
});
