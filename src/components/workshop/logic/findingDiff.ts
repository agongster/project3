/**
 * "Which bugs are the same bug?" between two versions of a file.
 *
 * The editor asks this question in two places:
 *   - the status bar compares the live findings of the text being typed with
 *     the findings of the saved text: "ready to forge: 2 fixes, 1 new";
 *   - the gutter compares one live check with the next, so a monster that
 *     disappears because of what the player typed leaves with a little pop
 *     and a new one arrives with a "!".
 *
 * A finding's id contains its line number, so ids cannot be compared: one
 * new line at the top of the file "moves" every bug. Instead two findings are
 * the same bug when they have the same rule code and the same message (the
 * message names the variable or import: "`os` imported but unused"). When
 * several findings share both, the closest lines are paired first, so fixing
 * the first of two identical bugs reports the first one as fixed.
 *
 * Only for live hints: the authoritative before/after of a save is the
 * workspace's ForgeReport.
 */
import type { Finding } from "@/lib/types";

/** The fields of a finding that decide whether two findings are the same bug. */
export type MatchableFinding = Pick<Finding, "code" | "message" | "line">;

export interface FindingMatch<T> {
  /** Present in both lists (the line may have moved). */
  kept: { before: T; after: T }[];
  /** Only in `before`: fixed (or deleted). */
  gone: T[];
  /** Only in `after`: new. */
  added: T[];
}

/**
 * Above this many findings with the same code and message, pairs are made in
 * line order instead of by closest line (which compares every pair). Such
 * groups only appear in huge generated files, where being fast matters more.
 */
export const CLOSEST_PAIRING_LIMIT = 60;

function sameBugKey(finding: MatchableFinding): string {
  return `${finding.code}\u0000${finding.message}`;
}

function groupBySameBug<T extends MatchableFinding>(findings: readonly T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const finding of findings) {
    const key = sameBugKey(finding);
    const group = groups.get(key);
    if (group) group.push(finding);
    else groups.set(key, [finding]);
  }
  return groups;
}

/** Pairs two lists of the same bug, closest lines first. Returns index pairs. */
function pairClosest<T extends MatchableFinding>(before: readonly T[], after: readonly T[]): [number, number][] {
  if (before.length > CLOSEST_PAIRING_LIMIT || after.length > CLOSEST_PAIRING_LIMIT) {
    const count = Math.min(before.length, after.length);
    return Array.from({ length: count }, (_, i): [number, number] => [i, i]);
  }
  const candidates: { b: number; a: number; distance: number }[] = [];
  before.forEach((b, bi) => after.forEach((a, ai) => candidates.push({ b: bi, a: ai, distance: Math.abs(b.line - a.line) })));
  candidates.sort((x, y) => x.distance - y.distance || x.b - y.b || x.a - y.a);

  const usedBefore = new Set<number>();
  const usedAfter = new Set<number>();
  const pairs: [number, number][] = [];
  for (const { b, a } of candidates) {
    if (usedBefore.has(b) || usedAfter.has(a)) continue;
    usedBefore.add(b);
    usedAfter.add(a);
    pairs.push([b, a]);
  }
  return pairs;
}

/** Matches the findings of an older and a newer version of the same file. */
export function matchFindings<T extends MatchableFinding>(before: readonly T[], after: readonly T[]): FindingMatch<T> {
  const afterGroups = groupBySameBug(after);
  const keptBefore = new Set<T>();
  const keptAfter = new Set<T>();
  const kept: { before: T; after: T }[] = [];

  for (const [key, beforeGroup] of groupBySameBug(before)) {
    const afterGroup = afterGroups.get(key);
    if (!afterGroup) continue;
    for (const [bi, ai] of pairClosest(beforeGroup, afterGroup)) {
      kept.push({ before: beforeGroup[bi], after: afterGroup[ai] });
      keptBefore.add(beforeGroup[bi]);
      keptAfter.add(afterGroup[ai]);
    }
  }

  return {
    kept,
    gone: before.filter((finding) => !keptBefore.has(finding)),
    added: after.filter((finding) => !keptAfter.has(finding)),
  };
}

/** What forging the current text would do, as counts for the status bar. */
export interface ForgePreview {
  /** Bugs of the saved text that the typed text no longer has. */
  fixes: number;
  /** Bugs the typed text has that the saved text did not. */
  fresh: number;
}

export function forgePreview(saved: readonly MatchableFinding[], live: readonly MatchableFinding[]): ForgePreview {
  const { gone, added } = matchFindings(saved, live);
  return { fixes: gone.length, fresh: added.length };
}

/** "ready to forge: 2 fixes · 1 new", or a calmer line when the bugs did not change. */
export function forgePreviewText(preview: ForgePreview, dirty: boolean): string {
  if (!dirty) return "All forged";
  const parts: string[] = [];
  if (preview.fixes > 0) parts.push(`${preview.fixes} ${preview.fixes === 1 ? "fix" : "fixes"}`);
  if (preview.fresh > 0) parts.push(`${preview.fresh} new`);
  return parts.length === 0 ? "Unsaved changes" : `Ready to forge: ${parts.join(" · ")}`;
}
