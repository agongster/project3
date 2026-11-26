/**
 * Invariant checks for generated worlds.
 *
 * The generators run these on every attempt (and retry if anything is
 * wrong), the tests run them on hundreds of fuzzed repos, and the engine can
 * run them in development builds as a sanity check. Each function returns a
 * list of human-readable problems; an empty list means "all good".
 */
import { definitionAt } from "@/lib/analysis/outline";
import { Ground, MONSTER_KINDS, type AnalyzedFile, type Dungeon, type Overworld, type Point, type PropKind } from "@/lib/types";
import { MONSTERS } from "@/lib/game/catalog";
import { chebyshev, inBounds, rectContains, rectsOverlap, tilesOf } from "./grid";
import { reachableFrom, solidPropTiles } from "./reachability";
import { clipText, MAX_LABEL_CHARS, MAX_NAME_CHARS } from "./roomPlan";

/** Props the player interacts with by standing on the tile directly south of them. */
const FACED_PROPS: ReadonlySet<PropKind> = new Set<PropKind>(["well", "wardrobe", "board", "fountain", "sign"]);

const at = (p: Point) => `(${p.x},${p.y})`;

// ─────────────────────────── Overworld ──────────────────────────

/**
 * Tiles that must be reachable from spawn: doors, the fronts of landmarks,
 * signs and file stumps (so they can be read), villager fronts, and spawn.
 */
export function overworldTargets(world: Pick<Overworld, "buildings" | "props" | "npcs" | "spawn">): Point[] {
  const readable = world.props.filter((p) => FACED_PROPS.has(p.kind) || (p.kind === "stump" && p.text !== undefined));
  return [
    world.spawn,
    ...world.buildings.map((b) => b.door),
    ...readable.map((p) => ({ x: p.x, y: p.y + 1 })),
    ...world.npcs.map((n) => ({ x: n.x, y: n.y + 1 })),
  ];
}

export function overworldProblems(world: Overworld, analysis?: { files: readonly AnalyzedFile[] }): string[] {
  const problems: string[] = [];
  const { width, height } = world;
  const idx = (p: Point) => p.y * width + p.x;

  if (world.ground.length !== width * height || world.solid.length !== width * height) {
    return ["ground/solid arrays do not match width × height"];
  }

  // Everything inside the map.
  const points: [string, Point][] = [
    ["spawn", world.spawn],
    ...world.buildings.flatMap((b): [string, Point][] => [
      [`building ${b.path}`, b],
      [`building ${b.path} corner`, { x: b.x + b.w - 1, y: b.y + b.h - 1 }],
      [`door of ${b.path}`, b.door],
    ]),
    ...world.props.map((p): [string, Point] => [`${p.kind} prop`, p]),
    ...world.npcs.map((n): [string, Point] => [`villager ${n.name}`, n]),
  ];
  for (const [what, p] of points) {
    if (!inBounds(world, p.x, p.y)) problems.push(`${what} ${at(p)} is outside the map`);
  }
  if (problems.length > 0) return problems;

  // Buildings: solid footprints, doors right below the centre, never touching each other.
  for (const b of world.buildings) {
    const expectedDoor = { x: b.x + Math.floor((b.w - 1) / 2), y: b.y + b.h };
    if (b.door.x !== expectedDoor.x || b.door.y !== expectedDoor.y) problems.push(`door of ${b.path} is not centred below it`);
    for (let y = b.y; y < b.y + b.h; y++) {
      for (let x = b.x; x < b.x + b.w; x++) {
        if (!world.solid[y * width + x]) problems.push(`footprint of ${b.path} is not solid at ${at({ x, y })}`);
      }
    }
  }
  for (let i = 0; i < world.buildings.length; i++) {
    for (let j = i + 1; j < world.buildings.length; j++) {
      const a = world.buildings[i];
      const b = world.buildings[j];
      if (rectsOverlap(a, b, 1)) problems.push(`buildings ${a.path} and ${b.path} overlap or touch`);
      if (rectContains(a, b.door.x, b.door.y) || rectContains(b, a.door.x, a.door.y)) {
        problems.push(`a building covers the door of ${a.path} or ${b.path}`);
      }
    }
  }

  // Props: one per tile, never on paths, doors or the spawn.
  const propTiles = new Set<number>();
  const doorTiles = new Set(world.buildings.map((b) => idx(b.door)));
  for (const p of world.props) {
    if (propTiles.has(idx(p))) problems.push(`two props share ${at(p)}`);
    propTiles.add(idx(p));
    const g = world.ground[idx(p)];
    if (g === Ground.Path || g === Ground.Bridge) problems.push(`${p.kind} stands on a path at ${at(p)}`);
    if (doorTiles.has(idx(p))) problems.push(`${p.kind} blocks a door at ${at(p)}`);
  }
  if (propTiles.has(idx(world.spawn))) problems.push("a prop stands on the spawn tile");
  for (const n of world.npcs) {
    if (propTiles.has(idx(n)) || doorTiles.has(idx(n))) problems.push(`villager ${n.name} stands on a prop or door`);
    if (n.lines.length < 1 || n.lines.length > 3) problems.push(`villager ${n.name} has ${n.lines.length} lines`);
  }
  if (world.npcs.length < 3 || world.npcs.length > 6) problems.push(`${world.npcs.length} villagers (expected 3–6)`);
  for (const kind of ["well", "wardrobe", "board", "fountain"] as const) {
    if (world.props.filter((p) => p.kind === kind).length !== 1) problems.push(`expected exactly one ${kind}`);
  }

  // Reachability: walk from spawn with solid props and villagers in the way.
  const blockers = [...solidPropTiles(world.props), ...world.npcs];
  const reach = reachableFrom(world, world.spawn, blockers);
  for (const target of overworldTargets(world)) {
    if (!reach[idx(target)]) problems.push(`${at(target)} cannot be reached from spawn`);
  }

  if (analysis) problems.push(...fileCoverageProblems(world, analysis.files));
  return problems;
}

/** Every file is shown exactly once: as a building, a lantern or a stump. */
function fileCoverageProblems(world: Overworld, files: readonly AnalyzedFile[]): string[] {
  const shown = new Map<string, number>();
  const count = (path: string) => shown.set(path, (shown.get(path) ?? 0) + 1);
  world.buildings.forEach((b) => count(b.path));
  world.props.filter((p) => (p.kind === "lantern" || p.kind === "stump") && p.text !== undefined).forEach((p) => count(p.text as string));
  const problems: string[] = [];
  for (const f of files) {
    const n = shown.get(f.path) ?? 0;
    if (n !== 1) problems.push(`${f.path} is shown ${n} times`);
  }
  if (shown.size !== files.length) problems.push("something is shown for a file that does not exist");
  return problems;
}

// ──────────────────────────── Dungeon ───────────────────────────

/** Margin of void tiles around every dungeon. */
export const DUNGEON_MARGIN = 2;

const isFloor = (g: number) => g === Ground.DungeonFloor || g === Ground.DungeonFloorAlt;

/** Tiles a monster occupies for placement purposes: its own tile, or the 3×3 around it for big ones. */
export function monsterFootprint(m: { x: number; y: number; kind: keyof typeof MONSTERS }): Point[] {
  if (MONSTERS[m.kind].size === 16) return [{ x: m.x, y: m.y }];
  const out: Point[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) out.push({ x: m.x + dx, y: m.y + dy });
  return out;
}

/** How far apart (Chebyshev) two monsters' tiles must be. */
export function monsterSpacing(a: keyof typeof MONSTERS, b: keyof typeof MONSTERS): number {
  return 2 + (MONSTERS[a].size > 16 ? 1 : 0) + (MONSTERS[b].size > 16 ? 1 : 0);
}

export function dungeonProblems(dungeon: Dungeon, file?: AnalyzedFile): string[] {
  const problems: string[] = [];
  const { width, height, ground, solid } = dungeon;
  const idx = (p: Point) => p.y * width + p.x;
  const g = (x: number, y: number) => (inBounds(dungeon, x, y) ? ground[y * width + x] : Ground.DungeonVoid);

  if (ground.length !== width * height || solid.length !== width * height) return ["ground/solid arrays do not match width × height"];
  const points = [dungeon.entrance, dungeon.exit, dungeon.chest, ...dungeon.monsters, ...dungeon.props];
  if (points.some((p) => !inBounds(dungeon, p.x, p.y))) return ["something lies outside the dungeon"];

  // Tiles: solidity matches the tile kind, wall faces exactly where a wall has floor below.
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = g(x, y);
      const walkable = isFloor(t) || t === Ground.DungeonExit;
      if (walkable === (solid[y * width + x] === 1)) problems.push(`tile ${at({ x, y })} has the wrong solidity`);
      const isWall = t === Ground.DungeonWall || t === Ground.DungeonWallFace;
      if (isWall && (t === Ground.DungeonWallFace) !== isFloor(g(x, y + 1))) problems.push(`wall face rule broken at ${at({ x, y })}`);
      if (t !== Ground.DungeonVoid) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  const m = DUNGEON_MARGIN;
  if (minX !== m || minY !== m || maxX !== width - 1 - m || maxY !== height - 1 - m) {
    problems.push(`dungeon is not tight: content spans x ${minX}..${maxX}, y ${minY}..${maxY} in a ${width}×${height} map`);
  }

  // Entrance and exit.
  if (!isFloor(g(dungeon.entrance.x, dungeon.entrance.y))) problems.push("entrance is not a floor tile");
  if (g(dungeon.exit.x, dungeon.exit.y) !== Ground.DungeonExit) problems.push("exit is not a DungeonExit tile");
  if (Math.abs(dungeon.exit.x - dungeon.entrance.x) + Math.abs(dungeon.exit.y - dungeon.entrance.y) !== 1) problems.push("exit is not next to the entrance");

  // Props: one per tile.
  const propAt = new Map(dungeon.props.map((p) => [idx(p), p]));
  if (propAt.size !== dungeon.props.length) problems.push("two props share a tile");
  const solidProps = new Set(dungeon.props.filter((p) => p.solid).map(idx));

  // Monsters: one per finding, on clear floor, spaced out, away from the entrance.
  if (file) {
    const ids = dungeon.monsters.map((mo) => mo.findingId).sort();
    const expected = file.findings.map((f) => f.id).sort();
    if (ids.join("\n") !== expected.join("\n")) problems.push("monsters do not match the findings one-to-one");
  }
  dungeon.monsters.forEach((mo, i) => {
    if (!MONSTER_KINDS.includes(mo.kind)) problems.push(`unknown monster kind ${mo.kind}`);
    if (propAt.has(idx(mo))) problems.push(`monster ${at(mo)} stands on a prop`);
    for (const t of monsterFootprint(mo)) {
      if (!isFloor(g(t.x, t.y)) || solidProps.has(idx(t))) problems.push(`monster ${at(mo)} does not have room at ${at(t)}`);
    }
    if (chebyshev(mo, dungeon.entrance) < 5) problems.push(`monster ${at(mo)} is too close to the entrance`);
    for (const other of dungeon.monsters.slice(i + 1)) {
      if (chebyshev(mo, other) < monsterSpacing(mo.kind, other.kind)) problems.push(`monsters ${at(mo)} and ${at(other)} are too close`);
    }
  });

  // Chest: clear floor away from walls.
  const c = dungeon.chest;
  if (propAt.has(idx(c)) || dungeon.monsters.some((mo) => mo.x === c.x && mo.y === c.y)) problems.push("chest tile is occupied");
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!isFloor(g(c.x + dx, c.y + dy))) problems.push("chest is not away from the walls");
    }
  }

  // Reachability from the entrance with solid props in the way.
  const reach = reachableFrom(dungeon, dungeon.entrance, solidPropTiles(dungeon.props));
  for (const target of [dungeon.exit, dungeon.chest, ...dungeon.monsters]) {
    if (!reach[idx(target)]) problems.push(`${at(target)} cannot be reached from the entrance`);
  }
  problems.push(...roomProblems(dungeon, file));
  return problems;
}

/**
 * The rules of rooms that stand for code (see roomPlan.ts and roomMaze.ts):
 * one info per room, rooms left to right in source order, short labels,
 * open arenas, no passage narrower than 2 tiles, and every monster standing
 * in the room of the code its finding is in.
 */
function roomProblems(dungeon: Dungeon, file?: AnalyzedFile): string[] {
  const problems: string[] = [];
  const { rooms, roomInfo } = dungeon;
  if (roomInfo.length !== rooms.length) return [`${roomInfo.length} room infos for ${rooms.length} rooms`];
  const floorAt = (x: number, y: number) => inBounds(dungeon, x, y) && isFloor(dungeon.ground[y * dungeon.width + x]);

  roomInfo.forEach((info, i) => {
    if (i > 0 && rooms[i].x <= rooms[i - 1].x + rooms[i - 1].w) problems.push(`room ${i + 1} is not right of room ${i}`);
    if (i > 0 && info.kind === "function" && info.line < roomInfo[i - 1].line) problems.push(`room ${i + 1} (${info.label}) breaks source order`);
    if ((info.kind === "module") !== (info.names.length === 0)) problems.push(`room ${i + 1} has the wrong names for a ${info.kind} room`);
    if (Array.from(info.label).length > MAX_LABEL_CHARS) problems.push(`room ${i + 1} has an unclipped label`);
    if (info.arena && tilesOf(rooms[i]).some((t) => !floorAt(t.x, t.y))) problems.push(`arena ${i + 1} has interior walls`);
  });
  if (roomInfo.length > 0 && roomInfo[0].kind !== "module") problems.push("the first room is not the entry hall");

  // No passage narrower than 2 tiles: every floor tile is part of a 2×2 square of floor.
  for (let y = 0; y < dungeon.height; y++) {
    for (let x = 0; x < dungeon.width; x++) {
      if (!floorAt(x, y)) continue;
      const square = (sx: number, sy: number) => floorAt(sx, sy) && floorAt(sx + 1, sy) && floorAt(sx, sy + 1) && floorAt(sx + 1, sy + 1);
      if (!square(x - 1, y - 1) && !square(x, y - 1) && !square(x - 1, y) && !square(x, y)) problems.push(`passage at ${at({ x, y })} is narrower than 2 tiles`);
    }
  }

  // Every monster stands inside a room: the one for the code its finding is in.
  const findings = new Map((file?.findings ?? []).map((f) => [f.id, f]));
  for (const m of dungeon.monsters) {
    const room = rooms.findIndex((r) => rectContains(r, m.x, m.y));
    if (room === -1) {
      problems.push(`monster ${at(m)} is not inside a room`);
      continue;
    }
    const finding = findings.get(m.findingId);
    if (!file || !finding) continue;
    const definition = definitionAt(file.outline, finding.line);
    const info = roomInfo[room];
    const rightRoom = definition ? info.names.includes(clipText(definition.name, MAX_NAME_CHARS)) : info.kind === "module";
    if (!rightRoom) problems.push(`monster of line ${finding.line} is not in the room of ${definition?.name ?? "the module"}`);
  }
  return problems;
}
