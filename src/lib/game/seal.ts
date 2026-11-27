/**
 * SEALS, which the player sees as the "Ignore this bug" button and the
 * word "ignored" (the code keeps the shorter word seal).
 *
 * Nobody gets stuck (SPEC.md F1). Any finding but a syntax
 * error can be dealt with in one click by marking its line as accepted with
 * Ruff's own suppression comment:
 *
 *     password = "hunter2"  # noqa: S105
 *
 * Ruff then no longer reports it, so the bug is gone from the code: it
 * counts as dealt with (health, purifying, victory) but it is SEALED, not
 * fixed, and pays no fix reward. Two pure jobs live here:
 *
 *   planSeal(text, finding, line)   the one edit "Ignore this bug" makes
 *   splitSealed(gone, text)         after a save: which of the findings
 *                                   gone from the code were sealed, and
 *                                   which were really fixed
 *
 * WHERE the comment goes follows Ruff's rule: on the line where the
 * finding starts, except that a finding starting inside a multi-line string
 * or a backslash-continued line is silenced at the LAST line of that string
 * or continuation (a comment after a trailing backslash would even be a
 * syntax error). `scanLines` finds those spans with a small line scanner
 * that only knows strings, comments and backslashes (not full Python).
 */
import { SYNTAX_CODE } from "@/lib/analysis/rules";
import type { Finding } from "@/lib/types";
import type { ForgeReport, TextEdit } from "@/lib/workspace/contract";

/** PEP 8 puts two spaces before an inline comment. */
const COMMENT_GAP = "  ";
/** Ruff's suppression directive in a comment: "# noqa" alone, or "# noqa: F401, E722". */
const NOQA_DIRECTIVE = /#\s*noqa(?::\s*([A-Za-z]+[0-9]+(?:[\s,]+[A-Za-z]+[0-9]+)*))?/i;
/** Everything from a noqa directive to the end of the line (to compare lines with and without one). */
const NOQA_TAIL = /#\s*noqa\b.*$/i;
const RULE_CODE = /[A-Za-z]+[0-9]+/g;

/** The comment a seal scroll writes for a rule ("# noqa: F401"). */
export function sealComment(code: string): string {
  return `# noqa: ${code}`;
}

/** What the seal scroll would do: one edit, or why it can't. */
export type SealPlan = { ok: true; edit: TextEdit; line: number } | { ok: false; reason: string };

export const CANT_SEAL_SYNTAX = "A syntax error can't be ignored: Python can't read the file at all, so it has to be fixed by hand.";
export const ALREADY_SEALED = "This line already has a # noqa for this rule. Save to make it count.";
const CANT_SEAL_HERE = "This line can't take a # noqa comment. Fix it by hand instead.";
/** Shown while the live check is still catching up with the typing. */
export const CANT_SEAL_STALE = "Checking the code… Ignore is ready in a moment.";

// ───────────────────────────── Scanning lines ─────────────────────────────

/** What the scanner learned about one physical line. */
export interface ScannedLine {
  /** Index of the `#` that starts a comment on this line, or null. */
  commentAt: number | null;
  /** 0-based index of the line where a noqa comment for a finding starting here must go. */
  noqaLine: number;
}

/** The string literal the scanner is inside, if any. */
interface OpenString {
  quote: string;
  triple: boolean;
}

/**
 * Reads one line, starting inside `inString` when an earlier line left a
 * string open; returns where its comment starts, the string still open at
 * its end, and whether a trailing backslash joins it to the next line.
 */
function scanLine(text: string, inString: OpenString | null): { commentAt: number | null; open: OpenString | null; continued: boolean } {
  let open = inString;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (open) {
      if (ch === "\\") i += 2;
      else if (open.triple && text.startsWith(open.quote.repeat(3), i)) {
        open = null;
        i += 3;
      } else {
        if (!open.triple && ch === open.quote) open = null;
        i++;
      }
      continue;
    }
    if (ch === "#") return { commentAt: i, open: null, continued: false };
    if (ch === '"' || ch === "'") {
      const triple = text.startsWith(ch.repeat(3), i);
      open = { quote: ch, triple };
      i += triple ? 3 : 1;
      continue;
    }
    i++;
  }
  // A one-quote string only goes on to the next line after a backslash; otherwise it was never closed.
  const continuesString = open !== null && (open.triple || text.endsWith("\\"));
  const continued = open === null && text.endsWith("\\");
  return { commentAt: null, open: continuesString ? open : null, continued };
}

/**
 * Scans a whole text: for every line, where its comment starts and on which
 * line a noqa comment for it must go. Lines joined by a multi-line string or
 * a trailing backslash form one run; every line of a run maps to its last line.
 */
export function scanLines(lines: readonly string[]): ScannedLine[] {
  const scanned: ScannedLine[] = [];
  let open: OpenString | null = null;
  let runStart = 0;
  lines.forEach((line, index) => {
    const result = scanLine(stripCarriageReturn(line), open);
    open = result.open;
    scanned.push({ commentAt: result.commentAt, noqaLine: index });
    const runGoesOn = open !== null || result.continued;
    if (runGoesOn && index < lines.length - 1) return;
    for (let k = runStart; k <= index; k++) scanned[k].noqaLine = index;
    runStart = index + 1;
  });
  return scanned;
}

function stripCarriageReturn(line: string): string {
  return line.endsWith("\r") ? line.slice(0, -1) : line;
}

// ───────────────────────────── Planning a seal ─────────────────────────────

/** The codes a noqa directive names, upper-cased; null for a bare "# noqa" (which silences everything). */
function directiveCodes(match: RegExpExecArray): string[] | null {
  const list = match[1];
  return list === undefined ? null : (list.match(RULE_CODE) ?? []).map((code) => code.toUpperCase());
}

/**
 * The seal scroll's edit for `finding`, whose diagnostic starts on the
 * 1-based `line` of `text`: a new `  # noqa: CODE` at the end of the right
 * line, or the code added to a noqa comment that is already there.
 */
export function planSeal(text: string, finding: Pick<Finding, "code">, line: number): SealPlan {
  if (finding.code === SYNTAX_CODE) return { ok: false, reason: CANT_SEAL_SYNTAX };
  const lines = text.split("\n");
  const scanned = scanLines(lines);
  const at = scanned[line - 1]?.noqaLine;
  if (at === undefined) return { ok: false, reason: CANT_SEAL_HERE };
  const target = stripCarriageReturn(lines[at]);
  const { commentAt } = scanned[at];
  const code = finding.code.toUpperCase();

  const directive = commentAt === null ? null : NOQA_DIRECTIVE.exec(target.slice(commentAt));
  if (directive && commentAt !== null) {
    const codes = directiveCodes(directive);
    if (codes === null || codes.includes(code)) return { ok: false, reason: ALREADY_SEALED };
    // Right after the last code already listed: "# noqa: E501" → "# noqa: E501, F401".
    const col = commentAt + directive.index + directive[0].length + 1;
    return { ok: true, line: at + 1, edit: { line: at + 1, col, endLine: at + 1, endCol: col, text: `, ${code}` } };
  }
  if (commentAt === null && target.trimEnd().endsWith("\\")) return { ok: false, reason: CANT_SEAL_HERE };
  // Trailing spaces are replaced, so the comment sits exactly two spaces after the code.
  const contentEnd = target.trimEnd().length;
  const gap = contentEnd === 0 ? "" : COMMENT_GAP;
  return {
    ok: true,
    line: at + 1,
    edit: { line: at + 1, col: contentEnd + 1, endLine: at + 1, endCol: target.length + 1, text: `${gap}${sealComment(code)}` },
  };
}

// ───────────────────────────── After a forge ─────────────────────────────

/** A line for comparing: without its noqa comment and without any whitespace. */
function comparable(line: string): string {
  return line.replace(NOQA_TAIL, "").replace(/\s+/g, "");
}

/** The finding's own line of code as it was, from its snippet ("" when the snippet lacks it). */
function offendingText(finding: Finding): string {
  return comparable(finding.snippet.find((snippetLine) => snippetLine.n === finding.line)?.text ?? "");
}

/** Every noqa comment in `text`: the codes it silences (null = all) and the lines of code it covers, made comparable. */
function sealsIn(text: string): { codes: string[] | null; covers: Set<string> }[] {
  const lines = text.split("\n");
  const scanned = scanLines(lines);
  const seals: { codes: string[] | null; covers: Set<string> }[] = [];
  scanned.forEach(({ commentAt }, index) => {
    if (commentAt === null || scanned[index].noqaLine !== index) return;
    const directive = NOQA_DIRECTIVE.exec(stripCarriageReturn(lines[index]).slice(commentAt));
    if (!directive) return;
    const covers = new Set<string>();
    for (let k = index; k >= 0 && scanned[k].noqaLine === index; k--) covers.add(comparable(lines[k]));
    seals.push({ codes: directiveCodes(directive), covers });
  });
  return seals;
}

/**
 * Splits findings that are gone from the code into the really fixed and the
 * sealed ones. A finding counts as sealed when `text` still holds its line
 * of code unchanged (spacing aside) under a noqa comment that names its rule
 * (or names none). Rewriting the line in any other way is a real fix.
 * Order is kept in both lists. Pure.
 */
export function splitSealed(gone: readonly Finding[], text: string): { fixed: Finding[]; sealed: Finding[] } {
  const seals = gone.length === 0 ? [] : sealsIn(text);
  const fixed: Finding[] = [];
  const sealed: Finding[] = [];
  for (const finding of gone) {
    const line = offendingText(finding);
    const code = finding.code.toUpperCase();
    const isSealed = line !== "" && seals.some((seal) => (seal.codes === null || seal.codes.includes(code)) && seal.covers.has(line));
    (isSealed ? sealed : fixed).push(finding);
  }
  return { fixed, sealed };
}

/**
 * Everything a forge sealed, worked out from the forged `text`:
 *   - `fixed` / `sealed`: the findings this forge took out of the code
 *     (`report.fixed`, ids of the version before it), split;
 *   - `sealedOriginalIds`: which of the file's ORIGINAL findings gone from
 *     the code (`report.file.fixedFindings`) are sealed, for applyForge.
 */
export interface ForgeSeals {
  fixed: Finding[];
  sealed: Finding[];
  sealedOriginalIds: string[];
}

export function forgeSeals(report: ForgeReport, text: string): ForgeSeals {
  if (!report.linted) return { fixed: [], sealed: [], sealedOriginalIds: [] };
  const { fixed, sealed } = splitSealed(report.fixed, text);
  const original = splitSealed(report.file?.fixedFindings ?? [], text).sealed;
  return { fixed, sealed, sealedOriginalIds: original.map((finding) => finding.id) };
}

/** The report as the streak and the quests should see it: only real fixes in `fixed`. */
export function realFixesOnly(report: ForgeReport, seals: Pick<ForgeSeals, "fixed">): ForgeReport {
  return seals.fixed.length === report.fixed.length ? report : { ...report, fixed: seals.fixed };
}
