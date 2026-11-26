/**
 * Small helpers for showing text that comes from somebody's repo (names,
 * comments, docstrings, README lines, lines of code).
 *
 * Such text is untrusted: it can be empty, enormous, full of control
 * characters, emoji or CJK, or deliberately weird. Everything the game
 * shows from a repo goes through these helpers first, so one place decides
 * how it is tidied and how long it may get.
 */

/** Characters that never belong in shown text: control characters (incl. newlines and tabs) and invisible format marks. */
const INVISIBLE = /[\p{Cc}\p{Cf}\u2028\u2029]/gu;

/** Typographic punctuation and the plain-ASCII stand-in the bitmap font can draw. */
const ASCII_STAND_INS: readonly [RegExp, string][] = [
  [/[\u2018\u2019\u201B\u2032]/g, "'"],
  [/[\u201C\u201D\u201F\u2033]/g, '"'],
  [/[\u2013\u2014\u2212]/g, "-"],
  [/\u2026/g, "..."],
  [/\u00A0/g, " "],
];

/** Characters of languages written without spaces (Chinese, Japanese): each one counts as a word. */
const UNSPACED_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu;

/** How many letters (of any alphabet) the text has. */
export function letterCount(text: string): number {
  return text.match(/\p{L}/gu)?.length ?? 0;
}

/** How many real words the text has: space-separated words of two or more letters, plus CJK characters. */
export function wordCount(text: string): number {
  const spaced = text.split(" ").filter((word) => /\p{L}{2}/u.test(word)).length;
  return spaced + (text.match(UNSPACED_SCRIPT)?.length ?? 0);
}

/** Removes invisible characters and collapses all whitespace into single spaces. */
export function oneLine(text: string): string {
  return text.replace(INVISIBLE, " ").replace(/\s+/g, " ").trim();
}

/**
 * Clips `text` to at most `max` characters (counted by code point, so an
 * emoji is never cut in half), preferring to cut at a space, and adds "…".
 */
export function clipWords(text: string, max: number): string {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  const cut = chars.slice(0, Math.max(1, max - 1)).join("");
  const space = cut.lastIndexOf(" ");
  const kept = space > cut.length / 2 ? cut.slice(0, space) : cut;
  return `${kept.replace(/[\s,;:.–—-]+$/u, "")}…`;
}

/** Clips a file path from the left, keeping its end (the file name): "…/models/gpt/train.py". */
export function clipPath(path: string, max: number): string {
  const chars = Array.from(oneLine(path));
  return chars.length <= max ? chars.join("") : `…${chars.slice(chars.length - (max - 1)).join("")}`;
}

/**
 * The text in plain printable ASCII (what the canvas bitmap font can draw),
 * or null when it holds anything else (emoji, CJK, accents...). Curly
 * quotes, dashes and the ellipsis are first swapped for ASCII look-alikes.
 */
export function asciiOrNull(text: string): string | null {
  let plain = oneLine(text);
  for (const [pattern, replacement] of ASCII_STAND_INS) plain = plain.replace(pattern, replacement);
  return /^[\x20-\x7E]*$/.test(plain) ? plain : null;
}
