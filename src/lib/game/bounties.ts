/**
 * Bounties: the Town Square notice board posts up to MAX_BOUNTIES "WANTED"
 * notices, each quoting a real line of code a monster hides at, and naming
 * only the file's folder and the line ("the creature hiding at line 42,
 * somewhere in potions/"). Defeating that exact monster pays BOUNTY_REWARD.
 *
 * Targets are chosen deterministically from the repo (the same seed as the
 * world), preferring bosses and elites and spreading over different files.
 * Payouts are remembered per repo in `RepoProgress.bounties`, so each
 * bounty pays exactly once. A monster that was already defeated before the
 * player could see its notice (a save from before bounties existed) is
 * marked settled without paying: its notice simply shows CLAIMED.
 */
import { addCoins } from "@/lib/game/actions";
import { getProgress, withRepoProgress } from "@/lib/game/progress";
import { MAX_SETTLED_BOUNTIES } from "@/lib/game/store";
import { clipPath, clipWords, oneLine } from "@/lib/analysis/repoText";
import { hashString } from "@/lib/rng";
import type { Finding, MonsterKind, RepoAnalysis, RepoProgress, SaveData, Severity } from "@/lib/types";

/** How many WANTED notices the board posts at most. */
export const MAX_BOUNTIES = 3;
/** Coins paid for each wanted monster, by how tough it is. */
export const BOUNTY_REWARD: Readonly<Record<Severity, number>> = { minion: 20, elite: 40, boss: 75 };
/** The quoted line of code is clipped to this many characters. */
export const MAX_BOUNTY_CODE = 56;
/** The folder named on a notice is clipped (from the left) to this many characters. */
const MAX_BOUNTY_FOLDER = 32;

/** Bosses are wanted most, then elites, then minions. */
const WANTED_RANK: Readonly<Record<Severity, number>> = { boss: 0, elite: 1, minion: 2 };

/** One WANTED notice. */
export interface Bounty {
  findingId: string;
  monster: MonsterKind;
  severity: Severity;
  /** The file's folder with a trailing slash ("data/shakespeare/"), or "" for a root file. */
  folder: string;
  line: number;
  /** The real line of code the monster hides at, trimmed and clipped. */
  code: string;
  /** Coins paid when the monster is defeated. */
  reward: number;
}

/** The line of code a finding points at (its first highlighted snippet line that is not blank), or null. */
function wantedCode(finding: Finding): string | null {
  const hit = finding.snippet.find((line) => line.hit && line.text.trim() !== "") ?? finding.snippet.find((line) => line.n === finding.line && line.text.trim() !== "");
  return hit ? clipWords(oneLine(hit.text), MAX_BOUNTY_CODE) : null;
}

/** "data/shakespeare/prepare.py" → "data/shakespeare/"; a root file → "". */
function folderOf(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "" : clipPath(path.slice(0, slash + 1), MAX_BOUNTY_FOLDER);
}

/**
 * The repo's bounties: toughest monsters first; among equals, a fixed
 * repo-specific shuffle (a hash of the repo seed and the finding id).
 * Each file gets at most one notice while other files still have monsters.
 */
export function chooseBounties(analysis: RepoAnalysis): Bounty[] {
  const { owner, repo, sha } = analysis.repo;
  const seed = `${owner}/${repo}@${sha}`;
  const candidates = analysis.files
    .filter((file) => file.status === "ok")
    .flatMap((file) => file.findings)
    .map((finding) => ({ finding, code: wantedCode(finding), order: hashString(`${seed}:${finding.id}`) }))
    .filter((c): c is { finding: Finding; code: string; order: number } => c.code !== null)
    .sort((a, b) => WANTED_RANK[a.finding.severity] - WANTED_RANK[b.finding.severity] || a.order - b.order);

  const picked: typeof candidates = [];
  const usedPaths = new Set<string>();
  for (const spreadOut of [true, false]) {
    for (const candidate of candidates) {
      if (picked.length >= MAX_BOUNTIES) break;
      if (picked.includes(candidate) || (spreadOut && usedPaths.has(candidate.finding.path))) continue;
      picked.push(candidate);
      usedPaths.add(candidate.finding.path);
    }
  }
  return picked.map(({ finding, code }) => ({
    findingId: finding.id,
    monster: finding.monster,
    severity: finding.severity,
    folder: folderOf(finding.path),
    line: finding.line,
    code,
    reward: BOUNTY_REWARD[finding.severity],
  }));
}

/** "the creature hiding at line 42, somewhere in potions/" */
export function bountyClue(bounty: Pick<Bounty, "folder" | "line">): string {
  return `the creature hiding at line ${bounty.line}, somewhere in ${bounty.folder || "Town Square"}`;
}

/** True once the wanted monster is defeated (whether or not it paid: see the file comment). */
export function isBountyClaimed(progress: RepoProgress, bounty: Pick<Bounty, "findingId">): boolean {
  return progress.defeated.includes(bounty.findingId) || (progress.bounties ?? []).includes(bounty.findingId);
}

/**
 * Settles every bounty whose monster is defeated but not yet settled. With
 * `pay` it adds their rewards to the coins and returns them in `paid` (for
 * the toast); without, it only marks them settled (old defeats). Returns
 * the very same save when there is nothing to settle.
 */
export function settleBounties(save: SaveData, key: string, bounties: readonly Bounty[], pay: boolean): { save: SaveData; paid: Bounty[] } {
  const progress = getProgress(save, key);
  const settled = progress.bounties ?? [];
  const due = bounties.filter((b) => progress.defeated.includes(b.findingId) && !settled.includes(b.findingId));
  if (due.length === 0) return { save, paid: [] };

  const next = withRepoProgress(save, key, { ...progress, bounties: [...settled, ...due.map((b) => b.findingId)].slice(-MAX_SETTLED_BOUNTIES) });
  if (!pay) return { save: next, paid: [] };
  return { save: addCoins(next, due.reduce((sum, b) => sum + b.reward, 0)), paid: due };
}

