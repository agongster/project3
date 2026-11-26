/**
 * Plain data helpers behind the codex: grouping findings by file, building
 * GitHub links, and counting monsters for the bestiary. No React here.
 *
 * A bug can be dealt with two ways: its monster SQUASHED in the game (its
 * finding id is in `progress.defeated`), or the bug FIXED in the code in the
 * Workshop (it is gone from `file.findings`; the file's `fixedFindings`
 * keeps it, as it was in the original code). The codex lists both.
 */
import { isDungeonCleared } from "@/lib/game";
import type { AnalyzedFile, Finding, MonsterKind, RepoAnalysis, RepoProgress } from "@/lib/types";

export interface FileGroup {
  file: AnalyzedFile;
  /** Findings whose monster is defeated. */
  defeated: number;
  /** Findings of the original code fixed in the Workshop (no longer in `file.findings`). */
  fixed: Finding[];
  /** True once the file's dungeon is purified (by fighting, or by fixing its last bug). */
  purified: boolean;
}

/** How one bug stands: still in the code with its monster alive, squashed in the game, or fixed in the code. */
export type BugStatus = "lurking" | "squashed" | "fixed";

/**
 * Every file with findings (or with bugs fixed in the code), cursed dungeons
 * first (the to-do part of the list), then purified ones; alphabetical
 * within each part.
 */
export function groupFindings(analysis: RepoAnalysis, progress: RepoProgress): FileGroup[] {
  const defeated = new Set(progress.defeated);
  const groups = analysis.files
    .filter((file) => file.status === "ok" && (file.findings.length > 0 || (file.fixedFindings?.length ?? 0) > 0))
    .map((file) => ({
      file,
      defeated: file.findings.filter((finding) => defeated.has(finding.id)).length,
      fixed: file.fixedFindings ?? [],
      purified: file.findings.length === 0 || isDungeonCleared(file, progress),
    }));
  return groups.sort((a, b) => Number(a.purified) - Number(b.purified) || a.file.path.localeCompare(b.file.path));
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

/** Where a finding stands (see BugStatus). A finding of the code as it is now is never "fixed". */
export function bugStatus(analysis: RepoAnalysis, progress: RepoProgress, finding: Finding): BugStatus {
  const file = analysis.files.find((candidate) => candidate.path === finding.path);
  if (file && !file.findings.some((current) => current.id === finding.id) && file.fixedFindings?.some((fixed) => fixed.id === finding.id)) return "fixed";
  return progress.defeated.includes(finding.id) ? "squashed" : "lurking";
}

/** Link to the exact line on GitHub, pinned to the analysed commit (each path segment URL-encoded). */
export function githubLineUrl(analysis: RepoAnalysis, finding: Finding): string {
  const { owner, repo, sha } = analysis.repo;
  const path = finding.path.split("/").map(encodeURIComponent).join("/");
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/blob/${sha}/${path}#L${finding.line}`;
}

export interface MonsterTally {
  /** How many findings this monster embodies in the repo. */
  total: number;
  defeated: number;
  /** Distinct rule titles it stands for here, e.g. "Unused import (F401)". */
  rules: string[];
}

/** Per-monster counts for the bestiary. */
export function tallyMonsters(analysis: RepoAnalysis, progress: RepoProgress): Map<MonsterKind, MonsterTally> {
  const defeated = new Set(progress.defeated);
  const tallies = new Map<MonsterKind, MonsterTally>();
  for (const file of analysis.files) {
    for (const finding of file.findings) {
      const tally = tallies.get(finding.monster) ?? { total: 0, defeated: 0, rules: [] };
      tally.total++;
      if (defeated.has(finding.id)) tally.defeated++;
      const rule = `${finding.title} (${finding.code})`;
      if (!tally.rules.includes(rule)) tally.rules.push(rule);
      tallies.set(finding.monster, tally);
    }
  }
  return tallies;
}
