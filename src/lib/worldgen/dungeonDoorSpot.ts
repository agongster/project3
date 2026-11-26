/**
 * Where a dungeon's END DOOR goes: a second way out at the far end, so a
 * player who has fought through every room does not have to walk all the
 * way back to the entrance (the scene opens it once the dungeon is quiet,
 * see src/game/scenes/dungeonEndDoor.ts).
 *
 *     #=P^==^==^==^==#
 *     #p.............#      The door (>) is cut into the EAST wall of the
 *     #..........2...>  ←   last room: the wall the walk from the entrance
 *     #..............#      ends at, and in a one-room dungeon the wall
 *     #.........C....#      opposite the entrance. The two floor tiles in
 *     #..............#      front of it, its LANDING (where the hero stands
 *     ################      to use it), must be free floor.
 *
 * The row: two rows above the chest when that landing is free, so the prize
 * chest never stands in the door's way; otherwise the nearest free row
 * further out (above before below), and only then the rows next to the
 * chest and the chest's own row. The room's top and bottom rows are never
 * used, so the door always has wall above and below it. "Free" is decided
 * by the generator: first out of reach of every monster's carved line of
 * code (`carvingReach`), and if no row is, at least clear of every monster
 * and the band right around it.
 *
 * No randomness here: the door is chosen after everything else is laid out
 * and never draws from the generator's rng, so adding it changes nothing
 * else in a dungeon generated from the same seed.
 */
import { MONSTERS } from "@/lib/game/catalog";
import type { MonsterSpawn, Point, Rect } from "@/lib/types";

/** The door prefers to sit this many rows away from the chest's row. */
const ROWS_FROM_CHEST = 2;
/** Floor tiles in front of the door that must stay free: the spot to use it from, and the step before it. */
export const LANDING_TILES = 2;

/**
 * How far from its monster a line of code may be carved into the floor
 * (src/game/scenes/floorCodeLayout.ts): up to 8 tiles wide, centred on the
 * monster but slid up to 3 tiles sideways when crowded, in a row below its
 * feet or above its head, up to 3 rows away (one more above a big monster).
 */
const CARVING_REACH_X = 7;
const CARVING_REACH_ROWS = 3;

/** The tiles a monster's carved line of code may cover (see CARVING_REACH_X). */
export function carvingReach(m: MonsterSpawn): Rect {
  const above = CARVING_REACH_ROWS + (MONSTERS[m.kind].size > 16 ? 1 : 0);
  return { x: m.x - CARVING_REACH_X, y: m.y - above, w: 2 * CARVING_REACH_X + 1, h: above + 1 + CARVING_REACH_ROWS };
}

/** The tiles in front of (west of) an end door on an east wall, nearest first. */
export function endDoorLanding(door: Point): Point[] {
  return Array.from({ length: LANDING_TILES }, (_, i) => ({ x: door.x - 1 - i, y: door.y }));
}

/**
 * The rows of `room`'s east wall the door may use, best first (see the
 * header): ROWS_FROM_CHEST rows above the chest, then below, then further
 * out; the rows next to the chest come last, the chest's own row very last.
 */
export function endDoorRows(room: Rect, chestY: number): number[] {
  const offsets: number[] = [];
  for (let d = ROWS_FROM_CHEST; d < room.h; d++) offsets.push(-d, d);
  for (let d = ROWS_FROM_CHEST - 1; d > 0; d--) offsets.push(-d, d);
  offsets.push(0);
  const isInnerRow = (y: number) => y > room.y && y < room.y + room.h - 1;
  return offsets.map((d) => chestY + d).filter(isInnerRow);
}

/**
 * The end door's tile on the east wall of `room` (the dungeon's last room),
 * in the first row of `endDoorRows` whose landing is free. Null when no row
 * has a free landing (the generator then tries roomier rooms).
 */
export function chooseEndDoor(room: Rect, chestY: number, landingIsFree: (p: Point) => boolean): Point | null {
  const eastWall = room.x + room.w;
  for (const y of endDoorRows(room, chestY)) {
    const door = { x: eastWall, y };
    if (endDoorLanding(door).every(landingIsFree)) return door;
  }
  return null;
}
