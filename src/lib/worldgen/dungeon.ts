/**
 * generateDungeon: one AnalyzedFile → Dungeon.
 *
 * A dungeon reads like its file: top of the file = left of the dungeon.
 * A real one (renderAscii; legend in ascii.ts), 3 regular monsters + a boss:
 *
 *     ###############    ################
 *     #=P=^===^===^=#    #==^===^===^===#     # wall top, = wall face, ^ torch
 *     #x.......,....######.....,.......w#     P plaque with the file path
 *     #,...,.1..,...======,.............#
 *     #.............,.,....,.....3......#     1 2 3 minion / elite / boss
 *     #,....,,,.,.,..,..................#     (the corridor is 2 tiles tall)
 *     <@........,.1.######.....,.....C,.#     < exit, @ entrance, C chest
 *     #,...........,#    #............,.#
 *     #.........2..,#    #......,.......#
 *     #.........,..x#    #........,..,..#     p pot, x crate, w web
 *     ###############    #p,.........,.p#
 *                        ################
 *      room 1              boss arena
 *
 * 1. Split the findings (in line order) over 1–4 rooms, about one room per
 *    3–4 monsters. Boss findings always wait in the last room, a bigger arena.
 * 2. Size the rooms, line them up left to right with short 2-tile-tall
 *    corridors between them.
 * 3. Carve floors, then derive the walls: every tile next to a floor is a
 *    wall, a wall with floor right below it shows its front face, and the
 *    faces get a wall top above them (the classic 3/4 top-down look).
 * 4. Entrance + exit doormat on the left wall of room 1, the file's plaque
 *    above it, the chest near the right end of the last room.
 * 5. Monsters at evenly spread spots, left to right in line order.
 * 6. Torches, pots, crates, bones, webs and the odd crystal for flavour.
 * 7. Repair + validate: everything important must be reachable on foot.
 */
import { Ground, type AnalyzedFile, type Dungeon, type Finding, type MonsterSpawn, type Point, type Prop, type PropKind, type Rect } from "@/lib/types";
import { MONSTERS } from "@/lib/game/catalog";
import { chance, hashString, mulberry32, pick, randInt, shuffled, type Rng } from "@/lib/rng";
import { chebyshev, clamp, createTileMap, rectContains, setTile, tilesOf } from "./grid";
import { clearBlockedPaths, solidPropTiles } from "./reachability";
import { compareText } from "./regions";
import { DUNGEON_MARGIN, dungeonProblems, monsterFootprint, monsterSpacing } from "./validate";

const MAX_ROOMS = 4;
const MAX_ATTEMPTS = 8;
/** Monsters never start closer than this (Chebyshev) to the entrance. */
const ENTRANCE_CLEARANCE = 5;

/** Breakable or decorative dungeon props that the repair step may remove. */
// Prop variants that mean something specific in the art (see src/game/art/props.ts).
const TORCH_WALL_SCONCE = 1;
const WEB_TOP_LEFT = 0;
const WEB_TOP_RIGHT = 1;

const REMOVABLE: ReadonlySet<PropKind> = new Set<PropKind>(["pot", "crate", "crystal", "bones", "web"]);

export function generateDungeon(file: AnalyzedFile, repoSeed: number): Dungeon {
  const seed = hashString(`${repoSeed}:${file.path}`);
  let problems: string[] = [];
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = mulberry32((seed + Math.imul(attempt, 0x9e3779b9)) >>> 0);
    // Each retry makes the rooms a little roomier, so a crowded file always fits eventually.
    const dungeon = buildDungeon(file, seed, rng, attempt);
    problems = typeof dungeon === "string" ? [dungeon] : dungeonProblems(dungeon, file);
    if (typeof dungeon !== "string" && problems.length === 0) return dungeon;
  }
  throw new Error(`Could not generate a dungeon for ${file.path}: ${problems.slice(0, 3).join("; ")}`);
}

/** One generation attempt. Returns the dungeon, or the reason the attempt gave up. */
function buildDungeon(file: AnalyzedFile, seed: number, rng: Rng, attempt: number): Dungeon | string {
  // 1. Who goes in which room.
  const findings = [...file.findings].sort((a, b) => a.line - b.line || a.col - b.col || compareText(a.id, b.id));
  const bosses = findings.filter((f) => f.severity === "boss");
  const regulars = findings.filter((f) => f.severity !== "boss");
  const groups = assignToRooms(regulars, bosses);

  // 2. Room sizes and positions, corridors between neighbours.
  const rooms = lineUpRooms(groups, bosses.length > 0, rng, attempt);
  const corridors: Rect[] = [];
  for (let i = 0; i + 1 < rooms.length; i++) {
    const corridor = corridorBetween(rooms[i], rooms[i + 1], rng);
    if (!corridor) return `rooms ${i + 1} and ${i + 2} do not line up for a corridor`;
    corridors.push(corridor);
  }
  const last = rooms[rooms.length - 1];
  const width = last.x + last.w + 1 + DUNGEON_MARGIN;
  const height = Math.max(...rooms.map((r) => r.y + r.h)) + 1 + DUNGEON_MARGIN;

  // 3. Floors and walls.
  const first = rooms[0];
  const entrance = { x: first.x, y: first.y + Math.floor(first.h / 2) };
  const exit = { x: first.x - 1, y: entrance.y };
  const map = carve(width, height, [...rooms, ...corridors], exit, rng);

  // 4. Reserved tiles: around the entrance, corridor mouths, the plaque's reading spot, the chest.
  const keepClear = new Set<number>();
  const reserve = (p: Point) => keepClear.add(p.y * width + p.x);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) reserve({ x: entrance.x + dx, y: entrance.y + dy });
  reserve(exit);
  const plaque = { x: first.x + 1, y: first.y - 1 };
  reserve({ x: plaque.x, y: plaque.y + 1 });
  for (const c of corridors) tilesOf({ x: c.x - 2, y: c.y, w: c.w + 4, h: c.h }).forEach(reserve);
  const chest = { x: last.x + last.w - 3, y: last.y + Math.floor(last.h / 2) };
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) reserve({ x: chest.x + dx, y: chest.y + dy });

  // 5. Monsters, room by room, left to right.
  const monsters: MonsterSpawn[] = [];
  for (let i = 0; i < rooms.length; i++) {
    for (const finding of groups[i]) {
      const spawn = placeMonster(finding, rooms[i], groups[i], monsters, entrance, (p) => !keepClear.has(p.y * width + p.x), rng);
      if (!spawn) return `no room for the monster of ${finding.id}`;
      monsters.push(spawn);
    }
  }

  // 6. Flavour props, kept off monsters (and one tile around them) and reserved tiles.
  const busy = new Set(keepClear);
  for (const m of monsters) {
    for (const t of monsterFootprint(m)) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) busy.add((t.y + dy) * width + t.x + dx);
    }
  }
  const props = decorate(map, rooms, plaque, file.path, busy, rng);

  // 7. Repair: pots and crates must never wall off a monster, the chest or the exit.
  const propAt = new Map(props.map((p) => [p.y * width + p.x, p]));
  const repaired = clearBlockedPaths(
    map,
    entrance,
    [exit, chest, ...monsters],
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
    monsters,
    props: [...propAt.values()].sort((a, b) => a.y - b.y || a.x - b.x),
    chest,
  };
}

// ─────────────────────────── 1. Rooms ───────────────────────────

/**
 * Splits the findings over rooms. Regular monsters are dealt out in line
 * order, in contiguous chunks; the first room gets the smallest chunk because
 * the area around the entrance stays monster-free. Bosses go to the last room.
 */
function assignToRooms(regulars: Finding[], bosses: Finding[]): Finding[][] {
  const total = regulars.length + bosses.length;
  let roomCount = clamp(Math.ceil(total / 3.5), 1, MAX_ROOMS);
  // A boss deserves its own arena when there is anything else to fight first.
  if (bosses.length > 0 && regulars.length > 0) roomCount = Math.max(roomCount, 2);

  const groups: Finding[][] = Array.from({ length: roomCount }, () => []);
  const regularRooms = bosses.length > 0 && roomCount > 1 ? roomCount - 1 : roomCount;
  const n = regulars.length;
  regulars.forEach((finding, i) => {
    // Chunk index counted from the back, so the bigger chunks land in later rooms.
    const room = regularRooms - 1 - Math.floor(((n - 1 - i) * regularRooms) / n);
    groups[room].push(finding);
  });
  groups[roomCount - 1].push(...bosses);
  return groups;
}

const isBig = (f: Finding) => MONSTERS[f.monster].size > 16;

/** Gives every room a size and lines them up left to right with corridor gaps in between. */
function lineUpRooms(groups: Finding[][], hasBoss: boolean, rng: Rng, attempt: number): Rect[] {
  const sizes = groups.map((group, i) => {
    const big = group.filter(isBig).length;
    const small = group.length - big;
    const isFirst = i === 0;
    const isArena = hasBoss && i === groups.length - 1;
    // Wider for more (and bigger) monsters; room 1 also needs the monster-free entrance zone.
    let w = 9 + Math.max(0, small - 3) + 3 * big + (isFirst ? 4 : 0) + randInt(rng, 0, 2) + attempt;
    let h = randInt(rng, 7, 9);
    if (isArena) {
      w = Math.max(w, 13 + randInt(rng, 0, 2), 6 + 4 * Math.ceil(big / 2));
      h = Math.max(h, 9) + (big > 4 ? 2 : 0);
    }
    return { w, h };
  });

  const maxH = Math.max(...sizes.map((s) => s.h));
  const top = DUNGEON_MARGIN + 2; // void margin, then a wall top and a wall face above the floor
  let x = DUNGEON_MARGIN + 1; // the first room's left wall sits right on the margin
  return sizes.map((s) => {
    const slack = maxH - s.h;
    const y = top + clamp(Math.floor(slack / 2) + randInt(rng, -1, 1), 0, slack);
    const room = { x, y, w: s.w, h: s.h };
    const gap = randInt(rng, 2, 4); // void columns between this room's wall and the next one's
    x += s.w + 1 + gap + 1;
    return room;
  });
}

/** A 2-tile-tall corridor joining two neighbouring rooms through both of their walls. */
function corridorBetween(a: Rect, b: Rect, rng: Rng): Rect | null {
  // Rows both rooms share, staying off each room's top and bottom floor row.
  const lo = Math.max(a.y, b.y) + 1;
  const hi = Math.min(a.y + a.h, b.y + b.h) - 2;
  if (hi - lo < 1) return null;
  const y = lo + randInt(rng, 0, hi - lo - 1);
  const x = a.x + a.w; // a's right wall
  return { x, y, w: b.x - x, h: 2 }; // up to and including b's left wall
}

// ─────────────────────────── 3. Carving ─────────────────────────

const isFloorTile = (g: number) => g === Ground.DungeonFloor || g === Ground.DungeonFloorAlt;

/**
 * Void everywhere, then floors, then walls around the floors, then the
 * front faces and wall tops. The exit doormat is cut into the left wall.
 */
function carve(width: number, height: number, floors: Rect[], exit: Point, rng: Rng) {
  const map = createTileMap(width, height, Ground.DungeonVoid, true);
  const groundAt = (x: number, y: number) => (x >= 0 && y >= 0 && x < width && y < height ? map.ground[y * width + x] : Ground.DungeonVoid);

  for (const r of floors) {
    for (const t of tilesOf(r)) setTile(map, t.x, t.y, chance(rng, 0.12) ? Ground.DungeonFloorAlt : Ground.DungeonFloor, false);
  }
  // Walls: any void tile touching a floor tile, even diagonally.
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

// ─────────────────────────── 5. Monsters ────────────────────────

/**
 * Picks a spot for one monster. Monsters are spread evenly across the room
 * in line order (target column), alternating between an upper, a lower and a
 * middle lane; the closest legal tile to that target wins. Legal means: on
 * floor inside the room (3×3 for big monsters), not reserved, far enough from
 * the entrance and from other monsters, and not left of the previous monster
 * in the room (so the room still reads top-to-bottom = left-to-right).
 */
function placeMonster(
  finding: Finding,
  room: Rect,
  group: Finding[],
  placed: MonsterSpawn[],
  entrance: Point,
  isFree: (p: Point) => boolean,
  rng: Rng,
): MonsterSpawn | null {
  const kind = finding.monster;
  const big = isBig(finding) ? 1 : 0;
  const order = group.indexOf(finding);
  const inRoom = placed.filter((m) => rectContains(room, m.x, m.y));
  const minX = inRoom.length > 0 ? inRoom[inRoom.length - 1].x : -Infinity;

  const lo = Math.max(room.x + big, rectContains(room, entrance.x, entrance.y) ? entrance.x + ENTRANCE_CLEARANCE + big : -Infinity);
  const hi = room.x + room.w - 1 - big;
  const targetX = lo + Math.round(((order + 0.5) / group.length) * (hi - lo));
  const lanes = [room.y + 1 + big, room.y + room.h - 2 - big, room.y + Math.floor(room.h / 2)];
  const targetY = lanes[order % lanes.length];

  let best: MonsterSpawn | null = null;
  let bestCost = Infinity;
  for (const t of tilesOf(room)) {
    const candidate: MonsterSpawn = { findingId: finding.id, kind, x: t.x, y: t.y };
    if (t.x < minX) continue;
    if (chebyshev(t, entrance) < ENTRANCE_CLEARANCE + big) continue;
    if (!monsterFootprint(candidate).every((p) => rectContains(room, p.x, p.y) && isFree(p))) continue;
    if (placed.some((m) => chebyshev(m, t) < monsterSpacing(m.kind, kind))) continue;
    const cost = 2 * Math.abs(t.x - targetX) + Math.abs(t.y - targetY) + rng() * 0.5;
    if (cost < bestCost) {
      bestCost = cost;
      best = candidate;
    }
  }
  return best;
}

// ─────────────────────────── 6. Props ───────────────────────────

/** Torches on the wall faces, the file's plaque, pot/crate clusters in corners, bones, webs, crystals. */
function decorate(
  map: { width: number; height: number; ground: Uint8Array },
  rooms: Rect[],
  plaque: Point,
  path: string,
  busy: Set<number>,
  rng: Rng,
): Prop[] {
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

  add("plaque", plaque, false, path);

  for (const room of rooms) {
    const x0 = room.x;
    const y0 = room.y;
    const x1 = room.x + room.w - 1;
    const y1 = room.y + room.h - 1;

    // Torches every ~4 tiles along the top wall's face.
    for (let x = x0 + randInt(rng, 2, 3); x <= x1 - 1; x += 4) {
      const p = { x, y: y0 - 1 };
      if (groundAt(p) === Ground.DungeonWallFace && !(p.x === plaque.x && p.y === plaque.y)) add("torch", p, false, undefined, TORCH_WALL_SCONCE);
    }

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
      for (const p of cluster) if (freeFloor(p)) add(kind, p, true);
    }

    // Cobwebs in the top corners, a few bones, sometimes a glowing crystal by the bottom wall.
    for (const corner of [{ x: x0, y: y0, variant: WEB_TOP_LEFT }, { x: x1, y: y0, variant: WEB_TOP_RIGHT }]) {
      if (chance(rng, 0.5) && freeFloor(corner)) add("web", corner, false, undefined, corner.variant);
    }
    for (let i = randInt(rng, 0, 2); i > 0; i--) {
      const p = { x: randInt(rng, x0, x1), y: randInt(rng, y0, y1) };
      if (freeFloor(p)) add("bones", p, false);
    }
    if (chance(rng, 0.3)) {
      const p = { x: randInt(rng, x0 + 1, x1 - 1), y: y1 };
      if (freeFloor(p)) add("crystal", p, true);
    }
  }
  return [...props.values()];
}
