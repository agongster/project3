/**
 * Pairing up the findings of two versions of a file: which bugs were fixed,
 * which are new, and which merely moved.
 *
 * A finding's id is `path:line:col:code`, so typing one line above a bug
 * changes its id even though nothing about the bug changed. Comparing ids
 * would report a fix (and a new bug) for every finding below the edit, so
 * findings are paired by what they are instead:
 *
 *   1. Only findings of the same rule can pair.
 *   2. Their offending lines must read the same (ignoring indentation and
 *      spacing), or nearly the same (NEAR_SAME_LINE_SIMILARITY) with Ruff
 *      saying the same thing about both apart from numbers: a function that
 *      gained an argument is still the same "too complex (12 > 10)" finding,
 *      but `import os` rewritten as `import sys` is a fix plus a new bug.
 *   3. Among the candidates, an identical line beats a nearly identical one,
 *      then the same message wins (`os` vs `sys` in `import os, sys`), then
 *      the nearest line, then the nearest column.
 *   4. Each finding is paired at most once (greedily, best candidates first).
 *
 * Unpaired findings of the old version were fixed; unpaired findings of the
 * new version were introduced. The rule errs on the side of "kept": an edit
 * that rewrites a buggy line beyond recognition counts as fix + new bug, but
 * moving code around never invents a fix. Findings that are exactly alike
 * (same rule, line text and message, e.g. two bare `except:`) can't be told
 * apart, so they may trade places; the counts are still right.
 */
import type { Finding } from "@/lib/types";
import type { KeptFinding } from "./contract";

/** Two offending lines at least this similar (0–1, see `lineSimilarity`) can still be the same finding. */
export const NEAR_SAME_LINE_SIMILARITY = 0.6;

/**
 * Pairing compares every candidate pair, so a group bigger than this
 * (thousands of identical findings in one pasted file) is paired in line
 * order instead, which keeps a forge fast even on absurd input.
 */
export const MAX_CANDIDATE_PAIRS = 40_000;

export interface Reconciliation {
  /** Findings in both versions, in the old version's order. */
  kept: KeptFinding[];
  /** Findings of the old version with no partner: gone from the code. */
  fixed: Finding[];
  /** Findings of the new version with no partner: new in the code. */
  introduced: Finding[];
}

/** One possible pairing of before[b] with after[a], and how good it is (lower is better). */
interface Candidate {
  b: number;
  a: number;
  messageMismatch: number;
  lineDistance: number;
  colDistance: number;
}

/**
 * Pairs up the findings of an old (`before`) and a new (`after`) version of
 * one file. Both lists are in line order (as `fullFindingList` returns them). Pure.
 */
export function reconcileFindings(before: readonly Finding[], after: readonly Finding[]): Reconciliation {
  const beforeText = before.map(offendingLine);
  const afterText = after.map(offendingLine);
  const partnerOfBefore = new Array<number>(before.length).fill(-1);
  const partnerOfAfter = new Array<number>(after.length).fill(-1);

  const pair = (candidates: readonly Candidate[]) => {
    for (const candidate of [...candidates].sort(byQuality)) {
      if (partnerOfBefore[candidate.b] !== -1 || partnerOfAfter[candidate.a] !== -1) continue;
      partnerOfBefore[candidate.b] = candidate.a;
      partnerOfAfter[candidate.a] = candidate.b;
    }
  };

  // Round 1: identical offending lines (same rule, same text).
  const exactKey = (finding: Finding, text: string) => `${finding.code}\n${text}`;
  const allBefore = before.map((_, b) => b);
  const allAfter = after.map((_, a) => a);
  for (const group of groupIndices(allBefore, allAfter, (b) => exactKey(before[b], beforeText[b]), (a) => exactKey(after[a], afterText[a]))) {
    if (group.b.length * group.a.length > MAX_CANDIDATE_PAIRS) pairInLineOrder(group, partnerOfBefore, partnerOfAfter);
    else pair(candidatesFor(group, before, after));
  }

  // Round 2: nearly identical lines (same rule), among the findings still alone.
  const aloneBefore = allBefore.filter((b) => partnerOfBefore[b] === -1);
  const aloneAfter = allAfter.filter((a) => partnerOfAfter[a] === -1);
  for (const group of groupIndices(aloneBefore, aloneAfter, (b) => before[b].code, (a) => after[a].code)) {
    if (group.b.length * group.a.length > MAX_CANDIDATE_PAIRS) continue;
    const similar = candidatesFor(group, before, after).filter(
      (candidate) =>
        sameMessageShape(before[candidate.b].message, after[candidate.a].message) && lineSimilarity(beforeText[candidate.b], afterText[candidate.a]) >= NEAR_SAME_LINE_SIMILARITY,
    );
    pair(similar);
  }

  return {
    kept: before.flatMap((finding, b) => (partnerOfBefore[b] === -1 ? [] : [{ before: finding, after: after[partnerOfBefore[b]] }])),
    fixed: before.filter((_, b) => partnerOfBefore[b] === -1),
    introduced: after.filter((_, a) => partnerOfAfter[a] === -1),
  };
}

// ───────────────────────────── Line text ─────────────────────────────

/**
 * The text of the line a finding points at, without any whitespace, so
 * re-indenting a block (wrapping it in an `if`) or tidying spaces doesn't
 * make a finding look different. Read from the finding's own snippet.
 */
export function offendingLine(finding: Finding): string {
  const line = finding.snippet.find((snippetLine) => snippetLine.n === finding.line);
  return (line?.text ?? "").replace(/\s+/g, "");
}

/**
 * How alike two lines are, from 0 (nothing in common) to 1 (identical): the
 * share of the longer line covered by their common start plus common end.
 * Cheap, and right for the usual edit, which changes one stretch of a line.
 */
export function lineSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const longest = Math.max(a.length, b.length);
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  let suffix = 0;
  while (suffix < a.length - prefix && suffix < b.length - prefix && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) suffix++;
  return (prefix + suffix) / longest;
}

/** True when two of Ruff's messages are the same apart from numbers ("too complex (13 > 10)" vs "(12 > 10)"). */
export function sameMessageShape(a: string, b: string): boolean {
  return a.replace(/\d+/g, "#") === b.replace(/\d+/g, "#");
}

// ───────────────────────────── Helpers ─────────────────────────────

/** Indices into `before` and `after` that share a key. */
interface Group {
  b: number[];
  a: number[];
}

/** Groups the given indices of both lists by key; only groups with members on both sides are returned. */
function groupIndices(beforeIndices: readonly number[], afterIndices: readonly number[], beforeKey: (b: number) => string, afterKey: (a: number) => string): Group[] {
  const groups = new Map<string, Group>();
  for (const b of beforeIndices) {
    const key = beforeKey(b);
    const group = groups.get(key) ?? { b: [], a: [] };
    group.b.push(b);
    groups.set(key, group);
  }
  for (const a of afterIndices) groups.get(afterKey(a))?.a.push(a);
  return [...groups.values()].filter((group) => group.a.length > 0);
}

/** Every pairing within a group, with what makes it better or worse. */
function candidatesFor(group: Group, before: readonly Finding[], after: readonly Finding[]): Candidate[] {
  const candidates: Candidate[] = [];
  for (const b of group.b) {
    for (const a of group.a) {
      candidates.push({
        b,
        a,
        messageMismatch: before[b].message === after[a].message ? 0 : 1,
        lineDistance: Math.abs(before[b].line - after[a].line),
        colDistance: Math.abs(before[b].col - after[a].col),
      });
    }
  }
  return candidates;
}

/** Best candidates first; ties keep the original order, so the result is deterministic. */
function byQuality(x: Candidate, y: Candidate): number {
  return x.messageMismatch - y.messageMismatch || x.lineDistance - y.lineDistance || x.colDistance - y.colDistance || x.b - y.b || x.a - y.a;
}

/** The cheap fallback for a huge group: the k-th finding before pairs with the k-th after (both in line order). */
function pairInLineOrder(group: Group, partnerOfBefore: number[], partnerOfAfter: number[]): void {
  const count = Math.min(group.b.length, group.a.length);
  for (let k = 0; k < count; k++) {
    partnerOfBefore[group.b[k]] = group.a[k];
    partnerOfAfter[group.a[k]] = group.b[k];
  }
}
