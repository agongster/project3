/**
 * Turns Ruff's raw diagnostics into Lintlands `Finding`s (one per monster).
 *
 * Ruff's JSON field names (`start_location.row`, …) have changed between
 * versions before, so ALL knowledge of them lives in `normalizeDiagnostic()`.
 * If a Ruff upgrade breaks something, that function (and its fixture test in
 * tests/analysis) is the only place to look.
 */
import type { Finding, Severity, SnippetLine } from "@/lib/types";
import { ruleInfo, SYNTAX_CODE } from "./rules";

// ─────────────────────── Ruff's raw shape ───────────────────────

interface RuffLocation {
  row: number;
  column: number;
}

/**
 * The part of a Ruff diagnostic that we read. Locations are optional because
 * this JSON crosses a Web Worker boundary untyped; we never trust it blindly.
 */
export interface RawDiagnostic {
  /** "F401", … — or "invalid-syntax" / null for syntax errors. */
  code: string | null;
  message: string;
  start_location?: RuffLocation;
  end_location?: RuffLocation;
}

/** A Ruff diagnostic in our own vocabulary (1-based positions). */
export interface LintHit {
  code: string;
  message: string;
  line: number;
  col: number;
  endLine: number;
  endCol: number;
}

/**
 * Ruff has reported syntax errors in three ways over the years: as rule
 * E999, without a code (null), and (since 0.12) as "invalid-syntax".
 */
function isSyntaxErrorCode(code: string | null): boolean {
  return code === null || code === "invalid-syntax" || code === "E999";
}

/** The ONE place that knows Ruff's diagnostic field names. */
export function normalizeDiagnostic(raw: RawDiagnostic): LintHit {
  const start = raw.start_location ?? { row: 1, column: 1 };
  const end = raw.end_location ?? start;
  return {
    code: isSyntaxErrorCode(raw.code) ? SYNTAX_CODE : String(raw.code),
    message: typeof raw.message === "string" ? raw.message : "",
    line: start.row,
    col: start.column,
    endLine: end.row,
    endCol: end.column,
  };
}

// ─────────────────────────── Findings ───────────────────────────

/** Lines of context shown above and below the finding on the bug card. */
export const SNIPPET_CONTEXT_LINES = 3;
/** Longer snippet lines are cut off (with "…") so the card stays readable. */
export const SNIPPET_MAX_LINE_LENGTH = 120;

/**
 * Splits source text into lines the same way Ruff counts them
 * (\n, \r\n and a lone \r all end a line).
 */
export function splitLines(source: string): string[] {
  return source.split(/\r\n|\r|\n/);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function trimLongLine(text: string): string {
  return text.length > SNIPPET_MAX_LINE_LENGTH ? `${text.slice(0, SNIPPET_MAX_LINE_LENGTH - 1)}…` : text;
}

/** The finding's line(s) plus a few lines of context on each side. */
export function extractSnippet(lines: readonly string[], line: number, endLine: number): SnippetLine[] {
  const first = Math.max(1, line - SNIPPET_CONTEXT_LINES);
  const last = Math.min(lines.length, line + SNIPPET_CONTEXT_LINES);
  const snippet: SnippetLine[] = [];
  for (let n = first; n <= last; n++) {
    snippet.push({ n, text: trimLongLine(lines[n - 1].trimEnd()), hit: n >= line && n <= endLine });
  }
  return snippet;
}

/**
 * Builds the Finding for one lint hit. Positions are clamped into the file:
 * Ruff points syntax errors at "end of file" one line past the last line.
 */
export function buildFinding(path: string, hit: LintHit, lines: readonly string[]): Finding {
  const lastLine = Math.max(1, lines.length);
  const line = clamp(hit.line, 1, lastLine);
  const endLine = clamp(hit.endLine, line, lastLine);
  const col = Math.max(1, hit.col);
  const endCol = endLine === line ? Math.max(col, hit.endCol) : Math.max(1, hit.endCol);
  const info = ruleInfo(hit.code);
  return {
    id: `${path}:${line}:${col}:${hit.code}`,
    path,
    code: hit.code,
    title: info.title,
    message: hit.message,
    line,
    col,
    endLine,
    endCol,
    severity: info.severity,
    category: info.category,
    monster: info.monster,
    snippet: extractSnippet(lines, line, endLine),
    tip: info.tip,
  };
}

// ──────────────────────── Monster selection ────────────────────────

/** A dungeon never holds more monsters than this. */
export const MAX_MONSTERS_PER_FILE = 10;
/** At most this many monsters per rule, so one sloppy habit can't fill a dungeon. */
export const MAX_MONSTERS_PER_RULE = 3;
/**
 * One Glitch King per file: after the first syntax error the parser is
 * confused, and later "errors" are usually echoes of the first.
 */
export const MAX_SYNTAX_MONSTERS = 1;

const SEVERITY_RANK: Record<Severity, number> = { boss: 0, elite: 1, minion: 2 };

function byLineThenColumn(a: Finding, b: Finding): number {
  return a.line - b.line || a.col - b.col;
}

/**
 * Picks which findings become monsters in a file's dungeon. First, findings
 * that describe the same problem are merged (see mergeSameProblem); then the
 * most severe win (boss > elite > minion, then top to bottom), respecting the
 * per-rule and per-file caps. `overflow` counts the findings that did not fit.
 */
export function selectMonsters(findings: readonly Finding[]): { findings: Finding[]; overflow: number } {
  const unique = mergeSameProblem(findings);
  const byPriority = unique.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || byLineThenColumn(a, b));
  const perRule = new Map<string, number>();
  const chosen: Finding[] = [];

  for (const finding of byPriority) {
    if (chosen.length >= MAX_MONSTERS_PER_FILE) break;
    const ruleLimit = finding.code === SYNTAX_CODE ? MAX_SYNTAX_MONSTERS : MAX_MONSTERS_PER_RULE;
    const used = perRule.get(finding.code) ?? 0;
    if (used >= ruleLimit) continue;
    perRule.set(finding.code, used + 1);
    chosen.push(finding);
  }

  return { findings: chosen.sort(byLineThenColumn), overflow: unique.length - chosen.length };
}

/**
 * Several rules often describe one problem on the same line: C901, PLR0913
 * and PLR0915 all point at the name of one big function, and E722 + S110 both
 * flag the same `except: pass`. Same line + same monster = one monster
 * (the first one Ruff reported). This also removes exact duplicates.
 */
function mergeSameProblem(findings: readonly Finding[]): Finding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = `${finding.line}:${finding.monster}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
