/**
 * The decisions behind a dungeon RE-FORMING while the hero stands in it,
 * after its file was edited in the Workshop (the scene runs the show, see
 * dungeon.ts):
 *
 *   the game resumes ──► monsters whose bug is gone dissolve: fixed ones as
 *                        "rewritten" (their floor lines heal to gold),
 *                        sealed ones in a plainer fade (their lines turn to
 *                        sealed stone); the room shimmers (REFORM_SEC)
 *                    ──► no bug left in the file?  PURIFY on the spot:
 *                              the purify wave and the prize chest (or,
 *                              with nothing left to give, the hero is
 *                              walked out)
 *                        still quiet?             SETTLE: the room stays as
 *                              it is, healed and sealed lines where they
 *                              lie, the other wisps dozing on (the player is
 *                              going from line to line fixing them)
 *                        new monsters to fight?   REBUILD from the new code,
 *                              the hero back at the entrance
 *
 * Pure functions on plain data, so the rules are unit-tested.
 */
import { isDungeonQuiet } from "@/lib/game/progress";
import { reconcileFindings } from "@/lib/workspace/reconcile";
import type { AnalyzedFile, Finding, RepoProgress } from "@/lib/types";

/** How long the room shimmers before it re-forms (the "rewritten" dissolve fits inside). */
export const REFORM_SEC = 1.1;
/** A purified dungeon with no chest left to give walks the hero out after this long. */
export const WALK_OUT_SEC = 2.4;

export type ReformOutcome = "purify" | "settle" | "rebuild";

/** What the room does once the edit is in (see the file comment). `progress` is the save's, after the forge. */
export function reformOutcome(file: AnalyzedFile, progress: RepoProgress): ReformOutcome {
  if (file.findings.length === 0) return "purify";
  return isDungeonQuiet(file, progress) ? "settle" : "rebuild";
}

/** How the old code's findings fared in the edit, as the dungeon needs it. */
export interface EditOutcome {
  /** Old id → the same finding in the new code (its line, and so its id, may have moved). */
  renamed: Map<string, Finding>;
  /** Old ids gone from the code because they were fixed for real. */
  fixed: Set<string>;
  /** Old ids gone from the code because they were sealed with `# noqa`. */
  sealed: Set<string>;
}

/**
 * Follows the dungeon's findings through an edit. The forge said which ids
 * it took out of the code (`toldFixed`, `toldSealed`: the ids the world
 * knew); every other finding is matched to the new code by what it says
 * (src/lib/workspace/reconcile.ts). A finding that matches nothing is gone,
 * and counts as fixed unless the forge said it was sealed.
 */
export function followEdit(before: AnalyzedFile, after: AnalyzedFile, toldFixed: ReadonlySet<string>, toldSealed: ReadonlySet<string>): EditOutcome {
  const told = (id: string) => toldFixed.has(id) || toldSealed.has(id);
  const renamed = new Map<string, Finding>();
  for (const pair of reconcileFindings(before.findings, after.findings).kept) {
    if (!told(pair.before.id)) renamed.set(pair.before.id, pair.after);
  }
  const gone = before.findings.map((finding) => finding.id).filter((id) => !renamed.has(id));
  return {
    renamed,
    fixed: new Set(gone.filter((id) => !toldSealed.has(id))),
    sealed: new Set(gone.filter((id) => toldSealed.has(id))),
  };
}

/** The file name without its folders. */
function baseName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function bugs(count: number): string {
  return `${count} ${count === 1 ? "bug" : "bugs"}`;
}

/** What the caption says while the room shimmers. */
export function reformCaption(path: string, fixedCount: number, sealedCount = 0): string {
  const name = baseName(path);
  if (fixedCount > 0) return `${bugs(fixedCount)} fixed in ${name}: the code is rewritten!`;
  if (sealedCount > 0) return `${bugs(sealedCount)} sealed in ${name}.`;
  return `${name} was rewritten: the dungeon re-forms!`;
}

/** The caption once a purified dungeon has nothing left to give. */
export const WALK_OUT_CAPTION = "Nothing left to fix here: back to the village!";

/** The caption when the hero stands in the re-formed dungeon: monsters to fight, or else lines to fix. */
export function rebuiltCaption(fighting: number, toFix: number): string {
  if (fighting > 0) return `The dungeon re-formed: ${fighting} ${fighting === 1 ? "monster" : "monsters"} still here.`;
  return `The dungeon re-formed: ${toFix} ${toFix === 1 ? "line" : "lines"} still to fix.`;
}

/** The caption once a quiet dungeon has settled after an edit. */
export function settledCaption(toFix: number): string {
  return `${toFix} ${toFix === 1 ? "glowing line" : "glowing lines"} left to fix here.`;
}
