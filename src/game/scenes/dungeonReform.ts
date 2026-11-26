/**
 * The decisions behind a dungeon RE-FORMING while the hero stands in it,
 * after its file was edited in the Workshop (the scene runs the show, see
 * dungeon.ts):
 *
 *   the game resumes ──► fixed monsters dissolve ("rewritten"), their floor
 *                        carvings heal, the room shimmers (REFORM_SEC)
 *                    ──► no monster left alive?  purified on the spot:
 *                              the chest drops (or, with nothing left to
 *                              give, the hero is walked out)
 *                        otherwise                re-built from the new code,
 *                              the hero at the entrance
 *
 * Pure functions on plain data, so the rules are unit-tested.
 */
import { remainingFindings } from "@/lib/game/progress";
import type { AnalyzedFile, RepoProgress } from "@/lib/types";

/** How long the room shimmers before it re-forms (the "rewritten" dissolve fits inside). */
export const REFORM_SEC = 1.1;
/** A purified dungeon with no chest left to give walks the hero out after this long. */
export const WALK_OUT_SEC = 2.4;

export type ReformOutcome = "purify" | "rebuild";

/** Purify on the spot when no monster of the new code is still alive; otherwise rebuild. */
export function reformOutcome(file: AnalyzedFile, progress: RepoProgress): ReformOutcome {
  return remainingFindings(file, progress).length === 0 ? "purify" : "rebuild";
}

/** The file name without its folders. */
function baseName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** What the caption says while the room shimmers. */
export function reformCaption(path: string, fixedCount: number): string {
  const name = baseName(path);
  if (fixedCount === 0) return `${name} was rewritten: the dungeon re-forms!`;
  return `${fixedCount} ${fixedCount === 1 ? "bug" : "bugs"} fixed in ${name}: the code is rewritten!`;
}

/** The caption once a purified dungeon has nothing left to give. */
export const WALK_OUT_CAPTION = "Nothing left to fight here: back to the village!";

/** The caption when the hero stands in the re-formed dungeon. */
export function rebuiltCaption(remaining: number): string {
  return `The dungeon re-formed: ${remaining} ${remaining === 1 ? "monster" : "monsters"} still here.`;
}
