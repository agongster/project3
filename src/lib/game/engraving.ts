/**
 * Named loot: every item a chest gives is engraved with the code it came
 * from, e.g. "Forged in get_batch() · data/prepare.py".
 *
 *   - a clean file's chest: its best-documented function (ties: the
 *     longest, then the first), so good code is what gets remembered
 *   - a dungeon chest: the function that held the toughest monster
 *   - either way, just the file when the outline has no usable definition
 *
 * The engraving is saved per owned item (`SaveData.engravings`), so the bag
 * remembers where each item came from in later sessions and other repos.
 * Wishing Well items are never engraved.
 */
import { clipPath, clipWords, oneLine } from "@/lib/analysis/repoText";
import { definitionAt } from "@/lib/analysis/outline";
import type { AnalyzedFile, Definition, Engraving, Finding, SaveData, Severity } from "@/lib/types";
import type { ChestSource } from "./loot";

/** Longest function name kept in an engraving (a 500-character identifier is clipped). */
export const MAX_ENGRAVED_NAME = 32;
/** Longest path kept in an engraving (clipped from the left, so the file name stays). */
export const MAX_ENGRAVED_PATH = 48;
/** A save never remembers more engravings than this (there are far fewer items in the game). */
export const MAX_ENGRAVINGS = 200;

/** How dangerous each severity is, to find a dungeon's toughest monster. */
const DANGER: Readonly<Record<Severity, number>> = { minion: 0, elite: 1, boss: 2 };

/** How a definition is engraved: "get_batch()", "Trainer.fit()" or "OrderBook". */
function engravedName(definition: Pick<Definition, "name" | "kind">): string {
  const name = clipWords(oneLine(definition.name), MAX_ENGRAVED_NAME - 2);
  return definition.kind === "class" ? name : `${name}()`;
}

/** The clean file's showpiece: best documented, then longest, then first; classes only if it has no functions. */
export function showpieceDefinition(file: AnalyzedFile): Definition | null {
  const functions = file.outline.definitions.filter((d) => d.kind !== "class");
  const pool = functions.length > 0 ? functions : file.outline.definitions;
  const length = (d: Definition) => d.endLine - d.line;
  const documented = (d: Definition) => Number(d.docstring !== null);
  const ranked = [...pool].sort((a, b) => documented(b) - documented(a) || length(b) - length(a) || a.line - b.line);
  return ranked[0] ?? null;
}

/** The dungeon's toughest monster: the most dangerous finding, the first one (by line) on a tie. */
export function toughestFinding(findings: readonly Finding[]): Finding | null {
  const ranked = [...findings].sort((a, b) => DANGER[b.severity] - DANGER[a.severity] || a.line - b.line);
  return ranked[0] ?? null;
}

/** What a chest from `file` engraves on its item. Pure and deterministic. */
export function engravingFor(file: AnalyzedFile, source: ChestSource): Engraving {
  let definition: Definition | null;
  if (source === "clean-file") {
    definition = showpieceDefinition(file);
  } else {
    const toughest = toughestFinding(file.findings);
    definition = toughest ? definitionAt(file.outline, toughest.line) : null;
  }
  return { name: definition ? engravedName(definition) : null, path: clipPath(file.path, MAX_ENGRAVED_PATH) };
}

/** The words shown under an item: "Forged in get_batch() · data/prepare.py", or "Forged in data/prepare.py". */
export function engravingText(engraving: Engraving): string {
  return engraving.name ? `Forged in ${engraving.name} · ${engraving.path}` : `Forged in ${engraving.path}`;
}

/** Cleans one engraving from anywhere (a save, a roll): plain one-line text, bounded length. Null if unusable. */
export function cleanEngraving(raw: unknown): Engraving | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { name, path } = raw as Record<string, unknown>;
  const cleanPath = typeof path === "string" ? clipPath(path, MAX_ENGRAVED_PATH) : "";
  if (cleanPath === "") return null;
  const cleanName = typeof name === "string" ? clipWords(oneLine(name), MAX_ENGRAVED_NAME) : "";
  return { name: cleanName === "" ? null : cleanName, path: cleanPath };
}

/** Where an item in the save was found, or null (starter items, Wishing Well items, older finds). */
export function engravingOf(save: SaveData, itemId: string): Engraving | null {
  const engravings = save.engravings ?? {};
  return Object.hasOwn(engravings, itemId) ? engravings[itemId] : null;
}

/**
 * Remembers where an owned item came from. Only the first engraving sticks
 * (an item is found once); unknown or unowned items leave the save unchanged.
 */
export function engraveItem(save: SaveData, itemId: string, engraving: Engraving): SaveData {
  const clean = cleanEngraving(engraving);
  const engravings = save.engravings ?? {};
  if (!clean || !save.owned.includes(itemId) || Object.hasOwn(engravings, itemId)) return save;
  return { ...save, engravings: { ...engravings, [itemId]: clean } };
}

/**
 * The `engravings` of a loaded save: only for owned items, each cleaned, at
 * most MAX_ENGRAVINGS. Undefined when there are none, so an older save (or a
 * new one) stays exactly as it was.
 */
export function sanitizeEngravings(raw: unknown, owned: readonly string[]): Record<string, Engraving> | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined;
  const ownedSet = new Set(owned);
  const entries: [string, Engraving][] = [];
  for (const [itemId, value] of Object.entries(raw)) {
    const clean = ownedSet.has(itemId) ? cleanEngraving(value) : null;
    if (clean) entries.push([itemId, clean]);
  }
  return entries.length === 0 ? undefined : Object.fromEntries(entries.slice(0, MAX_ENGRAVINGS));
}
