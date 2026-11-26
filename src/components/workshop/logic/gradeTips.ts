/**
 * The Grade tab's advice: the concrete things that would raise a file's
 * grade, each with the points it is worth, read from the same numbers the
 * grader uses (src/lib/analysis/quality.ts).
 *
 * The grader's five parts are docstrings, type hints, comments, tidiness and
 * focus, minus a penalty per bug; each tip below is "what is still missing
 * in one part". Function length is left out: the grader measures it from the
 * raw text, which the outline can only approximate.
 */
import {
  COMMENT_POINTS,
  DOC_POINTS,
  GRADE_THRESHOLDS,
  HINT_POINTS,
  MAX_COMMENT_RATIO,
  MAX_MONSTER_PENALTY,
  MIN_COMMENT_RATIO,
  MONSTER_PENALTY,
  TIDY_PENALTY_PER_HIT,
  TIDY_POINTS,
  TINY_FILE_LINES,
} from "@/lib/analysis/quality";
import type { FileOutline, FileQuality, Grade } from "@/lib/types";

export interface GradeTip {
  /** What to do, e.g. "Write docstrings for 3 functions". */
  label: string;
  /** Names it applies to (clipped by the caller), e.g. functions without a docstring. */
  names: string[];
  /** About how many points it is worth (rounded). */
  points: number;
}

/** Tips worth less than this many points are not shown. */
const MIN_TIP_POINTS = 1;

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** Non-blank lines, counted like the grader does (to spot "tiny" files). */
export function countCodeLines(source: string): number {
  return source.split(/\r\n|\r|\n/).filter((line) => line.trim() !== "").length;
}

/**
 * The tips for a file, most valuable first.
 * @param quality    the live grade of the text being edited
 * @param outline    its live outline (for the names of undocumented functions)
 * @param bugCount   monsters in the text
 * @param codeLines  non-blank lines (see countCodeLines)
 */
export function gradeTips(quality: FileQuality, outline: FileOutline, bugCount: number, codeLines: number): GradeTip[] {
  const tips: GradeTip[] = [];
  const bugPoints = Math.min(bugCount * MONSTER_PENALTY, MAX_MONSTER_PENALTY);
  if (bugCount > 0) tips.push({ label: `Fix ${plural(bugCount, "bug")}`, names: [], points: bugPoints });

  if (codeLines < TINY_FILE_LINES) return tips;
  const { metrics } = quality;

  const undocumented = outline.definitions.filter((definition) => definition.docstring === null).map((definition) => definition.name);
  const moduleMissing = outline.moduleDocstring === null;
  const docPoints = DOC_POINTS * (1 - metrics.docCoverage);
  if (docPoints >= MIN_TIP_POINTS) tips.push({ label: docstringTip(undocumented.length, moduleMissing), names: undocumented, points: docPoints });

  const functionCount = outline.definitions.filter((definition) => definition.kind !== "class").length;
  const hintPoints = HINT_POINTS * (1 - metrics.hintCoverage);
  if (functionCount > 0 && hintPoints >= MIN_TIP_POINTS) {
    const missing = Math.max(1, Math.round((1 - metrics.hintCoverage) * functionCount));
    tips.push({ label: `Add type hints to ${plural(missing, "function")}`, names: [], points: hintPoints });
  }

  if (metrics.commentRatio < MIN_COMMENT_RATIO) {
    tips.push({ label: "Explain the tricky parts with a few # comments", names: [], points: COMMENT_POINTS });
  } else if (metrics.commentRatio > MAX_COMMENT_RATIO) {
    tips.push({ label: "Trim the comments (commented-out code?)", names: [], points: COMMENT_POINTS });
  }

  const tidyPoints = Math.min(TIDY_POINTS, metrics.probeHits * TIDY_PENALTY_PER_HIT);
  if (tidyPoints >= MIN_TIP_POINTS) {
    tips.push({ label: `Tidy ${plural(metrics.probeHits, "style nit")} (long lines, a; b, odd names)`, names: [], points: tidyPoints });
  }

  return tips.map((tip) => ({ ...tip, points: Math.round(tip.points) })).sort((a, b) => b.points - a.points);
}

/** "Write 2 docstrings", "Give the file a docstring at the top", or both. */
function docstringTip(undocumented: number, moduleMissing: boolean): string {
  if (undocumented === 0) return moduleMissing ? "Give the file a docstring at the top" : "Write docstrings";
  return `Write ${plural(undocumented, "docstring")}${moduleMissing ? ", and one at the top of the file" : ""}`;
}

/** The next better grade and how many points it needs, or null at S. */
export function nextGrade(score: number): { grade: Grade; needed: number } | null {
  const better = GRADE_THRESHOLDS.filter((threshold) => threshold.minScore > score);
  const closest = better[better.length - 1];
  return closest ? { grade: closest.grade, needed: closest.minScore - score } : null;
}
