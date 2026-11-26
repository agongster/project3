/**
 * The ONE place a forge (saving code in the Workshop) is applied to the
 * player's save. Pure: the game screen calls `settleForge` from the
 * Workshop's `onForged` (after every forge AND every revert) and writes the
 * result in one go.
 *
 *   report ─► wanted bugs fixed for real   pay their bounty, once each
 *          ─► applyForge                    real fixes pay; progress follows the code   (src/lib/game/forge.ts)
 *          ─► settleQuests                  streak, quests, achievements                (src/lib/game/questsSettle.ts)
 *          ─► ForgeRewards                  what the Workshop's forge summary shows
 *
 * Also here, because they follow each forge too: the notice board's
 * bounties (their findings move when lines move), the finding ids "as the
 * world knew them" when the Workshop opened (so the engine knows which
 * monsters were fixed), and the banner shown when the Workshop closes.
 */
import type { ForgeRewards } from "@/components/workshop";
import { addCoins, applyForge, getProgress, newsLine, settleQuests, withRepoProgress, type QuestNewsItem } from "@/lib/game";
import { isBountyClaimed, type Bounty } from "@/lib/game/bounties";
import { MAX_SETTLED_BOUNTIES } from "@/lib/game/store";
import type { RepoAnalysis, SaveData } from "@/lib/types";
import type { ForgeReport } from "@/lib/workspace";

export interface ForgeInput {
  save: SaveData;
  repoKey: string;
  /** The analysis AFTER the forge (`workspace.analysis.get()`). */
  analysis: RepoAnalysis;
  report: ForgeReport;
  /** The notice board's bounties, as they were before this forge. */
  bounties: readonly Bounty[];
}

export interface ForgeOutcome {
  /** The new save (the same object when nothing changed). */
  save: SaveData;
  /** The bounties with their findings moved to where the forge put them. */
  bounties: Bounty[];
  /** Bounties paid because their bug was fixed for real. */
  bountiesPaid: Bounty[];
  /** Quests, streak, achievements and level-ups to announce. */
  news: QuestNewsItem[];
  /** For the Workshop's forge summary. */
  rewards: ForgeRewards;
}

/** "Bounty claimed: line 12 in bakery/ · +40" */
export function bountyLine(bounty: Bounty): string {
  return `Bounty claimed: line ${bounty.line} in ${bounty.folder || "Town Square"} · +${bounty.reward} coins`;
}

/**
 * The summary lines under the Workshop's forge moment: bounties first, a
 * level-up from the fixes themselves, then the quest news ("Clean forge ×3!
 * +15 bonus coins", "Quest complete: Light the lantern in take_order()").
 */
export function summaryLines(bountiesPaid: readonly Bounty[], leveledUp: { level: number; title: string } | null, news: readonly QuestNewsItem[]): string[] {
  const lines = bountiesPaid.map(bountyLine);
  if (leveledUp) lines.push(`Level up! Level ${leveledUp.level}: ${leveledUp.title}`);
  for (const item of news) {
    const line = newsLine(item);
    if (line !== null) lines.push(line);
  }
  return lines;
}

/** Bounties whose finding only moved get its new id and line; the others are unchanged. */
export function followBounties(bounties: readonly Bounty[], report: ForgeReport): Bounty[] {
  const moved = new Map(report.kept.map((pair) => [pair.before.id, pair.after]));
  return bounties.map((bounty) => {
    const after = moved.get(bounty.findingId);
    return after ? { ...bounty, findingId: after.id, line: after.line } : bounty;
  });
}

/**
 * Remembers bounties as settled. applyForge forgets the ids of fixed
 * findings (they no longer exist), so the board's settled list gets them
 * back here: a wanted bug that is fixed, reverted and fixed again never pays twice.
 */
function rememberSettled(save: SaveData, repoKey: string, ids: readonly string[]): SaveData {
  if (ids.length === 0) return save;
  const progress = getProgress(save, repoKey);
  const settled = progress.bounties ?? [];
  const missing = ids.filter((id) => !settled.includes(id));
  if (missing.length === 0) return save;
  return withRepoProgress(save, repoKey, { ...progress, bounties: [...settled, ...missing].slice(-MAX_SETTLED_BOUNTIES) });
}

/** Applies one forge (or revert) report to the save. See the file comment for the order. */
export function settleForge({ save, repoKey, analysis, report, bounties }: ForgeInput): ForgeOutcome {
  const before = getProgress(save, repoKey);
  const fixedIds = new Set(report.linted ? report.fixed.map((finding) => finding.id) : []);
  const wantedFixed = bounties.filter((bounty) => fixedIds.has(bounty.findingId));
  const bountiesPaid = wantedFixed.filter((bounty) => !isBountyClaimed(before, bounty));

  const forged = applyForge(save, repoKey, report);
  const bountyCoins = bountiesPaid.reduce((sum, bounty) => sum + bounty.reward, 0);
  const remembered = rememberSettled(
    forged.save,
    repoKey,
    wantedFixed.map((bounty) => bounty.findingId),
  );
  const withBounties = addCoins(remembered, bountyCoins);
  const settled = settleQuests(withBounties, repoKey, analysis, report, before.defeated);

  const { paid } = forged;
  return {
    save: settled.save,
    bounties: followBounties(bounties, report),
    bountiesPaid,
    news: settled.news,
    rewards: {
      coins: paid.coins + bountyCoins + settled.coins,
      xp: paid.xp + settled.xp,
      lines: summaryLines(bountiesPaid, paid.leveledUp, settled.news),
      paidFixes: paid.fixes,
    },
  };
}

// ───────────────────────── Following ids through a visit ─────────────────────────

/**
 * Finding ids contain line numbers, so they change when lines move. While
 * the Workshop is open the engine still knows each monster by its id from
 * when the Workshop opened. `traceIds` keeps a map "id now → id then"
 * through every forge, and `originalIds` turns a report's fixed findings
 * into the ids the engine knows.
 */
export function traceIds(trace: ReadonlyMap<string, string>, report: ForgeReport): Map<string, string> {
  const next = new Map(trace);
  for (const pair of report.kept) next.delete(pair.before.id);
  for (const pair of report.kept) next.set(pair.after.id, trace.get(pair.before.id) ?? pair.before.id);
  return next;
}

export function originalIds(trace: ReadonlyMap<string, string>, report: ForgeReport): string[] {
  return report.fixed.map((finding) => trace.get(finding.id) ?? finding.id);
}

// ───────────────────────── The banner after a visit ─────────────────────────

/** What the forges of one Workshop visit did to the world. */
export interface VisitTally {
  /** Findings that were fixed (gone from the code). */
  fixed: number;
  /** New findings (bugs that crept in). */
  introduced: number;
  /** Files whose last bug was fixed. */
  purified: string[];
}

export const EMPTY_TALLY: VisitTally = { fixed: 0, introduced: 0, purified: [] };

export function addToTally(tally: VisitTally, report: ForgeReport): VisitTally {
  if (!report.linted) return tally;
  return {
    fixed: tally.fixed + report.fixed.length,
    introduced: tally.introduced + report.introduced.length,
    purified: report.purified && !tally.purified.includes(report.path) ? [...tally.purified, report.path] : tally.purified,
  };
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** The HUD banner when the Workshop closes, or null when the visit changed no monster. */
export function returnBanner(tally: VisitTally): { title: string; subtitle: string } | null {
  const parts: string[] = [];
  if (tally.fixed > 0) parts.push(`${plural(tally.fixed, "bug", "bugs")} fixed for real`);
  if (tally.introduced > 0) parts.push(`${plural(tally.introduced, "new monster", "new monsters")}`);
  if (tally.purified.length > 0) parts.push(`${plural(tally.purified.length, "dungeon", "dungeons")} purified`);
  if (parts.length === 0) return null;
  const title = tally.fixed === 0 ? "NEW MONSTERS!" : tally.introduced === 0 ? "FIXED FOR REAL!" : "THE CODE CHANGED!";
  return { title, subtitle: parts.join(" · ") };
}
