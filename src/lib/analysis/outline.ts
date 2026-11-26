/**
 * A light "outline" of one Python file: which functions and classes it
 * defines, how branchy and how documented each one is, which comments it
 * holds and what it imports. The game uses it to make a world look like the
 * code it came from (rooms named after functions, villagers quoting
 * comments, merchants named after imported packages…).
 *
 * This is NOT a real Python parser. It reads the file line by line and
 * understands just enough to be right on ordinary code:
 *   - indentation tells where a `def` / `class` body ends
 *   - string literals (including triple-quoted ones) and `#` comments are
 *     skipped, so a "def" inside a string is not mistaken for code
 *   - open brackets carry over to the next line, so the `):` that closes a
 *     long parameter list does not look like the end of the function
 * Odd code (a syntax error, tabs mixed with spaces) only makes the outline
 * less precise; it never throws.
 */

/** Tabs count as this many columns when measuring indentation. */
const TAB_WIDTH = 4;
/** Longest docstring / comment text kept (the rest is cut with an ellipsis). */
export const MAX_OUTLINE_TEXT = 120;
/** At most this many comments are kept per file (the first ones). */
export const MAX_OUTLINE_COMMENTS = 60;
/** Comments shorter than this are noise ("# ---", "# ok"). */
const MIN_COMMENT_LENGTH = 4;

/** One function, method or class. */
export interface Definition {
  /** "load_data", or "Trainer.fit" for a method. */
  name: string;
  kind: "function" | "method" | "class";
  /** 1-based line of the `def` / `class` keyword. */
  line: number;
  /** 1-based last line of the body (inclusive). */
  endLine: number;
  /**
   * How many branching statements the body has (`if`, `elif`, `for`,
   * `while`, `except`, `case`). 0 = straight-line code. Always 0 for a class:
   * its methods carry their own counts.
   */
  branches: number;
  /** The first line of the docstring, or null if there is none. */
  docstring: string | null;
}

export interface OutlineComment {
  /** 1-based line number. */
  line: number;
  /** The comment without its `#`. */
  text: string;
}

export interface FileOutline {
  /** Top-level functions and classes, plus the methods of those classes, in line order. */
  definitions: Definition[];
  /** Comments that stand on their own line (tool directives such as `# noqa` are left out). */
  comments: OutlineComment[];
  /** Top-level names of imported modules, e.g. ["os", "numpy"]. No repeats, no relative imports. */
  imports: string[];
  /** The first line of the file's own docstring, or null. */
  moduleDocstring: string | null;
}

/** The outline of a file that could not be read. */
export function emptyOutline(): FileOutline {
  return { definitions: [], comments: [], imports: [], moduleDocstring: null };
}

// ───────────────────────── Reading lines ─────────────────────────

/** What the scanner knows about one physical line. */
interface ScannedLine {
  /** 1-based line number. */
  n: number;
  /** The line without indentation, strings' contents or its trailing comment. */
  code: string;
  /** Columns of indentation. */
  indent: number;
  /** The text of a comment on this line (without `#`), or null. */
  comment: string | null;
  /** True if the line starts inside a string or inside open brackets from an earlier line. */
  continuation: boolean;
  /** True if the first thing on the line is a string literal (a docstring candidate). */
  startsWithString: boolean;
  /** The text of that leading string literal that is on this line. */
  stringText: string;
  /** True if a triple-quoted string is still open when the line ends. */
  endsInsideString: boolean;
  /** The whole line, trimmed (used to read a docstring that continues on later lines). */
  text: string;
}

/** Scanner state that carries over from one line to the next. */
interface ScanState {
  /** The triple quote we are inside (`"""` or `'''`), or null. */
  openTriple: string | null;
  /** How many brackets are open. */
  depth: number;
}

function indentOf(line: string): number {
  let columns = 0;
  for (const ch of line) {
    if (ch === " ") columns += 1;
    else if (ch === "\t") columns += TAB_WIDTH;
    else break;
  }
  return columns;
}

/** Where a string literal starting at `i` begins (after any r/b/f/u prefix), or -1. */
function quoteStart(text: string, i: number): number {
  let j = i;
  while (j < text.length && j - i < 2 && /[rbfuRBFU]/.test(text[j])) j++;
  return text[j] === '"' || text[j] === "'" ? j : -1;
}

/**
 * Scans one line: removes string contents and the comment, and keeps track
 * of open brackets and open triple-quoted strings in `state`.
 */
function scanLine(raw: string, n: number, state: ScanState): ScannedLine {
  const continuation = state.openTriple !== null || state.depth > 0;
  const trimmed = raw.trimStart();
  const leadingQuote = continuation ? -1 : quoteStart(trimmed, 0);
  /** True while the characters being read belong to the string literal the line starts with. */
  let readingLeadingString = false;
  let stringText = "";
  let code = "";
  let comment: string | null = null;
  let i = 0;

  while (i < trimmed.length) {
    if (state.openTriple !== null) {
      const end = trimmed.indexOf(state.openTriple, i);
      if (end === -1) {
        if (readingLeadingString) stringText += trimmed.slice(i);
        i = trimmed.length;
      } else {
        if (readingLeadingString) stringText += trimmed.slice(i, end);
        readingLeadingString = false;
        i = end + 3;
        state.openTriple = null;
      }
      continue;
    }
    const ch = trimmed[i];
    if (ch === "#") {
      comment = trimmed.slice(i + 1).trim();
      break;
    }
    const quoteAt = /["'rbfuRBFU]/.test(ch) && (i === 0 || !/\w/.test(trimmed[i - 1])) ? quoteStart(trimmed, i) : -1;
    if (quoteAt !== -1) {
      const quote = trimmed[quoteAt];
      if (trimmed.startsWith(quote.repeat(3), quoteAt)) {
        state.openTriple = quote.repeat(3);
        readingLeadingString = leadingQuote === quoteAt && code === "";
        code += '""'; // the string counts as code on the line where it starts
        i = quoteAt + 3;
        continue;
      }
      // A one-line string: skip to its closing quote (a backslash escapes the next character).
      let j = quoteAt + 1;
      while (j < trimmed.length && trimmed[j] !== quote) j += trimmed[j] === "\\" ? 2 : 1;
      if (leadingQuote === quoteAt && code === "") stringText = trimmed.slice(quoteAt + 1, j);
      code += '""';
      i = j + 1;
      continue;
    }
    if ("([{".includes(ch)) state.depth++;
    else if (")]}".includes(ch)) state.depth = Math.max(0, state.depth - 1);
    code += ch;
    i++;
  }

  return {
    n,
    code: code.trim(),
    indent: indentOf(raw),
    comment,
    continuation,
    startsWithString: leadingQuote !== -1,
    stringText,
    endsInsideString: state.openTriple !== null,
    text: trimmed.trim(),
  };
}

function scanSource(source: string): ScannedLine[] {
  const state: ScanState = { openTriple: null, depth: 0 };
  return source.split(/\r\n|\r|\n/).map((raw, index) => scanLine(raw, index + 1, state));
}

// ───────────────────────── Small helpers ─────────────────────────

function clip(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length <= MAX_OUTLINE_TEXT ? oneLine : `${oneLine.slice(0, MAX_OUTLINE_TEXT - 1)}…`;
}

const DEFINITION = /^(?:async\s+)?(def|class)\s+([A-Za-z_]\w*)/;
const BRANCH = /^(?:if|elif|while|for|async\s+for|except|case)\b/;
/** Comments written for tools, not for people. */
const TOOL_COMMENT = /^(?:!|-\*-|noqa|type:|pylint:|fmt:|pragma:|isort:|ruff:|mypy:|pyright:|nosec)/i;

function isReadableComment(line: ScannedLine): boolean {
  if (line.comment === null || line.code !== "" || line.continuation) return false;
  if (TOOL_COMMENT.test(line.comment)) return false;
  // Needs some real words: skips "# -----" dividers and commented-out symbols.
  return line.comment.length >= MIN_COMMENT_LENGTH && /[A-Za-z]{3}/.test(line.comment);
}

/** "import a.b, c as d" → ["a", "c"]; "from a.b import x" → ["a"]; relative imports → []. */
function importedModules(code: string): string[] {
  const from = /^from\s+([A-Za-z_]\w*)[\w.]*\s+import\b/.exec(code);
  if (from) return [from[1]];
  const plain = /^import\s+(.+)$/.exec(code);
  if (!plain) return [];
  return plain[1]
    .split(",")
    .map((part) => /^\s*([A-Za-z_]\w*)/.exec(part)?.[1])
    .filter((name): name is string => name !== undefined);
}

// ───────────────────────── The outline ─────────────────────────

/** A definition whose body we are still inside. */
interface OpenDefinition {
  definition: Definition;
  indent: number;
  /** Nested functions are tracked (to find where they end) but not listed. */
  listed: boolean;
  /** True until the first statement of the body has been seen (a docstring must be that statement). */
  awaitingBody: boolean;
}

/** Builds the outline of one Python source file. Never throws. */
export function outlineSource(source: string): FileOutline {
  const outline = emptyOutline();
  const imports = new Set<string>();
  const open: OpenDefinition[] = [];
  let lastCodeLine = 0;
  let seenFirstStatement = false;
  /**
   * Set when a docstring opened with nothing after its quotes (the summary is
   * on the next line): called with the first non-empty line of its text.
   */
  let fillDocstring: ((text: string) => void) | null = null;

  for (const line of scanSource(source)) {
    if (isReadableComment(line) && outline.comments.length < MAX_OUTLINE_COMMENTS) {
      outline.comments.push({ line: line.n, text: clip(line.comment ?? "") });
    }
    if (line.continuation) {
      const words = line.text.replace(/("""|''')[\s\S]*$/, "").trim();
      if (fillDocstring && words !== "") {
        fillDocstring(clip(words));
        fillDocstring = null;
      }
      if (!line.endsInsideString) fillDocstring = null;
      if (line.code !== "" || line.text !== "") lastCodeLine = line.n;
      continue;
    }
    if (line.code === "") continue; // blank or comment-only

    // A line indented no deeper than a definition ends that definition.
    while (open.length > 0 && line.indent <= open[open.length - 1].indent) {
      const closed = open.pop() as OpenDefinition;
      closed.definition.endLine = lastCodeLine;
    }

    const innermost = open[open.length - 1];
    if (innermost?.awaitingBody) {
      innermost.awaitingBody = false;
      if (line.startsWithString) {
        const definition = innermost.definition;
        definition.docstring = clip(line.stringText) || null;
        if (definition.docstring === null && line.endsInsideString) fillDocstring = (text) => (definition.docstring = text);
      }
    }
    if (!seenFirstStatement) {
      seenFirstStatement = true;
      if (line.startsWithString) {
        outline.moduleDocstring = clip(line.stringText) || null;
        if (outline.moduleDocstring === null && line.endsInsideString) fillDocstring = (text) => (outline.moduleDocstring = text);
      }
    }

    const match = DEFINITION.exec(line.code);
    if (match) {
      const isClass = match[1] === "class";
      const parent = innermost?.definition;
      const insideClass = parent?.kind === "class";
      const definition: Definition = {
        name: insideClass && !isClass ? `${parent.name}.${match[2]}` : match[2],
        kind: isClass ? "class" : insideClass ? "method" : "function",
        line: line.n,
        endLine: line.n,
        branches: 0,
        docstring: null,
      };
      // Listed: anything at the top level, and methods directly inside a top-level class.
      const listed = open.length === 0 || (open.length === 1 && insideClass && !isClass);
      if (listed) outline.definitions.push(definition);
      open.push({ definition, indent: line.indent, listed, awaitingBody: true });
    } else if (BRANCH.test(line.code)) {
      // The branch belongs to the nearest listed function around it.
      const owner = [...open].reverse().find((entry) => entry.listed && entry.definition.kind !== "class");
      if (owner) owner.definition.branches++;
    } else if (open.length === 0) {
      for (const name of importedModules(line.code)) imports.add(name);
    }
    lastCodeLine = line.n;
  }

  for (const entry of open) entry.definition.endLine = lastCodeLine;
  outline.imports = [...imports];
  return outline;
}

/** The innermost listed definition that contains `line` (1-based), or null for module-level code. */
export function definitionAt(outline: FileOutline, line: number): Definition | null {
  let best: Definition | null = null;
  for (const definition of outline.definitions) {
    if (definition.kind === "class") continue;
    if (line >= definition.line && line <= definition.endLine && (!best || definition.line > best.line)) best = definition;
  }
  if (best) return best;
  // Fall back to a class body (e.g. a class-level assignment).
  return outline.definitions.find((d) => d.kind === "class" && line >= d.line && line <= d.endLine) ?? null;
}
