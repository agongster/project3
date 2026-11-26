/**
 * The fight-then-fix rule (SPEC.md F1) where it touches the rest of the
 * game: one-time lessons, bounties (captured / sealed), quests that a seal
 * must not complete, saving the new fields, and the HUD's words for it.
 */
import { describe, expect, it } from "vitest";
import { dungeonCounter } from "@/components/hud/dungeonCounter";
import { regionRows } from "@/components/overlays/parts/boardData";
import { healthTooltip } from "@/components/hud/healthText";
import { linePrompt, lineInteractable, nearestPointOn, LINE_REACH_PX } from "@/game/scenes/floorCodeLines";
import { bountyState, chooseBounties, settleBounties } from "@/lib/game/bounties";
import { LESSON_IDS, markTaught, sanitizeTaught, wasTaught } from "@/lib/game/lessons";
import { emptyProgress, getProgress, repoHealth } from "@/lib/game/progress";
import { checkQuest } from "@/lib/game/questsCheck";
import { emptyWorkshop, recordForge } from "@/lib/game/questsStreak";
import { realFixesOnly } from "@/lib/game/seal";
import { defaultSave, sanitizeSave } from "@/lib/game/store";
import type { FixQuestSpec, PurifyQuestSpec } from "@/lib/game/questsTypes";
import type { ForgeReport } from "@/lib/workspace/contract";
import { deepFreeze, expectValidSave, KEY, makeAnalysis, makeFile, makeFinding, saveWith } from "./helpers";

describe("one-time lessons", () => {
  it("are taught once per save, and an old save has none", () => {
    const save = deepFreeze(defaultSave());
    expect(wasTaught(save, "subdued")).toBe(false);
    const taught = markTaught(save, "subdued");
    expect(wasTaught(taught, "subdued")).toBe(true);
    expect(markTaught(taught, "subdued")).toBe(taught);
  });

  it("keep only known lesson ids when a save is loaded, and nothing for an old save", () => {
    expect(sanitizeTaught(["subdued", "subdued", "hack", 3])).toEqual(["subdued"]);
    expect(sanitizeTaught(undefined)).toBeUndefined();
    expect(sanitizeTaught(["nope"])).toBeUndefined();
    expect(LESSON_IDS).toContain("subdued");
  });
});

describe("saving the new fields", () => {
  it("loads an old save unchanged, and keeps `sealed` and `taught` only when used", () => {
    const old = sanitizeSave({ repos: { [KEY]: { defeated: ["a.py:1:1:F401"], cleared: ["a.py"], opened: ["a.py"], milestones: [25] } } });
    expect(getProgress(old, KEY).sealed).toBeUndefined();
    expect(old.taught).toBeUndefined();
    expect(sanitizeSave(old)).toEqual(old);
  });

  it("bounds and cleans what it loads", () => {
    const loaded = sanitizeSave({
      taught: ["subdued", "x"],
      repos: { [KEY]: { defeated: [], cleared: [], opened: [], milestones: [], sealed: ["a.py:1:1:F401", 7, "", "a.py:1:1:F401", "x".repeat(600)] } },
    });
    expect(loaded.taught).toEqual(["subdued"]);
    expect(getProgress(loaded, KEY).sealed).toEqual(["a.py:1:1:F401"]);
    expectValidSave(loaded);
  });
});

describe("bounties under the two-step rule", () => {
  const wanted = makeFinding("potions/brew.py", 4, "keyThief", { code: "S105" });
  const analysis = makeAnalysis([makeFile("potions/brew.py", { findings: [wanted] })]);
  const [bounty] = chooseBounties(analysis);

  it("pays when the wanted monster is captured (subdued), and the poster says CAPTURED", () => {
    const save = saveWith({ repos: { [KEY]: { ...emptyProgress(), defeated: [wanted.id] } } });
    const { save: paid, paid: due } = settleBounties(save, KEY, [bounty], true);
    expect(due).toEqual([bounty]);
    expect(bountyState(getProgress(paid, KEY), bounty)).toBe("captured");
  });

  it("shows SEALED for a wanted bug sealed before anyone caught it (closed without pay)", () => {
    const progress = { ...emptyProgress(), bounties: [wanted.id], sealed: [wanted.id] };
    expect(bountyState(progress, bounty)).toBe("sealed");
    expect(bountyState(emptyProgress(), bounty)).toBe("open");
  });
});

describe("quests a seal must not complete", () => {
  const bug = makeFinding("app.py", 3, "keyThief", { code: "S105", message: "Possible hardcoded password", snippet: [{ n: 3, text: 'password = "x"', hit: true }] });
  const fixQuest: FixQuestSpec = { kind: "fix", id: "fix:app.py:S105:x", path: "app.py", code: "S105", rule: "Hardcoded password", message: "Possible hardcoded password", lineText: 'password = "x"', line: 3, monster: "keyThief" };
  const purifyQuest: PurifyQuestSpec = { kind: "purify", id: "purify:app.py", path: "app.py", bugs: 1 };
  const gone = makeAnalysis([{ ...makeFile("app.py"), realFixes: 1, fixedFindings: [bug] }]);

  it("completes a fix quest for a real fix", () => {
    expect(checkQuest(fixQuest, gone, emptyProgress()).state).toBe("done");
    expect(checkQuest(purifyQuest, gone, emptyProgress()).state).toBe("done");
  });

  it("quietly replaces them when the bug was only sealed", () => {
    const sealed = { ...emptyProgress(), sealed: [bug.id] };
    expect(checkQuest(fixQuest, gone, sealed).state).toBe("gone");
    expect(checkQuest(purifyQuest, gone, sealed).state).toBe("gone");
  });
});

describe("the streak and Boss Mender see real fixes only", () => {
  const boss = makeFinding("a.py", 2, "keyThief", { code: "S105" });
  const summary = { grade: "B" as const, score: 70, findingCount: 0 };
  const report: ForgeReport = { path: "a.py", linted: true, fixed: [boss], introduced: [], kept: [], before: summary, after: summary, purified: true, file: makeFile("a.py") };

  it("does not count a forge that only sealed", () => {
    const sealedOnly = realFixesOnly(report, { fixed: [] });
    const { record, change } = recordForge(emptyWorkshop(), sealedOnly, new Set());
    expect(record.streak).toBe(0);
    expect(record.counts.bossesMended).toBe(0);
    expect(record.counts.handPurified).toBe(0);
    expect(change).toBeNull();
  });

  it("counts the same forge when it was a real fix", () => {
    const { record } = recordForge(emptyWorkshop(), realFixesOnly(report, { fixed: [boss] }), new Set());
    expect(record).toMatchObject({ streak: 1, counts: { bossesMended: 1, handPurified: 1 } });
  });
});

describe("the HUD's words", () => {
  it("tells what is left in a dungeon: monsters to fight, lines to fix", () => {
    expect(dungeonCounter({ remaining: 2, toFix: 5 })).toEqual({ tone: "fighting", icon: "skull", text: "fight 2 · fix 5" });
    expect(dungeonCounter({ remaining: 0, toFix: 3 })).toEqual({ tone: "quiet", icon: "zzz", text: "quiet · fix 3" });
    expect(dungeonCounter({ remaining: 0, toFix: 0 })).toEqual({ tone: "purified", icon: "checkmark", text: "purified!" });
  });

  it("names every state of the bugs behind the health bar", () => {
    const fixedBug = makeFinding("a.py", 1);
    const sealedBug = makeFinding("a.py", 2);
    const subdued = makeFinding("a.py", 3);
    const alive = makeFinding("a.py", 4);
    const analysis = makeAnalysis([{ ...makeFile("a.py", { findings: [subdued, alive] }), fixedFindings: [fixedBug, sealedBug], realFixes: 2 }]);
    const health = repoHealth(analysis, { ...emptyProgress(), defeated: [subdued.id], sealed: [sealedBug.id] });
    expect(healthTooltip(health)).toBe("Repo Health 50%: 1 fixed, 1 sealed, 1 subdued (fix their lines!), 1 still fighting");
    expect(healthTooltip(repoHealth(makeAnalysis([makeFile("clean.py")]), emptyProgress()))).toBe("Repo Health 100%: Ruff found no bugs here");
  });
});

describe("pressing E on a carved line", () => {
  it("offers to fix a subdued line and to read a healed or sealed one, nothing on a fighting one", () => {
    expect(linePrompt("subdued", 22)).toBe("Fix line 22 in the Workshop");
    expect(linePrompt("fixed", 22)).toBe("Read line 22");
    expect(linePrompt("sealed", 22)).toBe("Read line 22 (sealed)");
    expect(linePrompt("alive", 22)).toBeNull();
  });

  it("measures from the point of the line nearest to the hero, so the nearest line wins", () => {
    const box = { x: 100, y: 50, w: 60, h: 11 };
    expect(nearestPointOn(box, 120, 55)).toEqual({ x: 120, y: 55 });
    expect(nearestPointOn(box, 40, 30)).toEqual({ x: 100, y: 50 });
    let hero = { x: 130, y: 70 };
    const opened: number[] = [];
    const spot = lineInteractable({ findingId: "a", line: 22, box }, "subdued", () => hero, (line) => opened.push(line));
    // The hero's feet are measured 3 px up, like every other "press E" spot.
    expect([spot.x, spot.y]).toEqual([130, 61]);
    expect(spot.radius).toBe(LINE_REACH_PX);
    hero = { x: 10, y: 54 };
    expect([spot.x, spot.y]).toEqual([100, 51]);
    spot.activate();
    expect(opened).toEqual([22]);
  });
});

describe("the notice board's regions", () => {
  it("fill their bars with fixed and sealed bugs only, and count subdued ones apart", () => {
    const fixedBug = makeFinding("bakery/a.py", 1);
    const sealedBug = makeFinding("bakery/a.py", 2);
    const subdued = makeFinding("bakery/a.py", 3);
    const analysis = makeAnalysis([{ ...makeFile("bakery/a.py", { findings: [subdued] }), fixedFindings: [fixedBug, sealedBug], realFixes: 2 }, makeFile("main.py")]);
    const rows = regionRows(analysis, { ...emptyProgress(), defeated: [subdued.id], sealed: [sealedBug.id] });
    expect(rows.find((row) => row.name === "bakery/")).toEqual({ name: "bakery/", files: 1, bugs: 1, subdued: 1, fixed: 1, sealed: 1 });
  });
});
