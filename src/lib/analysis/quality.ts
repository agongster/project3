/**
 * Grades how *nice* a Python file is, from 0 to 100, and turns that into a
 * letter (S / A / B / C). Clean files become treasure houses, and a better
 * grade means a better chest.
 *
 * The score is the sum of five parts, minus a penalty for bugs:
 *
 *   part          max   how to earn it
 *   ───────────   ───   ─────────────────────────────────────────────────────
 *   Docstrings     30   every def/class (and the module) has a docstring
 *   Type hints     25   every function has annotated arguments and return
 *   Comments       10   between 5% and 35% of code lines are # comments
 *   Tidiness       15   no long lines, one statement per line, PEP 8 names
 *   Focus          20   short functions (15) and a file under 400 lines (5)
 *                 ───
 *                 100   then −10 for every bug (monster) in the file, max −50
 *
 * Tiny files (fewer than 5 lines of code, e.g. an empty __init__.py) skip the
 * formula and get a flat B: nothing is wrong, but there is nothing to show off.
 *
 * Everything worth tweaking is a named constant right below.
 */
import type { FileQuality, Grade } from "@/lib/types";
import { splitLines } from "./normalize";

// ───────────────────────── Tuning knobs ─────────────────────────

/** Points available for each part. They add up to 100. */
export const DOC_POINTS = 30;
export const HINT_POINTS = 25;
export const COMMENT_POINTS = 10;
export const TIDY_POINTS = 15;
export const SHORT_FUNCTION_POINTS = 15;
export const SMALL_FILE_POINTS = 5;

/**
 * When there is nothing to measure (e.g. no functions, so no type hints to
 * check) we can't call it good or bad, so it counts as halfway.
 */
export const NOTHING_TO_MEASURE = 0.5;

/** Healthy share of # comment lines. Above the max it's usually commented-out code. */
export const MIN_COMMENT_RATIO = 0.05;
export const MAX_COMMENT_RATIO = 0.35;

/** Points lost per tidiness probe hit (long line, `a; b`, camelCase name…). */
export const TIDY_PENALTY_PER_HIT = 3;

/**
 * "Lines of code per function" = all non-blank lines ÷ number of functions.
 * Docstrings count as lines, so these limits are a little generous.
 */
export const SHORT_FUNCTION_LINES = 20;
export const MEDIUM_FUNCTION_LINES = 50;
/** Files with more code lines than this lose the small-file points. */
export const LARGE_FILE_LINES = 400;

/** Every monster in the file costs this much, up to the maximum. */
export const MONSTER_PENALTY = 10;
export const MAX_MONSTER_PENALTY = 50;

/** Files with fewer code lines than this are "tiny" and get a flat score. */
export const TINY_FILE_LINES = 5;
export const TINY_FILE_SCORE = 55;

/** Lowest score for each grade, best first. */
export const GRADE_THRESHOLDS: readonly { grade: Grade; minScore: number }[] = [
  { grade: "S", minScore: 85 },
  { grade: "A", minScore: 70 },
  { grade: "B", minScore: 50 },
  { grade: "C", minScore: 0 },
];

/** At most this many highlights are shown on the chest. */
export const MAX_HIGHLIGHTS = 3;

// Which probe rules (see rules.ts) feed which part of the score.
const MISSING_DOCSTRING_CODES = new Set(["D100", "D101", "D102", "D103"]);
const MISSING_HINT_CODES = new Set(["ANN001", "ANN201", "ANN202"]);

// ─────────────────────────── Grading ───────────────────────────

/** The bits of a lint hit that grading needs. */
export interface ProbeHit {
  code: string;
  /** 1-based line number. */
  line: number;
}

/**
 * Grades one file.
 * @param source        the file's text
 * @param probeHits     hits of the quality-probe rules only (no monster rules)
 * @param monsterCount  how many monster findings the file has
 */
export function gradeFile(source: string, probeHits: readonly ProbeHit[], monsterCount: number): FileQuality {
  const facts = readSourceFacts(source);
  const docHits = probeHits.filter((hit) => MISSING_DOCSTRING_CODES.has(hit.code));
  const hintHits = probeHits.filter((hit) => MISSING_HINT_CODES.has(hit.code));
  const tidyHits = probeHits.length - docHits.length - hintHits.length;

  const metrics: FileQuality["metrics"] = {
    definitions: facts.functionLines.length + facts.classCount,
    docCoverage: docstringCoverage(facts, docHits.length),
    hintCoverage: typeHintCoverage(facts, hintHits),
    commentRatio: facts.codeLines === 0 ? 0 : facts.commentLines / facts.codeLines,
    probeHits: tidyHits,
  };

  const bugPenalty = Math.min(monsterCount * MONSTER_PENALTY, MAX_MONSTER_PENALTY);

  if (facts.codeLines < TINY_FILE_LINES) {
    const score = Math.max(0, TINY_FILE_SCORE - bugPenalty);
    return { score, grade: gradeFor(score), highlights: [monsterCount === 0 ? "Small and tidy" : "Room to grow"], metrics };
  }

  const linesPerFunction = facts.functionLines.length === 0 ? null : facts.codeLines / facts.functionLines.length;
  const rawScore =
    DOC_POINTS * metrics.docCoverage +
    HINT_POINTS * metrics.hintCoverage +
    commentPoints(metrics.commentRatio) +
    Math.max(0, TIDY_POINTS - TIDY_PENALTY_PER_HIT * tidyHits) +
    shortFunctionPoints(linesPerFunction) +
    (facts.codeLines <= LARGE_FILE_LINES ? SMALL_FILE_POINTS : 0);

  const score = Math.max(0, Math.round(rawScore - bugPenalty));
  return {
    score,
    grade: gradeFor(score),
    highlights: pickHighlights(metrics, facts, linesPerFunction, monsterCount),
    metrics,
  };
}

/** Turns a 0–100 score into a letter grade. */
export function gradeFor(score: number): Grade {
  return GRADE_THRESHOLDS.find((threshold) => score >= threshold.minScore)?.grade ?? "C";
}

// ──────────────────────── The five parts ────────────────────────

/**
 * Share of documentable things with a docstring. The module itself counts as
 * one more thing to document, so a file of constants can still earn it.
 * (Ruff's D1xx rules only check *public* names, so private helpers are
 * treated as documented — good enough for a game.)
 */
function docstringCoverage(facts: SourceFacts, missingDocstrings: number): number {
  const documentable = facts.functionLines.length + facts.classCount + 1;
  return clamp01((documentable - missingDocstrings) / documentable);
}

/**
 * Share of functions whose arguments and return value are all annotated.
 * A function with several missing hints still only counts once.
 */
function typeHintCoverage(facts: SourceFacts, hintHits: readonly ProbeHit[]): number {
  const functionCount = facts.functionLines.length;
  if (functionCount === 0) return NOTHING_TO_MEASURE;
  const functionsMissingHints = new Set(hintHits.map((hit) => owningFunctionLine(facts.functionLines, hit.line)));
  return clamp01((functionCount - functionsMissingHints.size) / functionCount);
}

function commentPoints(commentRatio: number): number {
  return commentRatio >= MIN_COMMENT_RATIO && commentRatio <= MAX_COMMENT_RATIO ? COMMENT_POINTS : 0;
}

function shortFunctionPoints(linesPerFunction: number | null): number {
  if (linesPerFunction === null) return SHORT_FUNCTION_POINTS * NOTHING_TO_MEASURE;
  if (linesPerFunction <= SHORT_FUNCTION_LINES) return SHORT_FUNCTION_POINTS;
  if (linesPerFunction <= MEDIUM_FUNCTION_LINES) return SHORT_FUNCTION_POINTS / 2;
  return 0;
}

// ────────────────────────── Highlights ──────────────────────────

/** Friendly reasons shown on the treasure chest, best ones first. */
function pickHighlights(metrics: FileQuality["metrics"], facts: SourceFacts, linesPerFunction: number | null, monsterCount: number): string[] {
  const hasFunctions = facts.functionLines.length > 0;
  const highlights: string[] = [];

  if (hasFunctions && metrics.docCoverage === 1) highlights.push("Every function has a docstring");
  else if (metrics.definitions > 0 && metrics.docCoverage >= 0.75) highlights.push("Well documented");

  if (hasFunctions && metrics.hintCoverage === 1) highlights.push("Fully type-hinted");
  else if (hasFunctions && metrics.hintCoverage >= 0.75) highlights.push("Mostly type-hinted");

  if (facts.functionLines.length >= 2 && linesPerFunction !== null && linesPerFunction <= SHORT_FUNCTION_LINES) {
    highlights.push("Short, focused functions");
  }
  if (commentPoints(metrics.commentRatio) > 0) highlights.push("Helpful comments");
  if (metrics.probeHits === 0 && monsterCount === 0) highlights.push("Neat and tidy");

  if (highlights.length === 0) highlights.push(monsterCount === 0 ? "No bugs spotted" : "Room to grow");
  return highlights.slice(0, MAX_HIGHLIGHTS);
}

// ──────────────────── Reading the source text ────────────────────

/** Simple facts read straight from the text with regular expressions. */
interface SourceFacts {
  /** Non-blank lines (comments and docstrings included). */
  codeLines: number;
  /** Lines that are only a # comment (a #! shebang doesn't count). */
  commentLines: number;
  /** 1-based line numbers of every `def` / `async def`, top to bottom. */
  functionLines: number[];
  classCount: number;
}

const FUNCTION_LINE = /^\s*(async\s+)?def\s+\w/;
const CLASS_LINE = /^\s*class\s+\w/;

/**
 * A regex count is not a real parser (a `def` inside a multi-line string would
 * be counted), but it is easy to explain and right for normal code.
 */
function readSourceFacts(source: string): SourceFacts {
  const facts: SourceFacts = { codeLines: 0, commentLines: 0, functionLines: [], classCount: 0 };
  splitLines(source).forEach((text, index) => {
    const trimmed = text.trim();
    if (trimmed === "") return;
    facts.codeLines++;
    if (trimmed.startsWith("#") && !trimmed.startsWith("#!")) facts.commentLines++;
    if (FUNCTION_LINE.test(text)) facts.functionLines.push(index + 1);
    else if (CLASS_LINE.test(text)) facts.classCount++;
  });
  return facts;
}

/**
 * The `def` a hint diagnostic belongs to: the closest `def` at or above it.
 * (A missing argument hint can sit a few lines below its `def` when the
 * signature is split over several lines.)
 */
function owningFunctionLine(functionLines: readonly number[], hitLine: number): number {
  let owner = 0;
  for (const defLine of functionLines) {
    if (defLine > hitLine) break;
    owner = defLine;
  }
  return owner;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
