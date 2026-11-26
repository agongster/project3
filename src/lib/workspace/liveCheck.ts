/**
 * What the editor shows while the player types: every finding with the exact
 * stretch of text to underline, and Ruff's own quick fix when it has one.
 *
 * Positions: the lint worker runs Ruff with UTF-16 positions, so a column is
 * a JavaScript string index plus one (an emoji counts as two columns, a tab
 * as one). An end column points one past the last character, as Ruff's does.
 */
import type { FileInspection } from "@/lib/analysis/analyzeSources";
import type { LintEdit, LintFix } from "@/lib/analysis/normalize";
import type { FileKind, Finding } from "@/lib/types";
import type { LiveCheck, LiveFinding, QuickFix, TextEdit } from "./contract";

/**
 * Rules whose automatic fix Ruff itself marks as safe (it can't change what
 * the program does), from Ruff's rule documentation. Ruff's WebAssembly
 * build reports each fix but not its safety, so every other fix is treated
 * as possibly changing behaviour ("unsafe"), which is the cautious choice.
 */
export const SAFE_FIX_RULES: ReadonlySet<string> = new Set([
  "F401", // unused import (but see INIT_UNSAFE_FIX_RULES)
  "F541", // f-string without any placeholders
  "F632", // `is` used to compare with a literal
  "B009", // getattr(x, "constant")
  "B010", // setattr(x, "constant", value)
  "B013", // except (OnlyOne,):
  "B014", // the same exception twice in one except
  "B033", // the same value twice in a set literal
  "SIM300", // "yoda" comparison
]);

/** In an `__init__.py`, removing an "unused" import can break code that imports it from the package. */
const INIT_UNSAFE_FIX_RULES: ReadonlySet<string> = new Set(["F401"]);

/** The editor's view of an inspected text (see `inspectFile`). */
export function liveCheckOf(inspection: FileInspection): LiveCheck {
  const kind = inspection.file.kind;
  return {
    findings: inspection.findings.map((finding) => liveFinding(finding, inspection.fixes.get(finding) ?? null, kind)),
    quality: inspection.file.quality,
    outline: inspection.file.outline,
  };
}

function liveFinding(finding: Finding, fix: LintFix | null, kind: FileKind): LiveFinding {
  return {
    finding,
    range: { line: finding.line, col: finding.col, endLine: finding.endLine, endCol: finding.endCol },
    quickFix: fix ? quickFix(finding, fix, kind) : null,
  };
}

/** Ruff's fix as a quick fix: titled, its edits ordered last first, and marked safe or not. */
export function quickFix(finding: Finding, fix: LintFix, kind: FileKind): QuickFix {
  return {
    title: fix.message ?? `Fix: ${finding.title}`,
    edits: [...fix.edits].sort(lastFirst).map(toTextEdit),
    safe: isSafeFix(finding.code, kind),
  };
}

export function isSafeFix(code: string, kind: FileKind): boolean {
  if (kind === "init" && INIT_UNSAFE_FIX_RULES.has(code)) return false;
  return SAFE_FIX_RULES.has(code);
}

/** Later positions first, so applying the edits in order never shifts one that is still to come. */
function lastFirst(x: LintEdit, y: LintEdit): number {
  return y.line - x.line || y.col - x.col;
}

function toTextEdit(edit: LintEdit): TextEdit {
  return { line: edit.line, col: edit.col, endLine: edit.endLine, endCol: edit.endCol, text: edit.text };
}
