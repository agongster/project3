/**
 * The town's welcome: a repo's README reduced to a short, plain-text blurb
 * ("The simplest, fastest repository for training medium-sized GPTs.").
 *
 * A README is written for GitHub's renderer, so it is full of things that
 * mean nothing as plain text: badges, images, headings, tables, code blocks,
 * HTML, link syntax. `readmeBlurb` throws all of that away, finds the first
 * paragraph of real prose and keeps its first sentences, clipped to
 * MAX_README_BLURB characters. It understands enough Markdown and
 * reStructuredText for ordinary READMEs; anything odd only makes the blurb
 * shorter (or null), never throws.
 *
 * The text is the repo author's, so it is untrusted: callers render it only
 * as text.
 */
import { clipWords, letterCount, oneLine, wordCount } from "./repoText";

/** Longest blurb kept, in characters (it is spoken by the Town Square guide). */
export const MAX_README_BLURB = 160;
/** Only the start of a README is read: the welcome is always near the top, and huge files stay cheap. */
export const MAX_README_SCAN_CHARS = 10_000;
/**
 * A paragraph is cut to this length before its markup is removed. The blurb
 * needs far less, and it keeps the markup patterns fast on hostile input
 * (thousands of "[" or "<" in a row).
 */
const MAX_PARAGRAPH_CHARS = 2_000;
/** A paragraph needs at least this many letters… */
const MIN_BLURB_LETTERS = 24;
/** …and this many words to count as real prose (not a leftover badge or a lone title). */
const MIN_BLURB_WORDS = 4;
/** Lines indented this much (outside a list) are code blocks. */
const CODE_INDENT = 4;

const HTML_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
};

// ───────────────────────── Lines → paragraphs ─────────────────────────

/** A heading, horizontal rule or RST over/underline: "# Title", "=====", "-----", "~~~~~". */
function isRuleOrHeading(line: string): boolean {
  return /^#{1,6}(\s|$)/.test(line) || /^([=\-~^*#+_`])\1{2,}\s*$/.test(line.replace(/\s+/g, ""));
}

/** Lines that are never prose: tables, list items, RST directives and options, indented code. */
function isSkippedLine(raw: string, line: string): boolean {
  return (
    line.startsWith("|") ||
    /^([-*+]|\d+[.)])\s+/.test(line) ||
    line.startsWith(".. ") ||
    /^:[\w-]+:/.test(line) ||
    raw.replace(/\t/g, " ".repeat(CODE_INDENT)).startsWith(" ".repeat(CODE_INDENT))
  );
}

/**
 * Splits the README into paragraphs of raw text, leaving out code blocks,
 * headings (including setext/RST underlined ones), tables and lists.
 */
function paragraphs(text: string): string[] {
  const result: string[] = [];
  let current: string[] = [];
  let fence: string | null = null;
  const finish = () => {
    if (current.length > 0) result.push(current.join(" "));
    current = [];
  };

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const fenceMark = /^(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence !== null) {
      if (fenceMark && fenceMark[0] === fence[0]) fence = null;
      continue;
    }
    if (fenceMark) {
      finish();
      fence = fenceMark;
      continue;
    }
    if (isRuleOrHeading(line)) {
      // An underline turns the line above it into a heading: drop that line.
      if (current.length === 1 && /^[=\-~^]/.test(line)) current = [];
      finish();
      continue;
    }
    if (line === "" || isSkippedLine(raw, line)) {
      finish();
      continue;
    }
    current.push(line.replace(/^>\s?/, ""));
  }
  finish();
  return result;
}

// ───────────────────────── Markup → plain text ─────────────────────────

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d{1,6});/g, (_, code: string) => {
      const n = Number(code);
      return n >= 32 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
    })
    .replace(/&([a-z]+);/gi, (_, name: string) => HTML_ENTITIES[name.toLowerCase()] ?? "");
}

/** Removes inline Markdown, RST and HTML markup from one paragraph, keeping the words. */
export function plainText(markup: string): string {
  const text = markup
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images (and so badges)
    .replace(/!\[[^\]]*\]\[[^\]]*\]/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // [text](url) → text
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, "$1") // [text][ref] → text
    .replace(/`([^`<]*?)\s*<[^>]*>`_{1,2}/g, "$1") // RST `text <url>`_ → text
    .replace(/:[\w-]+:`([^`]*)`/g, "$1") // RST :role:`text` → text
    .replace(/<[^>]*>/g, " ") // HTML tags
    .replace(/https?:\/\/\S+/g, " ") // bare links
    .replace(/`+/g, "") // inline code marks
    .replace(/\*+|__/g, "") // bold / italic marks
    .replace(/:[a-z0-9_+-]+:/g, " "); // emoji shortcodes like :rocket:
  return oneLine(decodeEntities(text).replace(/\[\s*\]|\(\s*\)/g, " ")); // also drops brackets left empty above
}

function isProse(text: string): boolean {
  return letterCount(text) >= MIN_BLURB_LETTERS && wordCount(text) >= MIN_BLURB_WORDS;
}

// ───────────────────────── Sentences ─────────────────────────

/**
 * Sentences end with . ! or ? followed by a space or the end of the text
 * (so "Python 3.10" or "v2.0" is not a sentence end).
 */
const SENTENCE = /.+?[.!?]+["')\]]*(?=\s|$)|.+$/g;

/** The first whole sentences of `text` that fit in `max` characters (at least one, clipped if it is too long). */
function firstSentences(text: string, max: number): string {
  let blurb = "";
  for (const sentence of text.match(SENTENCE) ?? []) {
    const next = `${blurb} ${sentence.trim()}`.trim();
    if (Array.from(next).length > max) break;
    blurb = next;
  }
  return blurb || clipWords(text, max);
}

/**
 * A README as a short plain-text blurb: the first sentences of the first
 * real paragraph, at most `max` characters. Null when there is no prose at all.
 */
export function readmeBlurb(readme: string, max: number = MAX_README_BLURB): string | null {
  if (typeof readme !== "string") return null;
  const text = readme.slice(0, MAX_README_SCAN_CHARS).replace(/\r\n?/g, "\n").replace(/<!--[\s\S]*?-->/g, "\n");
  for (const paragraph of paragraphs(text)) {
    const plain = plainText(paragraph.slice(0, MAX_PARAGRAPH_CHARS));
    if (isProse(plain)) return firstSentences(plain, max);
  }
  return null;
}
