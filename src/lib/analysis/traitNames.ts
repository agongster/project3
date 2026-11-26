/**
 * Names pulled out of a finding for its monster's trait: the undefined name
 * a Phantom's rune spells, the import a Dust Bunny leaves behind, the
 * builtin a Mimic pretends to be, the note a Todo Mite squeaks...
 *
 * Everything here reads UNTRUSTED text (Ruff's message quotes the repo's
 * own names, the snippet is the repo's own code), so each helper:
 *   - looks for the name in a fixed, simple place (`backticks` first),
 *   - falls back to something sensible when it is not there,
 *   - and returns plain printable ASCII clipped to a named maximum, so it
 *     can be drawn with the bitmap font and never breaks a layout.
 *
 * Pure functions, unit-tested in tests/analysis/traitNames.test.ts.
 */
import type { Finding } from "@/lib/types";
import { oneLine } from "./repoText";

/** Longest name shown on a rune, a tag or a label (characters). */
export const MAX_TRAIT_NAME_CHARS = 18;
/** Longest note a Todo Mite squeaks (characters). */
export const MAX_NOTE_CHARS = 30;
/** Ends a clipped name. The bitmap font draws it as one 5-px glyph. */
const ELLIPSIS = "…";
/** Stands in for any character outside printable ASCII. */
const UNKNOWN_CHAR = "?";
/** What a Phantom's rune reads when Ruff's message names nothing. */
export const UNKNOWN_NAME = "???";
/** Comment markers a Todo Mite's note starts at (Ruff's FIX rules look for the same words). */
const NOTE_MARKERS = /\b(TODO|FIXME|XXX|HACK)\b/i;

type MessageOnly = Pick<Finding, "message">;
type WithSnippet = Pick<Finding, "message" | "snippet">;

/**
 * Printable ASCII only (anything else becomes "?"), whitespace collapsed,
 * at most `max` characters with "…" at the end when cut. "" stays "".
 */
export function clipName(text: string, max = MAX_TRAIT_NAME_CHARS): string {
  let plain = "";
  for (const ch of oneLine(text)) plain += /^[\x20-\x7E]$/.test(ch) ? ch : UNKNOWN_CHAR;
  if (plain.length <= max) return plain;
  return plain.slice(0, Math.max(0, max - 1)).trimEnd() + ELLIPSIS;
}

/** Every `backtick-quoted` part of a message, in order (empty ones skipped). */
export function backtickNames(message: string): string[] {
  return [...message.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim()).filter((name) => name.length > 0);
}

/** Every "double-quoted" part of a message, in order (Bandit quotes names this way). */
export function quotedNames(message: string): string[] {
  return [...message.matchAll(/"([^"]+)"/g)].map((m) => m[1].trim()).filter((name) => name.length > 0);
}

/** The first name Ruff's message quotes (backticks, then double quotes), clipped; null when it quotes none. */
export function firstName(finding: MessageOnly): string | null {
  const name = backtickNames(finding.message)[0] ?? quotedNames(finding.message)[0];
  const clipped = name === undefined ? "" : clipName(name);
  return clipped || null;
}

/** The text of the finding's first non-blank `hit` snippet line, whitespace collapsed ("" when there is none). */
export function hitLine(finding: Pick<Finding, "snippet">): string {
  for (const line of finding.snippet) {
    const text = line.hit ? oneLine(line.text) : "";
    if (text) return text;
  }
  return "";
}

/** The name that was never defined, for the Phantom's rune: "Undefined name `cauldron`" → "cauldron". */
export function undefinedName(finding: MessageOnly): string {
  return firstName(finding) ?? UNKNOWN_NAME;
}

/**
 * What a Dust Bunny leaves behind, written like the line nobody used:
 *   F401 "`os` imported but unused"                  → "import os"
 *   F401 "`typing.List` imported…" on a `from` line  → "from typing import List"
 *   F841 / F842 "Local variable `x` is…"            → "x = …"  /  "x: …"
 *   B007 "Loop control variable `i` not used…"       → "for i in …"
 * Null when the message names nothing.
 */
export function unusedTag(finding: WithSnippet & Pick<Finding, "code">): string | null {
  const raw = backtickNames(finding.message)[0];
  if (raw === undefined) return null;
  switch (finding.code) {
    case "F401":
      return clipName(importLine(raw, hitLine(finding)), MAX_TRAIT_NAME_CHARS + 6);
    case "F842":
      return `${clipName(raw)}: …`;
    case "B007":
      return `for ${clipName(raw)} in …`;
    default:
      return `${clipName(raw)} = …`;
  }
}

/** What a beaten Key Thief drops: the name that held the secret, `ADMIN_PASSWORD = "…"` (Bandit quotes it). */
export function secretTag(finding: MessageOnly): string {
  return `${firstName(finding) ?? "password"} = "…"`;
}

/** "import a.b", or "from a import b" when the source line really is a `from` import. */
function importLine(dotted: string, source: string): string {
  const dot = dotted.lastIndexOf(".");
  if (dot > 0 && /^from\s/.test(source)) return `from ${dotted.slice(0, dot)} import ${dotted.slice(dot + 1)}`;
  return `import ${dotted}`;
}

/** The note a Todo Mite squeaks: its comment from "TODO" on ("TODO: ask Granny…"), or the commented-out code. */
export function noteText(finding: Pick<Finding, "snippet" | "title">): string {
  const line = hitLine(finding);
  const hash = line.indexOf("#");
  const comment = hash >= 0 ? line.slice(hash + 1).trim() : line;
  const marker = NOTE_MARKERS.exec(comment);
  const note = marker ? comment.slice(marker.index) : comment;
  return clipName(note || finding.title, MAX_NOTE_CHARS);
}

/**
 * The mutable default a growing monster keeps feeding, read from the code:
 * `def add(item, basket=[])` → { name: "basket", opener: "[" }. Falls back
 * to a list called "default" when the line can't be read.
 */
export function mutableDefault(finding: Pick<Finding, "snippet">): { name: string; opener: "[" | "{" } {
  const match = /([A-Za-z_]\w*)\s*(?::[^=,()]*)?=\s*(\[|\{|list\(|dict\(|set\()/.exec(hitLine(finding));
  if (!match) return { name: "default", opener: "[" };
  return { name: clipName(match[1], MAX_TRAIT_NAME_CHARS / 2), opener: match[2].startsWith("[") || match[2] === "list(" ? "[" : "{" };
}

/** Largest number of items a growing default shows before "…". */
const MAX_SHOWN_ITEMS = 3;

/** What the default holds after `calls` hits: "basket=[1, 1]", "cache={0: 0, 1: 1}" (at most 3 items, then "…"). */
export function grownDefault(name: string, opener: "[" | "{", calls: number): string {
  const shown = Math.min(calls, MAX_SHOWN_ITEMS);
  const items = Array.from({ length: shown }, (_, i) => (opener === "[" ? "1" : `${i}: ${i}`));
  if (calls > MAX_SHOWN_ITEMS) items.push("…");
  const close = opener === "[" ? "]" : "}";
  return `${name}=${opener}${items.join(", ")}${close}`;
}

/** The first whole number in a message, e.g. 9 from "Too many arguments (9 > 8)"; null when there is none. */
export function firstNumber(message: string): number | null {
  const match = /\d+/.exec(message);
  return match ? Number(match[0]) : null;
}

/**
 * How many noodles a Spaghetti Beast waves: one per argument for "too many
 * arguments" (the count is in Ruff's message), otherwise one per branch of
 * its function (`branches`, from the file outline), falling back to the
 * number in the message ("`f` is too complex (13 > 10)"). The engine clamps it.
 */
export function noodleCount(finding: Pick<Finding, "code" | "message">, branches: number | null): number {
  const fromMessage = firstNumber(finding.message);
  if (finding.code === "PLR0913") return fromMessage ?? 0;
  return branches ?? fromMessage ?? 0;
}
