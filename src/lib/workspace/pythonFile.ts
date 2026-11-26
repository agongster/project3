/**
 * One Python file of the workspace, as plain immutable data: its original
 * and saved text, what Ruff found in each, and the `AnalyzedFile` the world
 * sees. A forge builds a new PythonFile; `forgeReport` compares two of them.
 *
 * How the numbers relate (all per file):
 *   - `inspection.findings` is the FULL list: every finding Ruff reports for
 *     the text (only the first syntax error), uncapped. It is what the editor
 *     underlines, what a forge reconciles, and what `findingCount` counts.
 *   - `view.findings` (the dungeon's monsters) is a capped selection of it
 *     (`selectMonsters`: same-line duplicates merged, per-rule and per-file
 *     caps); `view.overflow` counts what did not fit. A finding that merely
 *     moves in or out of the cap is never reported as fixed or new.
 *   - `view.realFixes` counts the ORIGINAL text's findings that are gone
 *     from the saved text (reconciled directly against the original), so
 *     reverting takes the credit back and fixing one bug while adding
 *     another still counts the fix.
 *
 * Syntax errors: Ruff stops at a syntax error and reports nothing else, so
 * the absence of the other findings proves nothing. While the saved text
 * has a syntax error, the file is therefore taken to still have the other
 * findings of its newest readable version (`knownFindings`): breaking the
 * code never counts as fixing it, and repairing it compares against what
 * was there before it broke.
 */
import { fullFindingList } from "@/lib/analysis/normalize";
import { inspectFile, type FileInspection, type LintFunction, type SourceFile } from "@/lib/analysis/analyzeSources";
import { SYNTAX_CODE } from "@/lib/analysis/rules";
import type { AnalyzedFile, Finding } from "@/lib/types";
import type { ForgeReport } from "./contract";
import { reconcileFindings } from "./reconcile";

export interface PythonFile {
  path: string;
  /** Size in bytes of the original file (from the listing). */
  size: number;
  /** Null when the file could not be downloaded: it is a ruin and can't be opened or edited. */
  original: string | null;
  /** The text as last forged; equal to `original` for an unchanged file. */
  saved: string | null;
  originalInspection: FileInspection;
  savedInspection: FileInspection;
  /** The newest saved inspection without a syntax error (the original's while there is none). */
  readable: FileInspection;
  /** The file as the world sees it: the saved text's analysis plus its real fixes. */
  view: AnalyzedFile;
}

/**
 * Builds a file from its download and, when the player edited it in an
 * earlier visit, its stored saved text. A failed download ignores the
 * stored text (it stays in storage for the next visit).
 */
export function createPythonFile(source: SourceFile, storedText: string | null, lint: LintFunction): PythonFile {
  const originalInspection = inspectFile(source, lint);
  const file: PythonFile = {
    path: source.path,
    size: source.size,
    original: source.source,
    saved: source.source,
    originalInspection,
    savedInspection: originalInspection,
    readable: originalInspection,
    view: originalInspection.file,
  };
  if (source.source === null || storedText === null || storedText === source.source) return file;
  return withSavedText(file, storedText, inspectText(file, storedText, lint));
}

/** Analyzes `text` as the saved text of `file` (the size follows the text). */
export function inspectText(file: Pick<PythonFile, "path">, text: string, lint: LintFunction): FileInspection {
  return inspectFile({ path: file.path, size: utf8Size(text), source: text }, lint);
}

/** `file` with a new saved text, given that text's inspection. */
export function withSavedText(file: PythonFile, saved: string, savedInspection: FileInspection): PythonFile {
  if (saved === file.original) {
    const original = file.originalInspection;
    return { ...file, saved, savedInspection: original, readable: original, view: original.file };
  }
  const readable = hasSyntaxError(savedInspection) ? file.readable : savedInspection;
  const next: PythonFile = { ...file, saved, savedInspection, readable, view: savedInspection.file };
  // A text Ruff couldn't read at all (a ruin) has no findings, but that doesn't mean they were fixed.
  if (savedInspection.file.status !== "ok") return next;
  const fixed = reconcileFindings(file.originalInspection.findings, knownFindings(next)).fixed;
  return fixed.length === 0 ? next : { ...next, view: { ...next.view, realFixes: fixed.length, fixedFindings: fixed } };
}

/**
 * The findings the saved text is known to have: Ruff's list, except that
 * while the text has a syntax error the other findings are those of the
 * newest readable version (see the top of this file).
 */
export function knownFindings(file: PythonFile): Finding[] {
  const saved = file.savedInspection;
  if (!hasSyntaxError(saved)) return saved.findings;
  return fullFindingList([...saved.findings.filter(isSyntaxError), ...file.readable.findings.filter((finding) => !isSyntaxError(finding))]);
}

/** What changed between two versions of a file, as the contract's ForgeReport. */
export function forgeReport(before: PythonFile, after: PythonFile): ForgeReport {
  const beforeFindings = knownFindings(before);
  const afterFindings = knownFindings(after);
  const { kept, fixed, introduced } = reconcileFindings(beforeFindings, afterFindings);
  return {
    path: after.path,
    linted: true,
    fixed,
    introduced,
    kept,
    before: summary(before.savedInspection, beforeFindings),
    after: summary(after.savedInspection, afterFindings),
    purified: beforeFindings.length > 0 && afterFindings.length === 0,
    file: after.view,
  };
}

function summary(inspection: FileInspection, findings: readonly Finding[]): ForgeReport["before"] {
  const { grade, score } = inspection.file.quality;
  return { grade, score, findingCount: findings.length };
}

function isSyntaxError(finding: Finding): boolean {
  return finding.code === SYNTAX_CODE;
}

function hasSyntaxError(inspection: FileInspection): boolean {
  return inspection.findings.some(isSyntaxError);
}

function utf8Size(text: string): number {
  return new TextEncoder().encode(text).length;
}
