/**
 * Read-only questions about the player's progress in this repo, phrased the
 * way the overworld needs them ("is this house cursed?", "is its chest
 * still closed?"). All answers are derived from the save and the code on
 * every call, so they are always up to date. The rules behind them (alive,
 * subdued, fixed, sealed; quiet and purified dungeons) are in
 * src/lib/game/progress.ts.
 */
import { aliveFindings, getProgress, isDungeonPurified, isDungeonQuiet, isRepoPurified } from "@/lib/game";
import type { AnalyzedFile, RepoAnalysis, SaveData } from "@/lib/types";

/**
 * What a file's building currently is:
 *  - cursed     monsters still fight in its dungeon
 *  - quiet      every monster is subdued, but its bugs are still in the code:
 *               still cursed, only calmer (its glowing lines wait to be fixed)
 *  - treasure   a clean file whose chest is still closed
 *  - claimable  a purified dungeon (no bug left in its code) whose prize chest is still closed
 *  - done       nothing left to do here
 */
export type BuildingStatus = "cursed" | "quiet" | "treasure" | "claimable" | "done";

export function buildingStatus(save: SaveData, repoKey: string, file: AnalyzedFile | undefined): BuildingStatus {
  if (!file || file.status !== "ok") return "done";
  const progress = getProgress(save, repoKey);
  if (file.findings.length > 0) return isDungeonQuiet(file, progress) ? "quiet" : "cursed";
  const opened = progress.opened.includes(file.path);
  if (opened) return "done";
  return isDungeonPurified(file) ? "claimable" : "treasure";
}

/** True for a building whose dungeon still has bugs in its code (cursed or quiet): it can be entered. */
export function isCursed(status: BuildingStatus): boolean {
  return status === "cursed" || status === "quiet";
}

/** Monsters still fighting in a file's dungeon. */
export function monstersLeft(save: SaveData, repoKey: string, file: AnalyzedFile): number {
  return aliveFindings(file, getProgress(save, repoKey)).length;
}

/** Bugs still in a file's code, fought or not: each one is a line to fix. */
export function linesToFix(file: AnalyzedFile): number {
  return file.findings.length;
}

/** True when every bug of the repo is fixed or sealed: every dungeon is purified (the victory). */
export function allDungeonsPurified(analysis: RepoAnalysis): boolean {
  return isRepoPurified(analysis);
}

/** "utils/parse.py" stays as is; very long paths show only the file name. */
export function shortPath(path: string, maxLength = 22): string {
  if (path.length <= maxLength) return path;
  return path.slice(path.lastIndexOf("/") + 1);
}
