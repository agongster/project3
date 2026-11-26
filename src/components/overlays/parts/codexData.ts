/**
 * Plain data helpers behind the codex: grouping findings by file, building
 * GitHub links, and counting monsters for the bestiary. No React here.
 *
 * Every bug is in one of four states (src/lib/game/progress.ts): ALIVE
 * (its monster still fights), SUBDUED (its monster was beaten and waits on
 * its glowing line), FIXED (gone from the code, rewritten in the Workshop)
 * or SEALED (gone from the code because a `# noqa` accepts it). Fixed and
 * sealed bugs are no longer in `file.findings`; the file's `fixedFindings`
 * keeps them as they were in the original code. The codex lists all four.
 */
import { fileTally, findingState, goneFindings, isDungeonPurified, isDungeonQuiet, type FileTally, type FindingState } from "@/lib/game";
import type { AnalyzedFile, Finding, MonsterKind, RepoAnalysis, RepoProgress } from "@/lib/types";

/** How a file's dungeon stands: monsters still fight, all are subdued, or no bug is left in its code. */
export type DungeonState = "cursed" | "quiet" | "purified";

export interface FileGroup {
  file: AnalyzedFile;
  /** How many of its bugs are in each state. */
  tally: FileTally;
  /** Its original bugs gone from the code (fixed or sealed), listed after the ones still there. */
  gone: Finding[];
  state: DungeonState;
}

/** Where one bug stands: alive, subdued, fixed or sealed. */
export type BugStatus = FindingState;

const STATE_ORDER: Readonly<Record<DungeonState, number>> = { cursed: 0, quiet: 1, purified: 2 };

function dungeonState(file: AnalyzedFile, progress: RepoProgress): DungeonState {
  if (isDungeonPurified(file)) return "purified";
  return isDungeonQuiet(file, progress) ? "quiet" : "cursed";
}

/**
 * Every file with findings (or with bugs gone from its code), cursed
 * dungeons first (monsters to fight), then quiet ones (lines to fix), then
 * purified ones; alphabetical within each part.
 */
export function groupFindings(analysis: RepoAnalysis, progress: RepoProgress): FileGroup[] {
  const groups = analysis.files
    .filter((file) => file.status === "ok" && (file.findings.length > 0 || goneFindings(file).length > 0))
    .map((file) => ({ file, tally: fileTally(file, progress), gone: goneFindings(file), state: dungeonState(file, progress) }));
  return groups.sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.file.path.localeCompare(b.file.path));
}

/** Finds a finding by id anywhere in the analysis, including the bugs fixed in the code. */
export function findFinding(analysis: RepoAnalysis, id: string | undefined): Finding | null {
  if (!id) return null;
  for (const file of analysis.files) {
    const hit = file.findings.find((finding) => finding.id === id) ?? file.fixedFindings?.find((finding) => finding.id === id);
    if (hit) return hit;
  }
  return null;
}

/** Where a finding stands (see BugStatus). A finding of the code as it is now is never fixed or sealed. */
export function bugStatus(analysis: RepoAnalysis, progress: RepoProgress, finding: Finding): BugStatus {
  const file = analysis.files.find((candidate) => candidate.path === finding.path);
  return file ? findingState(file, finding, progress) : "alive";
}

/** Link to the exact line on GitHub, pinned to the analysed commit (each path segment URL-encoded). */
export function githubLineUrl(analysis: RepoAnalysis, finding: Finding): string {
  const { owner, repo, sha } = analysis.repo;
  const path = finding.path.split("/").map(encodeURIComponent).join("/");
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/blob/${sha}/${path}#L${finding.line}`;
}

export interface MonsterTally {
  /** How many findings this monster embodies in the repo (in the code now, or gone from it). */
  total: number;
  /** Of those, beaten in a fight and waiting for a fix. */
  subdued: number;
  /** Of those, gone from the code (fixed or sealed). */
  dealtWith: number;
  /** Distinct rule titles it stands for here, e.g. "Unused import (F401)". */
  rules: string[];
}

/** Per-monster counts for the bestiary. */
export function tallyMonsters(analysis: RepoAnalysis, progress: RepoProgress): Map<MonsterKind, MonsterTally> {
  const tallies = new Map<MonsterKind, MonsterTally>();
  for (const file of analysis.files) {
    for (const finding of [...file.findings, ...goneFindings(file)]) {
      const tally = tallies.get(finding.monster) ?? { total: 0, subdued: 0, dealtWith: 0, rules: [] };
      const state = findingState(file, finding, progress);
      tally.total++;
      if (state === "subdued") tally.subdued++;
      if (state === "fixed" || state === "sealed") tally.dealtWith++;
      const rule = `${finding.title} (${finding.code})`;
      if (!tally.rules.includes(rule)) tally.rules.push(rule);
      tallies.set(finding.monster, tally);
    }
  }
  return tallies;
}
