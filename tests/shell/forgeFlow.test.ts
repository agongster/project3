/**
 * The one place a forge is applied (src/components/app/forgeFlow.ts), played
 * on the Demo Kingdom with the real workspace and Ruff's Node build: what it
 * pays, the bounty of a wanted bug fixed for real (once), the ids the engine
 * knows, and the banner after a visit.
 */
import { describe, expect, it } from "vitest";
import { repoKey } from "@/game/bridge";
import { addToTally, EMPTY_TALLY, followBounties, originalIds, returnBanner, settleForge, summaryLines, traceIds, type VisitTally } from "@/components/app/forgeFlow";
import { questToast } from "@/components/app/questToasts";
import { defaultSave, getProgress } from "@/lib/game";
import { isBountyClaimed, type Bounty } from "@/lib/game/bounties";
import type { Finding, SaveData } from "@/lib/types";
import type { Workspace } from "@/lib/workspace";
import { demoSource, openDemo, viewOf } from "../workspace/helpers";

const ORDERS = "bakery/orders.py";
const FIX_DEFAULT = (text: string) => text.replace("def add_to_basket(item, basket=[]):", "def add_to_basket(item, basket=None):");
/** Two comment lines at the top: every finding below moves down by two. */
const MOVE_DOWN = (text: string) => text.replace('"""Taking orders from hungry villagers (and the occasional dragon)."""\n', '"""Taking orders from hungry villagers (and the occasional dragon)."""\n# one\n# two\n');

function mutableDefault(workspace: Workspace): Finding {
  const finding = viewOf(workspace, ORDERS).findings.find((f) => f.code === "B006");
  if (!finding) throw new Error("no B006 in orders.py");
  return finding;
}

function wanted(finding: Finding): Bounty {
  return { findingId: finding.id, monster: finding.monster, severity: finding.severity, folder: "bakery/", line: finding.line, code: "def add_to_basket", reward: 40 };
}

async function forgeAndSettle(workspace: Workspace, save: SaveData, text: string, bounties: readonly Bounty[]) {
  const report = await workspace.forge(ORDERS, text);
  const key = repoKey(workspace.analysis.get());
  return { report, key, ...settleForge({ save, repoKey: key, analysis: workspace.analysis.get(), report, text, bounties }) };
}

/** The mutable default argument, sealed instead of fixed. */
const SEAL_DEFAULT = (text: string) => text.replace("def add_to_basket(item, basket=[]):", "def add_to_basket(item, basket=[]):  # noqa: B006");

describe("settleForge", () => {
  it("pays a real fix once, with the quests on top, and says so in the summary", async () => {
    const workspace = await openDemo();
    const { save, rewards, news, key } = await forgeAndSettle(workspace, defaultSave(), FIX_DEFAULT(demoSource(ORDERS)), []);
    expect(rewards.paidFixes?.map((f) => f.code)).toEqual(["B006"]);
    expect(save.coins).toBe(rewards.coins);
    expect(save.xp).toBe(rewards.xp);
    expect(rewards.lines).toContain("Achievement unlocked: First Real Fix");
    expect(news.some((item) => item.type === "achievement")).toBe(true);
    expect(getProgress(save, key).fixes).toHaveLength(1);
  });

  it("pays the bounty of a wanted bug fixed for real, and never twice (fix, revert, fix again)", async () => {
    const workspace = await openDemo();
    const bounty = wanted(mutableDefault(workspace));
    const first = await forgeAndSettle(workspace, defaultSave(), FIX_DEFAULT(demoSource(ORDERS)), [bounty]);
    expect(first.bountiesPaid).toEqual([bounty]);
    expect(first.rewards.lines[0]).toBe("Wanted bug fixed: line 4 in bakery/ · +40 coins");
    expect(isBountyClaimed(getProgress(first.save, first.key), bounty)).toBe(true);

    const revert = await workspace.revert(ORDERS);
    const reverted = settleForge({ save: first.save, repoKey: first.key, analysis: workspace.analysis.get(), report: revert, text: demoSource(ORDERS), bounties: first.bounties });
    expect(isBountyClaimed(getProgress(reverted.save, first.key), bounty)).toBe(true);

    const again = await forgeAndSettle(workspace, reverted.save, FIX_DEFAULT(demoSource(ORDERS)), reverted.bounties);
    expect(again.bountiesPaid).toEqual([]);
    expect(again.rewards.paidFixes).toEqual([]);
    expect(again.save.coins - reverted.save.coins).toBe(again.rewards.coins);
  });

  it("moves a wanted bug's notice with its line, and still pays when it is fixed later", async () => {
    const workspace = await openDemo();
    const bounty = wanted(mutableDefault(workspace));
    const moved = await forgeAndSettle(workspace, defaultSave(), MOVE_DOWN(demoSource(ORDERS)), [bounty]);
    expect(moved.bounties[0]).toMatchObject({ line: 6, findingId: mutableDefault(workspace).id });
    expect(followBounties([bounty], moved.report)).toEqual(moved.bounties);

    const fixed = await forgeAndSettle(workspace, moved.save, FIX_DEFAULT(MOVE_DOWN(demoSource(ORDERS))), moved.bounties);
    expect(fixed.bountiesPaid.map((b) => b.line)).toEqual([6]);
  });

  it("tells a seal from a fix: no reward, no streak, the wanted notice closed unpaid, the seal remembered", async () => {
    const workspace = await openDemo();
    const bug = mutableDefault(workspace);
    const bounty = wanted(bug);
    const sealed = await forgeAndSettle(workspace, defaultSave(), SEAL_DEFAULT(demoSource(ORDERS)), [bounty]);
    expect(sealed.sealed.map((f) => f.code)).toEqual(["B006"]);
    expect(sealed.fixed).toEqual([]);
    expect(sealed.rewards.paidFixes).toEqual([]);
    expect(sealed.rewards.sealedIds).toEqual([bug.id]);
    expect(sealed.bountiesPaid).toEqual([]);
    expect(isBountyClaimed(getProgress(sealed.save, sealed.key), bounty)).toBe(true);
    expect(getProgress(sealed.save, sealed.key).sealed).toEqual([bug.id]);
    expect(sealed.save.workshop?.streak ?? 0).toBe(0);
    expect(sealed.save.stats.realFixes ?? 0).toBe(0);
  });
});

describe("ids through a Workshop visit", () => {
  it("turns a fixed finding back into the id the engine knew when the Workshop opened", async () => {
    const workspace = await openDemo();
    const original = mutableDefault(workspace).id;
    const moveReport = await workspace.forge(ORDERS, MOVE_DOWN(demoSource(ORDERS)));
    const trace = traceIds(new Map(), moveReport);
    const fixReport = await workspace.forge(ORDERS, FIX_DEFAULT(MOVE_DOWN(demoSource(ORDERS))));
    expect(fixReport.fixed.map((f) => f.id)).not.toEqual([original]);
    expect(originalIds(trace, fixReport.fixed)).toEqual([original]);
  });
});

describe("the banner after a visit", () => {
  /** One forge: how many bugs it fixed, sealed and introduced. */
  const forge = (tally: VisitTally, fixed: number, introduced: number, options: { sealed?: number; purified?: boolean } = {}) => {
    const report = { path: "a.py", linted: true, introduced: Array(introduced).fill(null), purified: options.purified ?? false } as never;
    return addToTally(tally, report, { fixed: Array(fixed).fill(null), sealed: Array(options.sealed ?? 0).fill(null) });
  };

  it("sums up real fixes, seals, new monsters and purified dungeons", () => {
    const tally = forge(forge(EMPTY_TALLY, 2, 0), 1, 1, { purified: true });
    expect(returnBanner(tally)).toEqual({ title: "THE CODE CHANGED!", subtitle: "3 bugs fixed for real · 1 new monster · 1 dungeon purified" });
    expect(returnBanner(forge(EMPTY_TALLY, 1, 0))).toEqual({ title: "FIXED FOR REAL!", subtitle: "1 bug fixed for real" });
    expect(returnBanner(forge(EMPTY_TALLY, 1, 0, { sealed: 2 }))).toEqual({ title: "FIXED FOR REAL!", subtitle: "1 bug fixed for real · 2 bugs ignored" });
    expect(returnBanner(forge(EMPTY_TALLY, 0, 0, { sealed: 1 }))).toEqual({ title: "IGNORED", subtitle: "1 bug ignored" });
    expect(returnBanner(forge(EMPTY_TALLY, 0, 2))?.title).toBe("NEW MONSTERS!");
  });

  it("stays quiet when nothing changed (or only a README was saved)", () => {
    expect(returnBanner(EMPTY_TALLY)).toBeNull();
    expect(returnBanner(addToTally(EMPTY_TALLY, { linted: false } as never, { fixed: [], sealed: [] }))).toBeNull();
  });
});

describe("summary lines and quest toasts", () => {
  const quest = { type: "quest", quest: { title: "Light the lantern in take_order()", reward: { coins: 25, xp: 15 } } } as never;

  it("lists bounties, a level-up and the quest news", () => {
    const bounty: Bounty = { findingId: "x", monster: "mimic", severity: "elite", folder: "", line: 3, code: "x", reward: 40 };
    expect(summaryLines([bounty], { level: 3, title: "Bug Hunter" }, [quest])).toEqual([
      "Wanted bug fixed: line 3 in Town Square · +40 coins",
      "Level up! Level 3: Bug Hunter",
      "Quest complete: Light the lantern in take_order()",
    ]);
  });

  it("turns world news into the game's small toasts", () => {
    expect(questToast(quest)).toEqual({ text: "Quest complete: Light the lantern in take_order()", tone: "good", icon: { type: "star" }, coins: 25 });
    expect(questToast({ type: "levelUp", level: 2, title: "Bug Spotter" })).toEqual({ text: "Level up! Level 2: Bug Spotter", tone: "good", icon: { type: "star" } });
  });
});
