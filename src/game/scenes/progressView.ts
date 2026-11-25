/**
 * Read-only questions about the player's progress in this repo, phrased the
 * way the overworld needs them ("is this house cursed?", "is its chest
 * still closed?"). All answers are derived from the save on every call, so
 * they are always up to date.
 */
import { getProgress, isDungeonCleared, remainingFindings } from "@/lib/game";
import type { AnalyzedFile, RepoAnalysis, SaveData } from "@/lib/types";

/**
 * What a file's building currently is:
 *  - cursed     has findings and the dungeon is not cleared yet
 *  - treasure   a clean file whose chest is still closed
 *  - claimable  a cleared dungeon whose prize chest is still closed
 *  - done       nothing left to do here
 */
export type BuildingStatus = "cursed" | "treasure" | "claimable" | "done";

export function buildingStatus(save: SaveData, repoKey: string, file: AnalyzedFile | undefined): BuildingStatus {
  if (!file || file.status !== "ok") return "done";
  const progress = getProgress(save, repoKey);
  const opened = progress.opened.includes(file.path);
  if (file.findings.length > 0) {
    if (!isDungeonCleared(file, progress)) return "cursed";
    return opened ? "done" : "claimable";
  }
  return opened ? "done" : "treasure";
}

/** Monsters still alive in a file's dungeon. */
export function bugsLeft(save: SaveData, repoKey: string, file: AnalyzedFile): number {
  return remainingFindings(file, getProgress(save, repoKey)).length;
}

/** True when every file with findings has been cleared (the whole repo is purified). */
export function allDungeonsCleared(save: SaveData, repoKey: string, analysis: RepoAnalysis): boolean {
  const progress = getProgress(save, repoKey);
  return analysis.files.every((file) => file.findings.length === 0 || isDungeonCleared(file, progress));
}

/** "utils/parse.py" stays as is; very long paths show only the file name. */
export function shortPath(path: string, maxLength = 22): string {
  if (path.length <= maxLength) return path;
  return path.slice(path.lastIndexOf("/") + 1);
}
