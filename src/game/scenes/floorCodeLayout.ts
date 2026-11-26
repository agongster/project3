/**
 * FLOOR CODE, part 1: the layout. Pure functions, no canvas, unit-tested.
 *
 * Every monster's offending line of source is carved into the floor where
 * the monster starts, so the player sees the repo's real code in its dungeon:
 *
 *     L22  x = eval(user_input)
 *
 * This file decides WHAT each carving says and WHERE it lies; floorCode.ts
 * draws it (cursed while the monster lives, healed once it is defeated).
 *
 *   text      the finding's first non-blank `hit` snippet line with its line
 *             number; whitespace collapsed, characters the pixel font cannot
 *             draw become "?". No usable line → "L12  # Unused import".
 *   width     at most MAX_CARVING_PX (and never wider than the room), cut
 *             with "…" when longer.
 *   position  centred just below the monster's feet, kept inside the
 *             monster's room. If that spot touches a wall, another carving,
 *             a monster's starting body, the chest or a solid prop, try small
 *             slides sideways, then just above its head, then rows further
 *             out; if nothing is free, shorten the text and try again; below
 *             MIN_CARVING_PX the carving is skipped.
 *
 * Positions are world pixels; a carving's box includes the 1 px of room
 * around the letters that floorCode.ts uses for the groove and the glow.
 */
import { FONT_CAP_HEIGHT, measureText } from "@/game/art/font";
import { GLYPHS } from "@/game/art/fontGlyphs";
import { MONSTERS } from "@/lib/game/catalog";
import { rectContains, tilesOf } from "@/lib/worldgen/grid";
import { Ground, type Dungeon, type Finding, type MonsterSpawn, type Rect } from "@/lib/types";
import { TILE_PX } from "../engine/collision";

/** Widest a carving may be (px, box included): about 8 tiles, roughly 28 characters of code. */
export const MAX_CARVING_PX = 128;
/** A carving squeezed narrower than this would say almost nothing, so it is skipped instead. */
export const MIN_CARVING_PX = 40;
/** Each retry for a crowded spot shortens the text to this share of the previous width. */
const SHRINK_FACTOR = 0.75;
/** Room around the letters inside a carving's box, for the stone lip under them and the heal's white halo. */
export const CARVING_PAD_PX = 1;
/** Rows the pixel font draws below the capitals, for "g", "_", "," (see font.ts). */
const FONT_DESCENDER_ROWS = 2;
/** Rows a glyph can ink. */
const GLYPH_ROWS = FONT_CAP_HEIGHT + FONT_DESCENDER_ROWS;
/** Height of every carving's box (px). */
export const CARVING_H = GLYPH_ROWS + 2 * CARVING_PAD_PX;
/** A carving keeps at least this many px from other carvings and from everything it must keep off. */
export const CARVING_GAP_PX = 2;
/** Carvings stay this far from the room's walls (px). */
export const ROOM_MARGIN_PX = 3;
/** A monster's feet stand this far below the top of its spawn tile (matches monster.ts). */
const FEET_DY = 12;
/** The preferred carving starts just under the feet, so it reads like the monster's caption. */
const BELOW_FEET_PX = 2;
/** Besides the rows right below the feet and right above the head, this many more are tried on each side. */
const EXTRA_ROWS = 2;
/** Distance between two neighbouring rows (px): one carving plus the gap. */
const ROW_STEP = CARVING_H + CARVING_GAP_PX;
/**
 * Within each row, sideways slides tried (in SLIDE_STEP_PX): centred, then
 * ever further left and right. At most 4 steps (48 px), so the monster still
 * stands over its own line rather than a neighbour's.
 */
const SLIDES = [0, -1, 1, -2, 2, -3, 3, -4, 4];
const SLIDE_STEP_PX = 12;
/** Between the line number and the code. */
const LABEL_GAP = "  ";
/** Ends a shortened carving. The font draws it as three dots in one 5 px glyph. */
export const ELLIPSIS = "…";
/** Stands in for any character the pixel font has no glyph for (é, emoji, CJK...). */
export const UNKNOWN_CHAR = "?";

/** One line of code carved into the floor. */
export interface Carving {
  findingId: string;
  text: string;
  /** Box in world px (letters plus CARVING_PAD_PX all round); the letters start at x + pad, y + pad. */
  x: number;
  y: number;
  w: number;
  h: number;
}

type Box = Rect;

/** The parts of a dungeon the layout looks at. */
export type FloorPlan = Pick<Dungeon, "rooms" | "width" | "ground" | "monsters" | "chest" | "props">;

// ───────────────────────────── text ─────────────────────────────

const canCarve = (ch: string) => Object.hasOwn(GLYPHS, ch);

/**
 * Makes one source line carvable: tabs and runs of spaces become one space
 * (floor space is precious and indentation means nothing out of context),
 * the ends are trimmed, and characters the font cannot draw become "?".
 */
export function cleanCodeLine(raw: string): string {
  let out = "";
  // for...of walks code points, so an emoji becomes one "?", not two.
  for (const ch of raw) out += /\s/.test(ch) ? " " : canCarve(ch) ? ch : UNKNOWN_CHAR;
  return out.replace(/ {2,}/g, " ").trim();
}

/**
 * What a finding's carving says: its first non-blank hit line, as
 * "L22  x = eval(user_input)". A finding with no usable hit line (a blank
 * line, a syntax error past the end of the file) is carved as a Python
 * comment with its title instead; null when even that would be empty.
 */
export function carvingText(finding: Pick<Finding, "line" | "title" | "snippet">): string | null {
  for (const line of finding.snippet) {
    const code = line.hit ? cleanCodeLine(line.text) : "";
    if (code) return `L${line.n}${LABEL_GAP}${code}`;
  }
  const title = cleanCodeLine(finding.title);
  return title ? `L${finding.line}${LABEL_GAP}# ${title}` : null;
}

/**
 * `text` if it fits in `maxPx`, otherwise as many leading characters as fit
 * followed by "…". "" when not even the ellipsis fits.
 */
export function fitText(text: string, maxPx: number): string {
  if (measureText(text) <= maxPx) return text;
  const chars = Array.from(text);
  while (chars.length > 0) {
    chars.pop();
    const cut = chars.join("").trimEnd() + ELLIPSIS;
    if (measureText(cut) <= maxPx) return cut;
  }
  return "";
}

// ─────────────────────────── placement ───────────────────────────

/** True when the boxes overlap or come closer than `gap` px. */
export function boxesTouch(a: Box, b: Box, gap: number): boolean {
  return a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
}

const tileBox = (tx: number, ty: number): Box => ({ x: tx * TILE_PX, y: ty * TILE_PX, w: TILE_PX, h: TILE_PX });

/** The room's floor in px, minus the margin along the walls. */
function roomInterior(room: Rect): Box {
  return {
    x: room.x * TILE_PX + ROOM_MARGIN_PX,
    y: room.y * TILE_PX + ROOM_MARGIN_PX,
    w: room.w * TILE_PX - 2 * ROOM_MARGIN_PX,
    h: room.h * TILE_PX - 2 * ROOM_MARGIN_PX,
  };
}

/** The floor a monster's body covers while it waits at its spawn (its sprite rises `size` px from its feet). */
function monsterBody(spawn: Pick<MonsterSpawn, "x" | "y" | "kind">): Box {
  const size = MONSTERS[spawn.kind].size;
  return { x: spawn.x * TILE_PX + TILE_PX / 2 - size / 2, y: spawn.y * TILE_PX + FEET_DY - size, w: size, h: size };
}

const isFloor = (ground: number) => ground === Ground.DungeonFloor || ground === Ground.DungeonFloorAlt;

/** Every tile inside a room that is not floor: walls and pillars the generator raised inside it, the exit doormat. */
function nonFloorInRooms(map: Pick<Dungeon, "rooms" | "width" | "ground">): Box[] {
  const tiles = map.rooms.flatMap((room) => tilesOf(room));
  return tiles.filter((t) => !isFloor(map.ground[t.y * map.width + t.x])).map((t) => tileBox(t.x, t.y));
}

/** The prize chest's spot plus the tile above it, where its bobbing "over here" arrow floats. */
function chestArea(chest: Dungeon["chest"]): Box {
  return { x: chest.x * TILE_PX, y: (chest.y - 1) * TILE_PX, w: TILE_PX, h: 2 * TILE_PX };
}

/**
 * Where a carving must not go: anything in a room that is not floor, and
 * floor where it would be hidden (every monster's starting body, the
 * chest and its arrow, every solid prop: pots, crates, crystals).
 */
function keepOffBoxes(dungeon: FloorPlan): Box[] {
  return [
    ...nonFloorInRooms(dungeon),
    ...dungeon.monsters.map(monsterBody),
    chestArea(dungeon.chest),
    ...dungeon.props.filter((p) => p.solid).map((p) => tileBox(p.x, p.y)),
  ];
}

/**
 * The rows (box tops, px) a monster's carving may use, best first: just
 * below its feet, just above its head, then one row further out on each
 * side at a time.
 */
function candidateRows(spawn: Pick<MonsterSpawn, "y" | "kind">): number[] {
  const feetY = spawn.y * TILE_PX + FEET_DY;
  const below = feetY + BELOW_FEET_PX;
  const above = feetY - MONSTERS[spawn.kind].size - CARVING_GAP_PX - CARVING_H;
  const rows: number[] = [];
  for (let i = 0; i <= EXTRA_ROWS; i++) rows.push(below + i * ROW_STEP, above - i * ROW_STEP);
  return rows;
}

/**
 * Every spot to try for a carving of width `w`, best first: each row of
 * `rows` centred on `centerX`, then slid a little sideways. Spots are kept
 * inside `area`; rows that do not fit in it are left out.
 */
function candidateBoxes(centerX: number, rows: readonly number[], w: number, area: Box): Box[] {
  const boxes: Box[] = [];
  for (const y of rows) {
    if (y < area.y || y + CARVING_H > area.y + area.h) continue;
    for (const slide of SLIDES) {
      const x = Math.round(Math.min(Math.max(centerX - w / 2 + slide * SLIDE_STEP_PX, area.x), area.x + area.w - w));
      boxes.push({ x, y, w, h: CARVING_H });
    }
  }
  return boxes;
}

/**
 * Finds a spot for one carving near `spawn` inside `room` that touches none
 * of `taken`, shortening the text when no spot is free. Null when even
 * MIN_CARVING_PX does not fit anywhere.
 */
export function placeCarving(text: string, spawn: Pick<MonsterSpawn, "x" | "y" | "kind">, room: Rect, taken: readonly Box[]): Omit<Carving, "findingId"> | null {
  const area = roomInterior(room);
  const centerX = spawn.x * TILE_PX + TILE_PX / 2;
  const rows = candidateRows(spawn);
  const fullW = measureText(text) + 2 * CARVING_PAD_PX;
  for (let maxW = Math.min(MAX_CARVING_PX, area.w, fullW); maxW >= MIN_CARVING_PX; maxW = Math.floor(maxW * SHRINK_FACTOR)) {
    const fitted = fitText(text, maxW - 2 * CARVING_PAD_PX);
    const w = measureText(fitted) + 2 * CARVING_PAD_PX;
    const free = candidateBoxes(centerX, rows, w, area).find((box) => !taken.some((t) => boxesTouch(box, t, CARVING_GAP_PX)));
    if (free) return { text: fitted, ...free };
  }
  return null;
}

/**
 * Lays out the carvings of a whole dungeon, one per monster (in spawn
 * order, so the first monsters get the best spots). Monsters whose finding,
 * room or text is missing, or who find no free spot, get no carving.
 */
export function layoutCarvings(dungeon: FloorPlan, findings: readonly Finding[]): Carving[] {
  const byId = new Map(findings.map((f) => [f.id, f]));
  const keepOff = keepOffBoxes(dungeon);
  const carvings: Carving[] = [];
  for (const spawn of dungeon.monsters) {
    const finding = byId.get(spawn.findingId);
    const room = dungeon.rooms.find((r) => rectContains(r, spawn.x, spawn.y));
    const text = finding ? carvingText(finding) : null;
    if (!room || !text) continue;
    const spot = placeCarving(text, spawn, room, [...keepOff, ...carvings]);
    if (spot) carvings.push({ findingId: spawn.findingId, ...spot });
  }
  return carvings;
}
