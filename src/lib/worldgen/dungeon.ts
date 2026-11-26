/**
 * generateDungeon: one AnalyzedFile → Dungeon.
 *
 * The dungeon is shaped by the file's code. Walking from the entrance inward
 * is reading the file top to bottom: the entry hall is the module itself,
 * then comes one room per function with findings, in source order (which
 * rooms exist and who lives where is decided in roomPlan.ts). The demo's
 * bakery/pricing.py (renderAscii; legend in ascii.ts): the module's entry
 * hall, then `price_of()`, a 12-branch function, so its room is a maze:
 *
 *                ###################
 *      ######### #=P^==^==^#=^==^==#      # wall top, = wall face, ^ torch
 *      #=P^==^=# #x.,.,..,.#.,%,.xx#      P plaque naming the room's code
 *      #p,,..pp# #..,....,,#,......#
 *      #p.....p###,...2...,#..,....>      1 2 3 minion / elite / boss
 *      #.......===.,.......#.......#      > end door (opens once quiet)
 *      <@..,........,......=....C..#      < exit, @ entrance, C chest
 *      #...........,..#.,.......,..#
 *      #......,###x,..#..,,2.,....,#      p pot, x crate, $ crystal, % bones
 *      #...,,..# #xx..#..,..,.,.$.,#
 *      ######### ###################
 *     entry hall   def price_of()  (two partition walls)
 *
 * 1. Plan the rooms (roomPlan.ts).
 * 2. Size them: a longer function makes a bigger room; more monsters, a
 *    boss or maze walls ask for more space. Line them up left to right with
 *    short 2-tile-tall corridors between them, in line with the entrance.
 * 3. Entrance + exit on the left wall of the hall; the chest near the right
 *    end of the last room; reserve the tiles that must stay clear.
 * 4. Monsters, each in its own room, spread left to right in line order
 *    (in an arena: at the back, away from the door).
 * 5. Interior walls for branchy functions (roomMaze.ts), in the space the
 *    monsters left free. Arenas stay open.
 * 6. Carve floors, then derive the walls: every tile next to a floor is a
 *    wall, a wall with floor right below it shows its front face, and the
 *    faces get a wall top above them (the classic 3/4 top-down look).
 * 7. Plaques, torches and clutter (dungeonDecor.ts).
 * 8. The end door (>) on the east wall of the last room, with free floor in
 *    front of it (dungeonDoorSpot.ts; it draws no rng, so nothing else moves).
 * 9. Repair + validate: everything important must be reachable on foot.
 */
import { Ground, type AnalyzedFile, type Dungeon, type Finding, type MonsterSpawn, type Point, type PropKind, type Rect } from "@/lib/types";
import { MONSTERS } from "@/lib/game/catalog";
import { chance, hashString, mulberry32, randInt, type Rng } from "@/lib/rng";
import { chebyshev, clamp, createTileMap, rectContains, setTile, tilesOf } from "./grid";
import { decorateDungeon, plaqueSpot } from "./dungeonDecor";
import { carvingReach, chooseEndDoor, endDoorLanding } from "./dungeonDoorSpot";
import { clearBlockedPaths, solidPropTiles } from "./reachability";
import { planRooms, type PlannedRoom } from "./roomPlan";
import { mazeLevel, planInteriorWalls } from "./roomMaze";
import { DUNGEON_MARGIN, dungeonProblems, monsterFootprint, monsterSpacing } from "./validate";

const MAX_ATTEMPTS = 8;
/** For this many attempts, a branchy room without any interior wall means "try roomier rooms". */
const MAZE_RETRIES = 4;
/** Monsters never start closer than this (Chebyshev) to the entrance. */
const ENTRANCE_CLEARANCE = 5;
/** Room floor before monsters and maze walls ask for more, in tiles. */
const ROOM_MIN_W = 8;
const ROOM_MAX_W = 13;
const ROOM_MIN_H = 7;
const ROOM_MAX_H = 11;
/** Every this many source lines make a room one tile wider… */
const LINES_PER_COLUMN = 10;
/** …and every this many one tile taller. */
const LINES_PER_ROW = 25;
/** An entry hall without monsters is just a small foyer. */
const FOYER_W = 6;
/** Extra width in the room with the entrance, for the monster-free zone around it. */
const ENTRANCE_ZONE_W = 4;
/** Extra width and height per maze level, so maze walls never squeeze out the fighting space. */
const MAZE_EXTRA_W = 1;
const MAZE_EXTRA_H = 1;
/** Void columns between two neighbouring rooms' walls (the corridor is this plus 2 tiles long). */
const CORRIDOR_GAP = { min: 1, max: 2 };
/** Boss arenas are at least this big… */
const ARENA_MIN_W = 13;
const ARENA_MIN_H = 9;
/** …and this much wider for every further pair of bosses (bosses stand in columns of two). */
const BOSS_COLUMN_W = 4;

/**
 * Interior walls keep this far from a monster: its footprint plus one tile,
 * and the caption band where its line of code is carved into the floor
 * (just under its feet, up to 8 tiles wide: see MAX_CARVING_PX in
 * src/game/scenes/floorCodeLayout.ts).
 */
const MONSTER_MARGIN = 1;
const CAPTION_HALF_W = 4;
const CAPTION_ROWS = 2;
/** Interior walls keep this far (Chebyshev) from the chest's spot. */
const CHEST_MARGIN = 2;
/** Monsters are spread over the last room up to this many columns before the chest's spot. */
const CHEST_CLEARANCE = 2;
/**
 * Monsters aim for an upper, a lower and a middle lane; the outer lanes lie
 * this many tiles in from the walls, so every monster has open floor on all
 * sides (to be reached from anywhere, and to dash, hop and swoop).
 */
const LANE_INSET = 2;

/** Breakable or decorative dungeon props that the repair step may remove. */
const REMOVABLE: ReadonlySet<PropKind> = new Set<PropKind>(["pot", "crate", "crystal", "bones", "web"]);

export function generateDungeon(file: AnalyzedFile, repoSeed: number): Dungeon {
  const seed = hashString(`${repoSeed}:${file.path}`);
  const plan = planRooms(file);
  let problems: string[] = [];
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = mulberry32((seed + Math.imul(attempt, 0x9e3779b9)) >>> 0);
    // Each retry makes the rooms a little roomier, so a crowded file always fits eventually.
    const dungeon = buildDungeon(file, plan, seed, rng, attempt);
    problems = typeof dungeon === "string" ? [dungeon] : dungeonProblems(dungeon, file);
    if (typeof dungeon !== "string" && problems.length === 0) return dungeon;
  }
  throw new Error(`Could not generate a dungeon for ${file.path}: ${problems.slice(0, 3).join("; ")}`);
}

/** One generation attempt. Returns the dungeon, or the reason the attempt gave up. */
function buildDungeon(file: AnalyzedFile, plan: PlannedRoom[], seed: number, rng: Rng, attempt: number): Dungeon | string {
  // 2. Room sizes and positions, corridors between neighbours (in line with the entrance).
  const rooms = lineUpRooms(plan, rng, attempt);
  const first = rooms[0];
  const entrance = { x: first.x, y: first.y + Math.floor(first.h / 2) };
  const corridors: Rect[] = [];
  for (let i = 0; i + 1 < rooms.length; i++) {
    const corridor = corridorBetween(rooms[i], rooms[i + 1], entrance.y, rng);
    if (!corridor) return `rooms ${i + 1} and ${i + 2} do not line up for a corridor`;
    corridors.push(corridor);
  }
  const last = rooms[rooms.length - 1];
  const width = last.x + last.w + 1 + DUNGEON_MARGIN;
  const height = Math.max(...rooms.map((r) => r.y + r.h)) + 1 + DUNGEON_MARGIN;

  // 3. Exit, chest, and the tiles that must stay clear: around the
  //    entrance, corridor mouths, plaque reading spots, the chest.
  const exit = { x: first.x - 1, y: entrance.y };
  const chest = { x: last.x + last.w - 3, y: last.y + Math.floor(last.h / 2) };
  const keepClear = new Set<number>();
  const reserve = (p: Point) => keepClear.add(p.y * width + p.x);
  const reserveAround = (p: Point, r: number) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) reserve({ x: p.x + dx, y: p.y + dy });
  };
  reserveAround(entrance, 1);
  reserve(exit);
  for (const room of rooms) reserve({ x: plaqueSpot(room).x, y: room.y });
  for (const c of corridors) tilesOf({ x: c.x - 2, y: c.y, w: c.w + 4, h: c.h }).forEach(reserve);
  reserveAround(chest, 1);

  // 4. Monsters, room by room, left to right (the rooms are still open floor).
  const isFree = (p: Point) => !keepClear.has(p.y * width + p.x);
  const monsters: MonsterSpawn[] = [];
  for (let i = 0; i < rooms.length; i++) {
    const placed = placeRoomMonsters(plan[i], { room: rooms[i], entrance, chest, placed: monsters, isFree, rng });
    if (typeof placed === "string") return placed;
  }

  // 5. Interior walls, kept off the reserved tiles, the chest, and every
  //    monster with the floor around it and the caption carved under it.
  const keptOpen = [squareAround(chest, CHEST_MARGIN), ...monsters.flatMap(monsterSpace)];
  const walls = new Set<number>();
  for (let i = 0; i < rooms.length; i++) {
    const room = rooms[i];
    const level = plan[i].info.arena ? 0 : mazeLevel(plan[i].info.branches);
    const keptClear = (x: number, y: number) =>
      keepClear.has((room.y + y) * width + room.x + x) || keptOpen.some((r) => rectContains(r, room.x + x, room.y + y));
    const pieces = planInteriorWalls(room.w, room.h, level, keptClear, rng);
    // Branchy code must look tangled: when the monsters left no space for a single wall, try roomier rooms.
    if (level > 0 && pieces.length === 0 && attempt < MAZE_RETRIES) return `no space for the maze of room ${i + 1}`;
    for (const p of pieces) walls.add((room.y + p.y) * width + room.x + p.x);
  }

  // 6. Floors and walls.
  const map = carve(width, height, [...rooms, ...corridors], walls, exit, rng);

  // 7. Props, kept off monsters (and one tile around them) and reserved tiles.
  const busy = new Set(keepClear);
  for (const m of monsters) {
    for (const t of monsterFootprint(m)) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) busy.add((t.y + dy) * width + t.x + dx);
    }
  }
  const props = decorateDungeon(map, rooms, plan, busy, rng);
  const propAt = new Map(props.map((p) => [p.y * width + p.x, p]));

  // 8. The end door, with floor in front of it out of reach of every monster's carved
  //    line if possible, else clear of each monster and its caption band; no clutter.
  const floorOutside = (zones: Rect[]) => (p: Point) => isFloorTile(map.ground[p.y * width + p.x]) && !zones.some((r) => rectContains(r, p.x, p.y));
  const farFromCarvings = chooseEndDoor(last, chest.y, floorOutside(monsters.map(carvingReach)));
  const endDoor = farFromCarvings ?? chooseEndDoor(last, chest.y, floorOutside(monsters.flatMap(monsterSpace)));
  if (!endDoor) return "no free floor in front of the end door";
  setTile(map, endDoor.x, endDoor.y, Ground.DungeonExit, false);
  for (const t of endDoorLanding(endDoor)) propAt.delete(t.y * width + t.x);

  // 9. Repair: pots and crates must never wall off a monster, the chest or a way out.
  const repaired = clearBlockedPaths(
    map,
    entrance,
    [exit, chest, ...monsters, endDoor],
    () => solidPropTiles([...propAt.values()]),
    (p) => REMOVABLE.has(propAt.get(p.y * width + p.x)?.kind ?? "plaque"),
    (p) => propAt.delete(p.y * width + p.x),
  );
  if (!repaired) return "props walled something off and could not be cleared";

  return {
    ...map,
    path: file.path,
    seed,
    rooms,
    entrance,
    exit,
    endDoor,
    monsters,
    props: [...propAt.values()].sort((a, b) => a.y - b.y || a.x - b.x),
    chest,
    roomInfo: plan.map((p) => p.info),
  };
}

// ─────────────────────────── 2. Rooms ───────────────────────────

const isBig = (f: Finding) => MONSTERS[f.monster].size > 16;

/** Width of the back of an arena where its bosses wait. */
const bossZoneWidth = (bosses: number) => 2 + BOSS_COLUMN_W * Math.ceil(bosses / 2);

/** How big one planned room is, before the retry bonus. */
function roomSize(room: PlannedRoom, isFirst: boolean, rng: Rng): { w: number; h: number } {
  const jitter = randInt(rng, 0, 2);
  if (room.findings.length === 0) return { w: FOYER_W + jitter, h: ROOM_MIN_H };
  const entranceZone = isFirst ? ENTRANCE_ZONE_W : 0;
  // A longer function is a bigger room…
  const lengthW = clamp(ROOM_MIN_W + Math.round(room.lines / LINES_PER_COLUMN), ROOM_MIN_W, ROOM_MAX_W);
  const lengthH = clamp(ROOM_MIN_H + Math.floor(room.lines / LINES_PER_ROW), ROOM_MIN_H, ROOM_MAX_H);
  if (room.info.arena) {
    const bosses = room.findings.length;
    const w = Math.max(lengthW, ARENA_MIN_W + BOSS_COLUMN_W * (Math.ceil(bosses / 2) - 1));
    return { w: w + entranceZone + jitter, h: Math.max(lengthH, ARENA_MIN_H) + (bosses > 2 ? 2 : 0) };
  }
  // …and more (and bigger) monsters or maze walls need more floor.
  const big = room.findings.filter(isBig).length;
  const small = room.findings.length - big;
  const crowdW = ROOM_MIN_W + Math.max(0, small - 3) + 3 * big;
  const level = mazeLevel(room.info.branches);
  return { w: Math.max(lengthW, crowdW) + MAZE_EXTRA_W * level + entranceZone + jitter, h: Math.min(ROOM_MAX_H, lengthH + MAZE_EXTRA_H * level) };
}

/** Gives every room a size and lines them up left to right with corridor gaps in between. */
function lineUpRooms(plan: readonly PlannedRoom[], rng: Rng, attempt: number): Rect[] {
  const sizes = plan.map((room, i) => {
    const size = roomSize(room, i === 0, rng);
    return { w: size.w + attempt, h: size.h };
  });
  const maxH = Math.max(...sizes.map((s) => s.h));
  const top = DUNGEON_MARGIN + 2; // void margin, then a wall top and a wall face above the floor
  let x = DUNGEON_MARGIN + 1; // the first room's left wall sits right on the margin
  return sizes.map((s) => {
    const slack = maxH - s.h;
    const y = top + clamp(Math.floor(slack / 2) + randInt(rng, -1, 1), 0, slack);
    const room = { x, y, w: s.w, h: s.h };
    const gap = randInt(rng, CORRIDOR_GAP.min, CORRIDOR_GAP.max); // void columns between this room's wall and the next one's
    x += s.w + 1 + gap + 1;
    return room;
  });
}

/**
 * A 2-tile-tall corridor joining two neighbouring rooms through both of
 * their walls, on the entrance's row (`spineY`) where the rooms allow it,
 * so the way through the dungeon runs straight and is easy to find.
 */
function corridorBetween(a: Rect, b: Rect, spineY: number, rng: Rng): Rect | null {
  // Rows both rooms share, staying off each room's top and bottom floor row.
  const lo = Math.max(a.y, b.y) + 1;
  const hi = Math.min(a.y + a.h, b.y + b.h) - 2;
  if (hi - lo < 1) return null;
  const y = clamp(spineY - randInt(rng, 0, 1), lo, hi - 1);
  const x = a.x + a.w; // a's right wall
  return { x, y, w: b.x - x, h: 2 }; // up to and including b's left wall
}

// ─────────────────────────── 5. Carving ─────────────────────────

const isFloorTile = (g: number) => g === Ground.DungeonFloor || g === Ground.DungeonFloorAlt;

/**
 * Void everywhere, then floors (minus the interior walls), then walls
 * around the floors, then the front faces and wall tops. The exit doormat
 * is cut into the left wall.
 */
function carve(width: number, height: number, floors: Rect[], walls: ReadonlySet<number>, exit: Point, rng: Rng) {
  const map = createTileMap(width, height, Ground.DungeonVoid, true);
  const groundAt = (x: number, y: number) => (x >= 0 && y >= 0 && x < width && y < height ? map.ground[y * width + x] : Ground.DungeonVoid);

  for (const r of floors) {
    for (const t of tilesOf(r)) {
      const alt = chance(rng, 0.12); // always drawn, so the rng sequence does not depend on the walls
      if (!walls.has(t.y * width + t.x)) setTile(map, t.x, t.y, alt ? Ground.DungeonFloorAlt : Ground.DungeonFloor, false);
    }
  }
  // Walls: any void tile touching a floor tile, even diagonally (interior walls are void until now).
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (groundAt(x, y) !== Ground.DungeonVoid) continue;
      let touchesFloor = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) touchesFloor ||= isFloorTile(groundAt(x + dx, y + dy));
      if (touchesFloor) setTile(map, x, y, Ground.DungeonWall, true);
    }
  }
  setTile(map, exit.x, exit.y, Ground.DungeonExit, false);
  // Faces: walls with floor directly below show their front. Then give every face a wall top.
  const faces: Point[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (groundAt(x, y) === Ground.DungeonWall && isFloorTile(groundAt(x, y + 1))) faces.push({ x, y });
    }
  }
  for (const f of faces) setTile(map, f.x, f.y, Ground.DungeonWallFace, true);
  for (const f of faces) {
    for (let dx = -1; dx <= 1; dx++) {
      if (groundAt(f.x + dx, f.y - 1) === Ground.DungeonVoid) setTile(map, f.x + dx, f.y - 1, Ground.DungeonWall, true);
    }
  }
  return map;
}

// ─────────────────────────── 6. Monsters ────────────────────────

/** What every monster placement in one room needs to know. */
interface PlacementContext {
  room: Rect;
  entrance: Point;
  chest: Point;
  /** Monsters placed so far (in this room and earlier ones). */
  placed: MonsterSpawn[];
  /** False for reserved tiles. */
  isFree: (p: Point) => boolean;
  rng: Rng;
}

/** The square of tiles within `r` (Chebyshev) of `p`. */
function squareAround(p: Point, r: number): Rect {
  return { x: p.x - r, y: p.y - r, w: 2 * r + 1, h: 2 * r + 1 };
}

/** The floor a monster keeps free of interior walls: around its footprint, and its caption band. */
function monsterSpace(m: MonsterSpawn): Rect[] {
  return [
    squareAround(m, (MONSTERS[m.kind].size > 16 ? 1 : 0) + MONSTER_MARGIN),
    { x: m.x - CAPTION_HALF_W, y: m.y, w: 2 * CAPTION_HALF_W + 1, h: CAPTION_ROWS },
  ];
}

/** Where one group of a room's monsters goes: target columns spread from `lo` to `hi`, none left of `minX`. */
interface Spread {
  lo: number;
  hi: number;
  minX: number;
}

/**
 * Places one room's monsters in line order, spread left to right over the
 * room between the entrance zone and the chest's spot — or, in an arena,
 * over its back where the bosses wait away from the door. Returns the new
 * spawns, or why it failed.
 */
function placeRoomMonsters(room: PlannedRoom, ctx: PlacementContext): MonsterSpawn[] | string {
  const { x, w } = ctx.room;
  const right = rectContains(ctx.room, ctx.chest.x, ctx.chest.y) ? ctx.chest.x - CHEST_CLEARANCE : x + w - 1;
  const left = rectContains(ctx.room, ctx.entrance.x, ctx.entrance.y) ? ctx.entrance.x + ENTRANCE_CLEARANCE : x;
  const lo = room.info.arena ? Math.max(left, right + 1 - bossZoneWidth(room.findings.length)) : left;
  const out: MonsterSpawn[] = [];
  for (let order = 0; order < room.findings.length; order++) {
    const minX = order > 0 ? out[out.length - 1].x : -Infinity;
    const slot = { finding: room.findings[order], order, count: room.findings.length, spread: { lo, hi: right, minX } };
    // First try a spot with a free tile on every side (room for the floor carving), then any spot.
    const spawn = placeMonster(slot, ctx, true) ?? placeMonster(slot, ctx, false);
    if (!spawn) return `no room for the monster of ${slot.finding.id}`;
    out.push(spawn);
    ctx.placed.push(spawn);
  }
  return out;
}

/**
 * Picks a spot for one monster: the closest legal tile to its target. The
 * target column spreads the group evenly over its spread; the target row
 * alternates between an upper, a lower and a middle lane. Legal means: on
 * floor inside the room (3×3 for big monsters), not reserved, at least
 * `minX`, far enough from the entrance and from other monsters, and — when
 * `withMargin` — with room floor one tile beyond its footprint all round.
 */
function placeMonster(
  slot: { finding: Finding; order: number; count: number; spread: Spread },
  ctx: PlacementContext,
  withMargin: boolean,
): MonsterSpawn | null {
  const { room, entrance } = ctx;
  const kind = slot.finding.monster;
  const big = isBig(slot.finding) ? 1 : 0;
  const lo = Math.max(slot.spread.lo, room.x) + big;
  const hi = Math.max(lo, Math.min(slot.spread.hi, room.x + room.w - 1) - big);
  const targetX = lo + Math.round(((slot.order + 0.5) / slot.count) * (hi - lo));
  const lanes = [room.y + LANE_INSET + big, room.y + room.h - 1 - LANE_INSET - big, room.y + Math.floor(room.h / 2)];
  const targetY = lanes[slot.order % lanes.length];

  let best: MonsterSpawn | null = null;
  let bestCost = Infinity;
  for (const t of tilesOf(room)) {
    if (t.x < slot.spread.minX) continue;
    if (chebyshev(t, entrance) < ENTRANCE_CLEARANCE + big) continue;
    const candidate: MonsterSpawn = { findingId: slot.finding.id, kind, x: t.x, y: t.y };
    if (!monsterFootprint(candidate).every((p) => rectContains(room, p.x, p.y) && ctx.isFree(p))) continue;
    if (withMargin && !insideRoom(t, big + MONSTER_MARGIN, room)) continue;
    if (ctx.placed.some((m) => chebyshev(m, t) < monsterSpacing(m.kind, kind))) continue;
    const cost = 2 * Math.abs(t.x - targetX) + Math.abs(t.y - targetY) + ctx.rng() * 0.5;
    if (cost < bestCost) {
      bestCost = cost;
      best = candidate;
    }
  }
  return best;
}

/** True when every tile within `radius` (Chebyshev) of `t` lies inside the room. */
function insideRoom(t: Point, radius: number, room: Rect): boolean {
  return rectContains(room, t.x - radius, t.y - radius) && rectContains(room, t.x + radius, t.y + radius);
}
