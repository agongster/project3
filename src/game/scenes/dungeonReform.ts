/**
 * The decisions behind a dungeon RE-FORMING while the hero stands in it,
 * after its file was edited in the Workshop (the scene runs the show, see
 * dungeon.ts):
 *
 *   the game resumes ──► monsters whose bug is gone dissolve: fixed ones as
 *                        "rewritten" (their floor lines heal to gold),
 *                        ignored ones in a plainer fade (their lines turn to
 *                        stone); the room shimmers (REFORM_SEC)
 *                    ──► no bug left in the file?  PURIFY on the spot:
 *                              the purify wave and the prize chest (or,
 *                              with nothing left to give, the hero is
 *                              walked out)
 *                        the room still has a monster to fight or a line
 *                        to fix?                  SETTLE: the room stays
 *                              exactly as it is. The hero keeps their place,
 *                              the other monsters fight on, healed lines
 *                              stay where they lie.
 *                        the room is done, but the file has more bugs?
 *                                                 REBUILD from the new code
 *                              (the next wave), the hero back at the entrance
 *
 * A bug that is NEW to the room (the player wrote one, or fixing a bug let
 * another one in under the cap of monsters per file) gets no monster in the
 * middle of a visit: it waits until the room is done or entered again. So
 * the room is never rebuilt under the player's feet while they still have
 * something to do in it.
 *
 * Pure functions on plain data, so the rules are unit-tested.
 */
import { reconcileFindings } from "@/lib/workspace/reconcile";
import type { AnalyzedFile, Finding } from "@/lib/types";

/** How long the room shimmers before it re-forms (the "rewritten" dissolve fits inside). */
export const REFORM_SEC = 1.1;
/** A purified dungeon with no chest left to give walks the hero out after this long. */
export const WALK_OUT_SEC = 2.4;

export type ReformOutcome = "purify" | "settle" | "rebuild";

/**
 * What the room does once the edit is in (see the file comment).
 * `roomFindings` are the new code's findings that live in this room (they
 * have a monster or a line here); `file.findings` may hold more, waiting.
 */
export function reformOutcome(file: AnalyzedFile, roomFindings: readonly Finding[]): ReformOutcome {
  if (file.findings.length === 0) return "purify";
  return roomFindings.length > 0 ? "settle" : "rebuild";
}

/** How the room's findings fared in the edit, as the dungeon needs it. */
export interface EditOutcome {
  /** Old id → the same finding in the new code (its line, and so its id, may have moved). */
  renamed: Map<string, Finding>;
  /** Old ids gone from the code because they were fixed for real. */
  fixed: Set<string>;
  /** Old ids gone from the code because they were ignored with `# noqa`. */
  sealed: Set<string>;
  /** Findings of the new code that are new to the room: they wait (see the file comment). */
  waiting: Finding[];
}

/**
 * Follows the room's findings through an edit. The save said which ids it
 * took out of the code (`toldFixed`, `toldSealed`: the ids the world knew);
 * every other finding is matched to the new code by what it says
 * (src/lib/workspace/reconcile.ts). A finding that matches nothing is gone,
 * and counts as fixed unless the save said it was ignored.
 */
export function followEdit(roomFindings: readonly Finding[], after: AnalyzedFile, toldFixed: ReadonlySet<string>, toldSealed: ReadonlySet<string>): EditOutcome {
  const told = (id: string) => toldFixed.has(id) || toldSealed.has(id);
  const renamed = new Map<string, Finding>();
  for (const pair of reconcileFindings(roomFindings, after.findings).kept) {
    if (!told(pair.before.id)) renamed.set(pair.before.id, pair.after);
  }
  const gone = roomFindings.map((finding) => finding.id).filter((id) => !renamed.has(id));
  const stillHere = new Set([...renamed.values()].map((finding) => finding.id));
  return {
    renamed,
    fixed: new Set(gone.filter((id) => !toldSealed.has(id))),
    sealed: new Set(gone.filter((id) => toldSealed.has(id))),
    waiting: after.findings.filter((finding) => !stillHere.has(finding.id)),
  };
}

/** The file name without its folders. */
function baseName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** "1 bug", "3 monsters": a count with its noun. */
function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** What the caption says while the room shimmers ("" when nothing in the room changed). */
export function reformCaption(path: string, fixedCount: number, ignoredCount = 0): string {
  const name = baseName(path);
  if (fixedCount > 0) return `${count(fixedCount, "bug")} fixed in ${name}: the code is rewritten!`;
  if (ignoredCount > 0) return `${count(ignoredCount, "bug")} ignored in ${name}.`;
  return "";
}

/** The caption once a purified dungeon has nothing left to give. */
export const WALK_OUT_CAPTION = "Nothing left to fix here: back to the village!";

/** The caption when the room was done and more bugs of the file come out of the code (the rebuild). */
export function nextWaveCaption(path: string): string {
  return `This room is done: more bugs crawl out of ${baseName(path)}!`;
}

/** The caption when the hero stands in the rebuilt dungeon: monsters to fight, or else lines to fix. */
export function rebuiltCaption(fighting: number, toFix: number): string {
  if (fighting > 0) return `${count(fighting, "more monster")} to fight here.`;
  return `${count(toFix, "more line")} to fix here.`;
}

/**
 * The caption once the room has settled after an edit: what is left to do
 * in it, and how many bugs of the file wait for later (`waiting`).
 */
export function settledCaption(fighting: number, toFix: number, waiting = 0): string {
  const here = fighting > 0 ? `${count(fighting, "monster")} still to fight here.` : `${count(toFix, "glowing line")} left to fix here.`;
  return waiting > 0 ? `${here} ${count(waiting, "more bug")} will come out later.` : here;
}
