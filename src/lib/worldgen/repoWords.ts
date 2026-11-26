/**
 * The repo's own words, picked for villagers to say.
 *
 * Villagers who live in a region are "from" that code: they are named after
 * its classes and functions (`OrderBook` → "Order Book") and quote its real
 * comments and docstrings, with where each one came from. This file holds
 * the decisions (what counts as a quotable comment, how a name is made
 * readable, which ones are picked); villagers.ts puts them into sentences.
 *
 * Everything here is pure and deterministic, and treats the outline as
 * untrusted text: any of it may be empty, enormous or odd.
 */
import { asciiOrNull, clipPath, clipWords, letterCount, oneLine, wordCount } from "@/lib/analysis/repoText";
import type { AnalyzedFile, Definition } from "@/lib/types";

/** Villager names longer than this are skipped (they must fit the dialog's name tab and "Talk to …"). */
export const MAX_VILLAGER_NAME = 18;
/** …and shorter ones too ("F", "Go" are not names). */
const MIN_VILLAGER_NAME = 3;
/** A quote in the dialog box is clipped to this many characters. */
export const MAX_QUOTE_LENGTH = 110;
/** Only comments this short may pop up in a speech bubble (two short lines over a head). */
export const MAX_BUBBLE_LENGTH = 56;
/** Attributions name the file; very deep paths are clipped from the left to this length. */
const MAX_ATTRIBUTION_PATH = 44;
/** A quote needs at least this many words of two or more letters… */
const MIN_QUOTE_WORDS = 3;
/** …and this many letters, so "# ----" or "# x=1" never become quotes. */
const MIN_QUOTE_LETTERS = 10;
/** Comments with more than this share of code punctuation are code, not prose. */
const MAX_SYMBOL_SHARE = 0.2;

/**
 * Between a quote and its attribution in a dialog line. The dialog box
 * splits the line here and shows the attribution in small type.
 */
export const ATTRIBUTION_SEPARATOR = "\n";

/** Real words a villager can say, and where they come from. */
export interface Quote {
  /** The comment or docstring, tidied into one line (not clipped yet). */
  text: string;
  path: string;
  /** Line of a comment; null for a docstring (attributed to its definition instead). */
  line: number | null;
  /** "describe()" for the docstring of `describe`, MODULE_TOP for the file's own docstring, null for a comment. */
  owner: string | null;
}

/** The `owner` of a module docstring: it is quoted "from the top of" its file. */
const MODULE_TOP = "the top";

// ───────────────────────── Is it worth quoting? ─────────────────────────

/** Comments that are licence or copyright boilerplate. */
const LICENSE = /copyright|licen[cs]e|spdx|all rights reserved|warrant|permission is hereby|redistribut|gnu general|apache/i;
/** Comments that are really switched-off code: imports, definitions, assignments, calls, control flow. */
const CODE_PATTERNS: readonly RegExp[] = [
  /^(?:import|from)\s+[\w.]+(?:\s+import\b|\s*$)/, // import os / from a import b
  /^(?:def|class|async def)\s+\w+/, // def f(x):
  /^(?:if|elif|else|for|while|with|try|except|finally)\b.*:$/, // for x in y:
  /^(?:return|print|raise|assert|yield|del)\b.*[()[\]=]/, // return f(x) / print(x)
  /^[\w.[\]"']+\s*(?:[+\-*/%|&^]|\/\/)?=\s*\S/, // x = 1 / scaled["sugar"] = ... / n += 1
  /[!=<>]=|->|;\s*$/, // comparisons, arrows, statement ends
  /\w\([^()]*\)\s*$/, // ends with a call: foo(bar)
  /^[\w.]+$/, // one bare token: self.cache, os.path.join
];

/** True when the text looks like commented-out code rather than words for people. */
export function looksLikeCode(text: string): boolean {
  if (CODE_PATTERNS.some((pattern) => pattern.test(text))) return true;
  const symbols = text.match(/[=()[\]{}<>;:"'`@$\\|]/g)?.length ?? 0;
  return symbols / Math.max(1, text.length) > MAX_SYMBOL_SHARE;
}

/** Removes comment decoration: leading "#", "!", "*", dashes or "=" bars, and trailing bars. */
export function tidyComment(raw: string): string {
  return oneLine(raw)
    .replace(/^[#!*\s=~-]+/, "")
    .replace(/[\s#*=~-]{2,}$/, "")
    .trim();
}

/** True for tidied text that is real, readable prose for people (not code, not boilerplate, not noise). */
export function isQuotable(text: string): boolean {
  return (
    wordCount(text) >= MIN_QUOTE_WORDS &&
    letterCount(text) >= MIN_QUOTE_LETTERS &&
    !LICENSE.test(text) &&
    !/https?:\/\//.test(text) &&
    !looksLikeCode(text)
  );
}

// ───────────────────────── Quotes from files ─────────────────────────

/** How a definition is written in an attribution: "describe()", "Trainer.fit()" or "Pastry". */
export function definitionLabel(definition: Pick<Definition, "name" | "kind">, max = MAX_VILLAGER_NAME * 2): string {
  const name = clipWords(oneLine(definition.name), max);
  return definition.kind === "class" ? name : `${name}()`;
}

/** Every quotable comment and docstring of one file, in line order (docstrings sit at their definition's line). */
export function fileQuotes(file: AnalyzedFile): Quote[] {
  if (file.status !== "ok") return [];
  const { outline, path } = file;
  const found: { at: number; quote: Quote }[] = [];
  const add = (raw: string | null, at: number, line: number | null, owner: string | null) => {
    const text = raw === null ? "" : tidyComment(raw);
    if (isQuotable(text)) found.push({ at, quote: { text, path, line, owner } });
  };
  add(outline.moduleDocstring, 0, null, MODULE_TOP);
  for (const definition of outline.definitions) add(definition.docstring, definition.line, null, definitionLabel(definition));
  for (const comment of outline.comments) add(comment.text, comment.line, comment.line, null);
  return found.sort((a, b) => a.at - b.at).map((entry) => entry.quote);
}

/** "# from bakery/oven.py, line 12", "# from describe() in bakery/oven.py" or "# from the top of bakery/oven.py". */
export function attribution(quote: Quote): string {
  const path = clipPath(quote.path, MAX_ATTRIBUTION_PATH);
  if (quote.line !== null) return `# from ${path}, line ${quote.line}`;
  return quote.owner === MODULE_TOP ? `# from the top of ${path}` : `# from ${quote.owner} in ${path}`;
}

/** A dialog line: the quote in curly quotes, then the attribution after ATTRIBUTION_SEPARATOR. */
export function quoteLine(quote: Quote): string {
  return `“${clipWords(quote.text, MAX_QUOTE_LENGTH)}”${ATTRIBUTION_SEPARATOR}${attribution(quote)}`;
}

/** The quote as a speech bubble, or null when it is too long or holds characters the bitmap font lacks. */
export function bubbleText(text: string): string | null {
  const ascii = asciiOrNull(text);
  return ascii !== null && ascii.length > 0 && ascii.length <= MAX_BUBBLE_LENGTH ? ascii : null;
}

// ───────────────────────── Names from code ─────────────────────────

/** "OrderBook" → ["Order", "Book"], "HTTPServer" → ["HTTP", "Server"], "getX" → ["get", "X"]. */
function splitCamel(word: string): string[] {
  return word
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(" ");
}

/**
 * An identifier as a villager's name: `OrderBook` → "Order Book",
 * `load_data` → "Load Data", `Trainer.fit` → "Fit". Null when it does not
 * make a good name: dunder methods, single letters, anything longer than
 * MAX_VILLAGER_NAME or not plain ASCII letters and digits.
 */
export function readableName(identifier: string): string | null {
  const last = identifier.split(".").pop() ?? "";
  if (/^__\w*__$/.test(last)) return null;
  const words = last
    .split(/_+/)
    .flatMap(splitCamel)
    .filter((word) => word !== "");
  if (words[0]?.toLowerCase() === "test") words.shift(); // test_scaling → "Scaling"
  const name = words.map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
  const fits = name.length >= MIN_VILLAGER_NAME && name.length <= MAX_VILLAGER_NAME;
  return fits && /^[A-Za-z][A-Za-z0-9 ]*$/.test(name) ? name : null;
}

/** A name taken from the code, and the definition it came from. */
export interface CodeName {
  name: string;
  definition: Definition;
  path: string;
}

/** Classes make the best names, then functions, then methods. */
const KIND_RANK: Readonly<Record<Definition["kind"], number>> = { class: 0, function: 1, method: 2 };

/**
 * Up to `count` distinct villager names from the definitions in `files`,
 * best first: classes before functions before methods, documented before
 * undocumented, longer bodies before shorter ones, then path and line
 * order. Names already in `taken` are skipped (and the picked ones added).
 */
export function codeNames(files: readonly AnalyzedFile[], count: number, taken: Set<string>): CodeName[] {
  const candidates = files
    .filter((file) => file.status === "ok")
    .flatMap((file) => file.outline.definitions.map((definition) => ({ definition, path: file.path })));
  candidates.sort(
    (a, b) =>
      KIND_RANK[a.definition.kind] - KIND_RANK[b.definition.kind] ||
      Number(b.definition.docstring !== null) - Number(a.definition.docstring !== null) ||
      b.definition.endLine - b.definition.line - (a.definition.endLine - a.definition.line) ||
      (a.path < b.path ? -1 : a.path > b.path ? 1 : 0) ||
      a.definition.line - b.definition.line,
  );
  const picked: CodeName[] = [];
  for (const { definition, path } of candidates) {
    if (picked.length >= count) break;
    const name = readableName(definition.name);
    if (name === null || taken.has(name)) continue;
    taken.add(name);
    picked.push({ name, definition, path });
  }
  return picked;
}
