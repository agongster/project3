/**
 * What the explorer shows next to a file: the same state its building has in
 * the world (cursed with N monsters, quiet with N lines to fix, treasure, a
 * prize to claim, done), worked out with the overworld's own helpers so the
 * two can never disagree.
 */
import { buildingStatus, linesToFix, monstersLeft, type BuildingStatus } from "@/game/scenes/progressView";
import { aliveFindings, getProgress } from "@/lib/game";
import type { AnalyzedFile, Grade, MonsterKind, SaveData, Severity } from "@/lib/types";

export type ExplorerBadge =
  /**
   * A Python file in the world. `bugs` counts its fighting monsters when
   * cursed, its lines left to fix when quiet; `monster` is its worst
   * fighting monster (cursed files only).
   */
  | { kind: "world"; status: BuildingStatus; bugs: number; monster: MonsterKind | null; grade: Grade }
  /** A Python file that could not be analyzed (a ruin in the world). */
  | { kind: "ruin" }
  /** Not a Python file: no state in the world. */
  | { kind: "plain" };

/** Most dangerous first. */
const SEVERITY_RANK: Readonly<Record<Severity, number>> = { boss: 0, elite: 1, minion: 2 };

/** The number a badge shows for each building status. */
function badgeCount(status: BuildingStatus, save: SaveData, repoKey: string, file: AnalyzedFile): number {
  if (status === "cursed") return monstersLeft(save, repoKey, file);
  if (status === "quiet") return linesToFix(file);
  return 0;
}

/** The explorer badge for one file; `file` is undefined for non-Python files. */
export function explorerBadge(save: SaveData, repoKey: string, file: AnalyzedFile | undefined): ExplorerBadge {
  if (!file) return { kind: "plain" };
  if (file.status !== "ok") return { kind: "ruin" };
  const status = buildingStatus(save, repoKey, file);
  const alive = aliveFindings(file, getProgress(save, repoKey));
  const worst = [...alive].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])[0];
  return {
    kind: "world",
    status,
    bugs: badgeCount(status, save, repoKey, file),
    monster: status === "cursed" && worst ? worst.monster : null,
    grade: file.quality.grade,
  };
}

/** A short spoken description for screen readers and tooltips. */
export function badgeDescription(badge: ExplorerBadge): string {
  if (badge.kind === "plain") return "";
  if (badge.kind === "ruin") return "could not be analyzed";
  const grade = `grade ${badge.grade}`;
  switch (badge.status) {
    case "cursed":
      return `cursed, ${badge.bugs} ${badge.bugs === 1 ? "monster" : "monsters"} to fight, ${grade}`;
    case "quiet":
      return `quiet, ${badge.bugs} ${badge.bugs === 1 ? "line" : "lines"} to fix, ${grade}`;
    case "treasure":
      return `treasure, ${grade}`;
    case "claimable":
      return `purified, prize waiting, ${grade}`;
    case "done":
      return `done, ${grade}`;
  }
}
