/**
 * Dungeon props: what stands in the rooms once floors, walls and monsters
 * are in place.
 *
 *   plaque   one at the entrance of every room (top-left wall). Reading it
 *            names the code the room stands for and quotes its docstring —
 *            or asks what the undocumented function does. The entry hall's
 *            plaque names the file.
 *   torches  "docstring lanterns": a documented room gets a torch beside its
 *            plaque and one every LIT_TORCH_SPACING tiles along the top wall;
 *            an undocumented room only one every DIM_TORCH_SPACING tiles, so
 *            it is noticeably dimmer (the hero's own light still shows the
 *            way, and monsters and their warnings are drawn above the dark).
 *   clutter  pots and crates in corners, cobwebs, bones, and the odd glowing
 *            crystal (lit rooms only, so dim rooms stay dim). Solid clutter
 *            never narrows a passage below 2 tiles.
 */
import { Ground, type Point, type Prop, type PropKind, type Rect, type TileMap } from "@/lib/types";
import { chance, pick, randInt, shuffled, type Rng } from "@/lib/rng";
import type { PlannedRoom } from "./roomPlan";

/** Tiles between torches along the top wall of a documented room… */
const LIT_TORCH_SPACING = 3;
/** …and of an undocumented one. */
const DIM_TORCH_SPACING = 9;
/** Chance that a lit room gets a glowing crystal by its bottom wall. */
const CRYSTAL_CHANCE = 0.3;
// Prop variants that mean something specific in the art (see src/game/art/props.ts).
const TORCH_WALL_SCONCE = 1;
const WEB_TOP_LEFT = 0;
const WEB_TOP_RIGHT = 1;

const isFloorTile = (g: number) => g === Ground.DungeonFloor || g === Ground.DungeonFloorAlt;

/** Where a room's plaque hangs: on the top wall face, one tile in from the left. */
export function plaqueSpot(room: Rect): Point {
  return { x: room.x + 1, y: room.y - 1 };
}

/**
 * Props for every room. `busy` holds tile indices that must stay free
 * (reserved spots, monsters and the tiles around them).
 */
export function decorateDungeon(map: TileMap, rooms: readonly Rect[], plan: readonly PlannedRoom[], busy: ReadonlySet<number>, rng: Rng): Prop[] {
  const { width } = map;
  const props = new Map<number, Prop>();
  const groundAt = (p: Point) => map.ground[p.y * width + p.x];
  // `variant` is normally random, but for a few props the art gives each
  // variant a meaning (torch 1 = wall sconce, web 0/1 = left/right corner),
  // so those callers pass it explicitly.
  const add = (kind: PropKind, p: Point, solid: boolean, text?: string, variant?: number) => {
    const i = p.y * width + p.x;
    if (props.has(i)) return;
    const randomVariant = randInt(rng, 0, 255); // always drawn, so the rng sequence never depends on `variant`
    const prop: Prop = { kind, x: p.x, y: p.y, variant: variant ?? randomVariant, solid };
    if (text !== undefined) prop.text = text;
    props.set(i, prop);
  };
  const freeFloor = (p: Point) => isFloorTile(groundAt(p)) && !busy.has(p.y * width + p.x) && !props.has(p.y * width + p.x);
  const blocked = (x: number, y: number) => !isFloorTile(map.ground[y * width + x]) || props.get(y * width + x)?.solid === true;
  const addSolid = (kind: PropKind, p: Point) => {
    if (freeFloor(p) && keepsPassagesWide(p, blocked)) add(kind, p, true);
  };

  rooms.forEach((room, i) => {
    const x0 = room.x;
    const y0 = room.y;
    const x1 = room.x + room.w - 1;
    const y1 = room.y + room.h - 1;
    const lit = plan[i].info.lit;
    const plaque = plaqueSpot(room);
    add("plaque", plaque, false, plan[i].plaque);

    // Docstring lanterns: a documented room's plaque is lit, and its wall is lined with torches.
    const torch = (p: Point) => {
      if (groundAt(p) === Ground.DungeonWallFace) add("torch", p, false, undefined, TORCH_WALL_SCONCE);
    };
    if (lit) torch({ x: plaque.x + 1, y: plaque.y });
    const spacing = lit ? LIT_TORCH_SPACING : DIM_TORCH_SPACING;
    for (let x = plaque.x + 1 + spacing; x <= x1 - 1; x += spacing) torch({ x, y: y0 - 1 });

    // Pot and crate clusters tucked into two or three corners.
    const corners = shuffled(rng, [
      { x: x0, y: y0, dx: 1, dy: 1 },
      { x: x1, y: y0, dx: -1, dy: 1 },
      { x: x0, y: y1, dx: 1, dy: -1 },
      { x: x1, y: y1, dx: -1, dy: -1 },
    ]);
    for (const c of corners.slice(0, randInt(rng, 2, 3))) {
      const cluster = [
        { x: c.x, y: c.y },
        { x: c.x + c.dx, y: c.y },
        { x: c.x, y: c.y + c.dy },
      ].slice(0, randInt(rng, 1, 3));
      const kind = pick(rng, ["pot", "crate"] as const);
      for (const p of cluster) addSolid(kind, p);
    }

    // Cobwebs in the top corners, a few bones, sometimes a glowing crystal by the bottom wall.
    for (const corner of [{ x: x0, y: y0, variant: WEB_TOP_LEFT }, { x: x1, y: y0, variant: WEB_TOP_RIGHT }]) {
      if (chance(rng, 0.5) && freeFloor(corner)) add("web", corner, false, undefined, corner.variant);
    }
    for (let n = randInt(rng, 0, 2); n > 0; n--) {
      const p = { x: randInt(rng, x0, x1), y: randInt(rng, y0, y1) };
      if (freeFloor(p)) add("bones", p, false);
    }
    if (chance(rng, CRYSTAL_CHANCE) && lit) addSolid("crystal", { x: randInt(rng, x0 + 1, x1 - 1), y: y1 });
  });
  return [...props.values()];
}

/**
 * True when blocking tile `p` leaves every floor tile around it inside a
 * 2×2 square of open floor, i.e. no passage next to it shrinks below 2 tiles.
 */
function keepsPassagesWide(p: Point, blocked: (x: number, y: number) => boolean): boolean {
  const isBlocked = (x: number, y: number) => (x === p.x && y === p.y) || blocked(x, y);
  const inOpenSquare = (x: number, y: number) =>
    [
      [-1, -1],
      [0, -1],
      [-1, 0],
      [0, 0],
    ].some(([sx, sy]) => !isBlocked(x + sx, y + sy) && !isBlocked(x + sx + 1, y + sy) && !isBlocked(x + sx, y + sy + 1) && !isBlocked(x + sx + 1, y + sy + 1));
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = p.x + dx;
      const y = p.y + dy;
      if ((dx !== 0 || dy !== 0) && !isBlocked(x, y) && !inOpenSquare(x, y)) return false;
    }
  }
  return true;
}
