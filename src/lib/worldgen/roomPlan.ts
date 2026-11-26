/**
 * Room planning: which rooms a file's dungeon has, what each one stands for
 * and which monster starts in which room. Pure data work, no tiles: the
 * dungeon generator (dungeon.ts) turns the plan into floors and walls.
 *
 * The dungeon reads like its file, top to bottom = entrance inward:
 *
 *     bakery/orders.py                      dungeon, left → right
 *     import os           ← F401           [entry hall: module]   dust bunny
 *     def add(item, b=[]) ← B006           [def add()]            mimic
 *     def read_order():   ← E722           [def read_order()]     swallow toad
 *     def total():        ← F821           [def total()]          phantom
 *
 *  1. Every finding belongs to the function, method or class body its line
 *     is in (`definitionAt`). Module-level findings, and every finding of a
 *     file without an outline, belong to the entry hall.
 *  2. The entry hall (the module itself) always comes first, even when it
 *     has no monsters; function rooms follow in source order. Functions
 *     without findings get no room.
 *  3. Bosses get an arena of their own: a room whose code has both bosses
 *     and regular monsters splits into a room for the regular ones and,
 *     right after it, an arena for the bosses (as in a boss fight, you clear
 *     the way first, then face the boss alone).
 *  4. A dungeon has at most MAX_ROOMS rooms (arenas included) and at most
 *     MAX_FUNCTION_ROOMS function rooms: while there are more, the two
 *     NEIGHBOURING function rooms with the fewest source lines merge, so the
 *     smallest functions end up sharing a room and the order is kept.
 *  5. A room with more than MAX_MONSTERS_PER_ROOM monsters splits in two (by
 *     line order) while the dungeon has fewer than MAX_ROOMS rooms, so a
 *     crowded function or a long script does not become one packed hall.
 *     Rooms split from the same code are numbered: "module · 1/2".
 *  6. Arenas are open floor (see dungeon.ts). A room is lit when its code
 *     is documented (every function in it has a docstring; the hall needs a
 *     module docstring).
 *
 * Names come from somebody's repo, so every name and label is clipped.
 */
import { definitionAt } from "@/lib/analysis/outline";
import type { AnalyzedFile, Definition, Dungeon, DungeonRoom, Finding } from "@/lib/types";
import { compareText } from "./regions";

/** Function rooms after merging (the entry hall comes on top of these). */
export const MAX_FUNCTION_ROOMS = 3;
/** Rooms in a whole dungeon, arenas included (merging stops at the hall plus one function room). */
export const MAX_ROOMS = 5;
/** A room with more monsters than this is split in two when there is space for another room. */
export const MAX_MONSTERS_PER_ROOM = 3;
/** Longest definition name shown (a 300-character name is cut with "…"). */
export const MAX_NAME_CHARS = 24;
/** Longest room label ("def take_order() +2 more · 1/2"). */
export const MAX_LABEL_CHARS = 44;
/** A plaque lists at most this many names of a shared room, then "and N more". */
const MAX_PLAQUE_NAMES = 4;
const ELLIPSIS = "…";

/** One room of the plan: what it stands for, and its monsters. */
export interface PlannedRoom {
  info: DungeonRoom;
  /** The room's findings, in line order. */
  findings: Finding[];
  /** How many source lines the room stands for (decides its size; split rooms share them). */
  lines: number;
  /** What the room's plaque says when read. */
  plaque: string;
}

/** Findings that share a room while planning. */
interface Group {
  /** The functions/methods/classes of the room, in source order; empty for the entry hall. */
  definitions: Definition[];
  findings: Finding[];
}

type PlanInput = Pick<AnalyzedFile, "path" | "findings" | "outline" | "lineCount">;

/** The rooms of `file`'s dungeon, entry hall first, then in source order. */
export function planRooms(file: PlanInput): PlannedRoom[] {
  const findings = [...file.findings].sort(byLine);
  const hall: Group = { definitions: [], findings: [] };
  const byDefinition = new Map<Definition, Group>();
  for (const finding of findings) {
    const definition = definitionAt(file.outline, finding.line);
    if (!definition) {
      hall.findings.push(finding);
      continue;
    }
    const group = byDefinition.get(definition) ?? { definitions: [definition], findings: [] };
    group.findings.push(finding);
    byDefinition.set(definition, group);
  }
  let functionRooms = mergeSmallest([...byDefinition.values()].sort((a, b) => firstLine(a) - firstLine(b)), MAX_FUNCTION_ROOMS);
  while (separateBosses([hall, ...functionRooms]).length > MAX_ROOMS && functionRooms.length > 1) {
    functionRooms = mergeSmallest(functionRooms, functionRooms.length - 1);
  }
  const groups = splitCrowded(separateBosses([hall, ...functionRooms]));
  return groups.map((group, i) => describe(group, partOf(groups, i), file));
}

// ───────────────────────────── merging & splitting ─────────────────────────────

/** Source order for findings (ties broken by column, then id, so the plan never depends on input order). */
const byLine = (a: Finding, b: Finding) => a.line - b.line || a.col - b.col || compareText(a.id, b.id);
const firstLine = (g: Group) => Math.min(...g.definitions.map((d) => d.line));
const lastLine = (g: Group) => Math.max(...g.definitions.map((d) => d.endLine));
const spanOf = (d: Definition) => Math.max(1, d.endLine - d.line + 1);
const linesOf = (g: Group) => g.definitions.reduce((sum, d) => sum + spanOf(d), 0);

/** Merges neighbouring function rooms, smallest pair first, until at most `max` are left. */
function mergeSmallest(groups: Group[], max: number): Group[] {
  const out = [...groups];
  while (out.length > max) {
    let best = 0;
    for (let i = 1; i + 1 < out.length; i++) {
      if (linesOf(out[i]) + linesOf(out[i + 1]) < linesOf(out[best]) + linesOf(out[best + 1])) best = i;
    }
    const merged: Group = {
      definitions: [...out[best].definitions, ...out[best + 1].definitions],
      findings: [...out[best].findings, ...out[best + 1].findings].sort(byLine),
    };
    out.splice(best, 2, merged);
  }
  return out;
}

const isBoss = (f: Finding) => f.severity === "boss";

/** Gives the bosses of every room their own arena, right after the room's regular monsters. */
function separateBosses(groups: readonly Group[]): Group[] {
  return groups.flatMap((g) => {
    const regulars = g.findings.filter((f) => !isBoss(f));
    const bosses = g.findings.filter(isBoss);
    if (regulars.length === 0 || bosses.length === 0) return [g];
    return [
      { definitions: g.definitions, findings: regulars },
      { definitions: g.definitions, findings: bosses },
    ];
  });
}

/**
 * Splits the most crowded room in two (first half of its findings, second
 * half) until no room is crowded or the dungeon has MAX_ROOMS rooms. Both
 * halves keep the same `definitions` array, which is how `partOf` finds them.
 */
function splitCrowded(groups: Group[]): Group[] {
  const out = [...groups];
  while (out.length < MAX_ROOMS) {
    let crowded = -1;
    out.forEach((g, i) => {
      if (g.findings.length > MAX_MONSTERS_PER_ROOM && (crowded === -1 || g.findings.length > out[crowded].findings.length)) crowded = i;
    });
    if (crowded === -1) break;
    const { definitions, findings } = out[crowded];
    const half = Math.ceil(findings.length / 2);
    out.splice(crowded, 1, { definitions, findings: findings.slice(0, half) }, { definitions, findings: findings.slice(half) });
  }
  return out;
}

/** Which part (1-based) of how many parts of the same code group `i` is. */
function partOf(groups: readonly Group[], i: number): { part: number; parts: number } {
  const same = groups.filter((g) => g.definitions === groups[i].definitions);
  return { part: same.indexOf(groups[i]) + 1, parts: same.length };
}

// ───────────────────────────── names & labels ─────────────────────────────

/** `text`, cut to at most `max` characters with "…" at the end. */
export function clipText(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length <= max ? text : chars.slice(0, max - 1).join("") + ELLIPSIS;
}

/** "def take_order()", "def Trainer.fit()" or "class Cauldron". */
function signature(d: Definition): string {
  const name = clipText(d.name, MAX_NAME_CHARS);
  return d.kind === "class" ? `class ${name}` : `def ${name}()`;
}

function labelFor(definitions: readonly Definition[], part: { part: number; parts: number }): string {
  let label = definitions.length === 0 ? "module" : signature(definitions[0]);
  if (definitions.length > 1) label += ` +${definitions.length - 1} more`;
  if (part.parts > 1) label += ` · ${part.part}/${part.parts}`;
  return clipText(label, MAX_LABEL_CHARS);
}

/** Lines of module-level code: the file minus its top-level functions and classes. */
function moduleLines(file: PlanInput): number {
  const topLevel = file.outline.definitions.filter((d) => d.kind !== "method");
  return Math.max(1, file.lineCount - topLevel.reduce((sum, d) => sum + spanOf(d), 0));
}

/** What the plaque at the room's entrance says. */
function plaqueText(group: Group, label: string, file: PlanInput): string {
  const { definitions } = group;
  if (definitions.length === 0) {
    const doc = file.outline.moduleDocstring;
    return doc ? `${file.path} — "${doc}"` : `${file.path} — No module docstring. What is this file for?`;
  }
  if (definitions.length === 1) {
    const d = definitions[0];
    if (d.docstring) return `${label} — "${d.docstring}"`;
    return `${label} — No docstring. What does this ${d.kind === "class" ? "class" : "function"} do?`;
  }
  const shown = definitions.slice(0, MAX_PLAQUE_NAMES).map(signature).join(", ");
  const more = definitions.length > MAX_PLAQUE_NAMES ? ` and ${definitions.length - MAX_PLAQUE_NAMES} more` : "";
  const documented = definitions.filter((d) => d.docstring !== null).length;
  return `${shown}${more} — ${definitions.length} small functions share this room. ${documented} of them have a docstring.`;
}

function describe(group: Group, part: { part: number; parts: number }, file: PlanInput): PlannedRoom {
  const { definitions, findings } = group;
  const isHall = definitions.length === 0;
  const label = labelFor(definitions, part);
  const info: DungeonRoom = {
    kind: isHall ? "module" : "function",
    label,
    names: definitions.map((d) => clipText(d.name, MAX_NAME_CHARS)),
    line: isHall ? 1 : firstLine(group),
    endLine: isHall ? Math.max(1, file.lineCount) : lastLine(group),
    branches: isHall ? 0 : Math.max(...definitions.map((d) => d.branches)),
    docstring: isHall ? file.outline.moduleDocstring : (definitions.find((d) => d.docstring !== null)?.docstring ?? null),
    lit: isHall ? file.outline.moduleDocstring !== null : definitions.every((d) => d.docstring !== null),
    arena: findings.some(isBoss),
  };
  // Rooms split from the same code share its lines, so a long script does not become several huge halls.
  const lines = Math.ceil((isHall ? moduleLines(file) : linesOf(group)) / part.parts);
  return { info, findings, lines, plaque: plaqueText(group, label, file) };
}

// ───────────────────────────── reading rooms back ─────────────────────────────

/**
 * The room a tile belongs to: the room whose floor contains it, otherwise
 * the room nearest to it left/right (corridors sit between two rooms).
 * -1 only when there are no rooms.
 */
export function roomIndexAt(dungeon: Pick<Dungeon, "rooms">, x: number, y: number): number {
  let best = -1;
  let bestDistance = Infinity;
  dungeon.rooms.forEach((r, i) => {
    const dx = x < r.x ? r.x - x : x >= r.x + r.w ? x - (r.x + r.w - 1) : 0;
    const dy = y < r.y ? r.y - y : y >= r.y + r.h ? y - (r.y + r.h - 1) : 0;
    const distance = dx * 1000 + dy; // horizontal distance first: rooms are lined up left to right
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best;
}

/** The HUD location line for a tile: "orders.py · def take_order()". */
export function locationLabel(dungeon: Pick<Dungeon, "path" | "rooms" | "roomInfo">, x: number, y: number): string {
  const room = dungeon.roomInfo[roomIndexAt(dungeon, x, y)];
  const fileName = dungeon.path.slice(dungeon.path.lastIndexOf("/") + 1);
  return room ? `${fileName} · ${room.label}` : dungeon.path;
}
