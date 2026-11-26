/**
 * generateOverworld: RepoAnalysis → Overworld.
 *
 * The recipe, top to bottom (each step lives in its own file):
 *
 *   1. regions.ts   decide which file goes in which region, and what it becomes
 *   2. layout.ts    arrange each region's lots (buildings, lanterns, stumps) and streets
 *   3. packing.ts   put a pond and the regions around Town Square
 *   4. here         stamp everything onto one big map, inside a forest ring
 *   5. town.ts      furnish Town Square: fountain, well, wardrobe, notice board
 *   6. water.ts     dig the pond and a little river flowing through it
 *   7. paths.ts     connect every region to the town with 2-wide roads
 *                   (bridges where they cross the river)
 *   8. placement.ts signposts and villagers
 *   9. nature.ts    meadows, groves, lamps, bushes, flowers...
 *  10. here         repair: make sure decorations never wall anything off
 *
 * Generation is deterministic: the seed is a hash of "owner/repo@sha" and all
 * randomness comes from a seeded generator. If a (very unlucky) attempt
 * breaks an invariant, we retry with a derived seed, which is still
 * deterministic.
 */
import { Ground, type Building, type Overworld, type Point, type Rect, type Region, type RepoAnalysis } from "@/lib/types";
import { hashString, mulberry32, randInt, type Rng } from "@/lib/rng";
import { Tag, WorldCanvas } from "./canvas";
import { rectCenter, rectContains, tilesOf } from "./grid";
import { Cell, layoutBlock, openGate, type BlockLayout, type Gate, type Side } from "./layout";
import {
  BORDER,
  decorateYard,
  fringeBorderForest,
  lineRoadsWithLamps,
  paintMeadows,
  plantBorderForest,
  plantGroves,
  REMOVABLE_DECOR,
  scatterBushes,
  scatterSmallThings,
} from "./nature";
import { packAroundCenter } from "./packing";
import { findRoad } from "./paths";
import { placeSign, placeVillagers } from "./placement";
import { clearBlockedPaths } from "./reachability";
import { isMarker, planRegions, signText, type RegionPlan } from "./regions";
import { furnishTownSquare } from "./town";
import { overworldProblems, overworldTargets } from "./validate";
import { writeVillagers } from "./villagers";
import { digPond, rimWithSand, runRiver } from "./water";

/** Free tiles between neighbouring regions: room for a road, lamps and trees. */
const REGION_GAP = 5;
/** Grass between the outermost regions and the forest ring, so roads can go around. */
const OUTER_MARGIN = 3;
/** Small repos still get room to wander. */
const MIN_WIDTH = 40;
const MIN_HEIGHT = 30;
/** Retries are a safety net only: in fuzzing, first attempts have always succeeded. */
const MAX_ATTEMPTS = 6;

/** One region while it is being built: its plan, its local layout and where it ended up. */
interface Village {
  plan: RegionPlan;
  layout: BlockLayout;
  /** Absolute position on the map. */
  rect: Rect;
  /** Where this region's road starts (absolute). Town Square has none. */
  gate: Point;
}

export function generateOverworld(analysis: RepoAnalysis): Overworld {
  const { owner, repo, sha } = analysis.repo;
  const seed = hashString(`${owner}/${repo}@${sha}`);
  let problems: string[] = [];
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = mulberry32((seed + Math.imul(attempt, 0x9e3779b9)) >>> 0);
    const world = buildOverworld(analysis, seed, rng);
    problems = typeof world === "string" ? [world] : overworldProblems(world, analysis);
    if (typeof world !== "string" && problems.length === 0) return world;
  }
  throw new Error(`Could not generate an overworld for ${owner}/${repo}: ${problems.slice(0, 3).join("; ")}`);
}

/** One generation attempt. Returns the world, or the reason the attempt gave up. */
function buildOverworld(analysis: RepoAnalysis, seed: number, rng: Rng): Overworld | string {
  // 1–2. Regions and their inner layouts. plans[0] is always Town Square.
  const plans = planRegions(analysis.files);
  const layouts = plans.map((plan) => layoutBlock(plan.lots, rng, plan.isTown));

  // 3. Packing: the pond goes first, right beside the town, so the river through it
  //    tends to run between villages (and roads get bridges). Then regions, largest first.
  const pondSize = analysis.files.length > 60 ? { w: 10, h: 7 } : { w: 8, h: 6 };
  const blocks = plans.map((plan, i) => ({ id: plan.id, w: layouts[i].w, h: layouts[i].h }));
  const others = blocks.slice(1).sort((a, b) => b.w * b.h - a.w * a.h);
  const packed = packAroundCenter(blocks[0], [{ id: "pond", ...pondSize }, ...others], REGION_GAP, rng);

  // 4. Frame the map (forest ring + margin around the cluster) and open the gates.
  const frame = frameMap([...packed.values()]);
  const canvas = new WorldCanvas(frame.width, frame.height, rng);
  plantBorderForest(canvas);
  const placedRect = (id: string): Rect => {
    const r = packed.get(id) ?? { x: 0, y: 0, w: 0, h: 0 };
    return { x: r.x + frame.dx, y: r.y + frame.dy, w: r.w, h: r.h };
  };
  const villages: Village[] = plans.map((plan, i) => ({ plan, layout: layouts[i], rect: placedRect(plan.id), gate: { x: -1, y: -1 } }));
  const [town, ...regions] = villages;
  const pond = placedRect("pond");

  // Every region opens toward the town; the town opens toward its regions.
  const townGates = new Map<Side, Gate>();
  for (const region of regions) {
    region.gate = toWorld(openGate(region.layout, sideFacing(region.rect, town.rect)).point, region.rect);
    const townSide = sideFacing(town.rect, region.rect);
    if (!townGates.has(townSide)) townGates.set(townSide, openGate(town.layout, townSide));
  }
  for (const village of villages) stampVillage(canvas, village);

  // 5. Town Square furniture and the spawn point.
  const localPlaza = town.layout.plaza ?? { x: 0, y: 0, w: 0, h: 0 };
  const plaza = { ...localPlaza, x: town.rect.x + localPlaza.x, y: town.rect.y + localPlaza.y };
  const square = furnishTownSquare(canvas, plaza);

  // 6. Water, dug before the roads so that roads bridge the river rather than the other way round.
  const pondTiles = digPond(canvas, pond);
  runRiver(canvas, pondTiles, villages.map((v) => v.rect));

  // 7. Roads, nearest region first, so later roads can join earlier ones.
  const obstacles = [...villages.map((v) => v.rect), pond];
  const byDistance = [...regions].sort((a, b) => distance(a.rect, town.rect) - distance(b.rect, town.rect));
  const townGatePoints = [...townGates.values()].map((g) => toWorld(g.point, town.rect));
  for (const region of byDistance) {
    if (!layRoad(canvas, region.gate, townGatePoints, obstacles)) return `no road fits to ${region.plan.name}`;
  }
  closeUnusedGates(canvas, town, [...townGates.values()]);
  rimWithSand(canvas, 0.4);

  // 8. Signposts and villagers, before decorations so those stay out of their way.
  for (const region of regions) {
    if (!placeSign(canvas, region.gate, signText(region.plan))) return `no room for the sign of ${region.plan.name}`;
  }
  const villagerCount = Math.min(6, 3 + Math.floor(regions.length / 2));
  const scripts = writeVillagers(analysis, villagerCount, rng);
  const npcs = placeVillagers(canvas, scripts, plaza, square.spawn, byDistance.map((r) => ({ ...r.gate, regionId: r.plan.id })));

  // 9. Nature and village decorations.
  paintMeadows(canvas);
  for (const { plan, layout, rect } of villages) {
    // Every village has its own taste in fences; the town loves them most.
    const fenceChance = plan.isTown ? 0.45 : randInt(rng, 0, 1) * 0.4;
    const left = rect.x + 1;
    const right = rect.x + rect.w - 2;
    for (const yardY of layout.yardRows) decorateYard(canvas, rect.y + yardY, left, right, fenceChance);
    if (plan.isTown) {
      // A low, gappy fence along the town's top and bottom edges.
      decorateYard(canvas, rect.y, left, right, fenceChance);
      decorateYard(canvas, rect.y + rect.h - 1, left, right, fenceChance);
    }
  }
  lineRoadsWithLamps(canvas);
  fringeBorderForest(canvas);
  plantGroves(canvas);
  scatterBushes(canvas);
  scatterSmallThings(canvas);

  // 10. Assemble, then repair anything the decorations walled off.
  const world: Overworld = {
    ...canvas.map,
    seed,
    regions: villages.map(regionOf),
    buildings: villages.flatMap((v) => buildingsOf(v, rng)),
    props: canvas.props,
    npcs,
    spawn: square.spawn,
  };
  const repaired = clearBlockedPaths(
    canvas.map,
    square.spawn,
    overworldTargets(world),
    () => [...canvas.props.filter((p) => p.solid), ...npcs],
    (p) => isRemovableDecor(canvas, p),
    (p) => canvas.removePropAt(p.x, p.y),
  );
  if (!repaired) return "decorations walled something off and could not be cleared";
  world.props = canvas.props;
  return world;
}

/** Map size, and the shift that moves the packed cluster inside the forest ring. */
function frameMap(rects: Rect[]): { width: number; height: number; dx: number; dy: number } {
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.w));
  const maxY = Math.max(...rects.map((r) => r.y + r.h));
  const margin = BORDER + OUTER_MARGIN;
  const neededW = maxX - minX + 2 * margin;
  const neededH = maxY - minY + 2 * margin;
  const width = Math.max(MIN_WIDTH, neededW);
  const height = Math.max(MIN_HEIGHT, neededH);
  // When the minimum size adds extra room, centre the cluster in it.
  return { width, height, dx: margin - minX + Math.floor((width - neededW) / 2), dy: margin - minY + Math.floor((height - neededH) / 2) };
}

/** Which side of `from` faces `to` (relative to their sizes, so diagonal neighbours pick sensibly). */
function sideFacing(from: Rect, to: Rect): Side {
  const a = rectCenter(from);
  const b = rectCenter(to);
  const nx = (b.x - a.x) / ((from.w + to.w) / 2);
  const ny = (b.y - a.y) / ((from.h + to.h) / 2);
  if (Math.abs(nx) > Math.abs(ny)) return nx > 0 ? "right" : "left";
  return ny > 0 ? "bottom" : "top";
}

function distance(a: Rect, b: Rect): number {
  const ca = rectCenter(a);
  const cb = rectCenter(b);
  return Math.hypot(ca.x - cb.x, ca.y - cb.y);
}

function toWorld(local: Point, rect: Rect): Point {
  return { x: rect.x + local.x, y: rect.y + local.y };
}

/** Copies a region's streets, plaza, building footprints and lanterns/stumps onto the map. */
function stampVillage(canvas: WorldCanvas, village: Village): void {
  const { layout, rect } = village;
  for (const { x, y } of tilesOf({ x: 0, y: 0, w: layout.w, h: layout.h })) {
    const wx = rect.x + x;
    const wy = rect.y + y;
    canvas.tag(wx, wy, Tag.Region);
    const cell = layout.cells[y * layout.w + x];
    if (cell === Cell.Street) canvas.paint(wx, wy, Ground.Path);
    if (cell === Cell.Plaza) canvas.paint(wx, wy, Ground.Plaza);
    if (cell !== Cell.Grass) canvas.tag(wx, wy, Tag.Road);
  }
  for (const { lot, x, y, door } of layout.lots) {
    canvas.tag(rect.x + door.x, rect.y + door.y, Tag.KeepClear);
    if (isMarker(lot)) {
      // A stump is solid (read it from the street below); a lantern you can walk through.
      canvas.addProp(lot.kind, rect.x + x, rect.y + y, lot.kind === "stump", lot.file.path);
      continue;
    }
    for (const t of tilesOf({ x: rect.x + x, y: rect.y + y, w: lot.w, h: lot.h })) {
      canvas.paint(t.x, t.y, Ground.Grass, true);
      canvas.tag(t.x, t.y, Tag.Building);
    }
  }
}

/**
 * Lays one 2-wide road from a region's gate to the network (a town gate or
 * any earlier road). Roads may not cross regions or the pond, pay a little
 * extra for hugging a region's edge (so they keep a grass verge), and pay a
 * lot for crossing the river, which they do on a bridge.
 */
function layRoad(canvas: WorldCanvas, start: Point, townGates: readonly Point[], obstacles: readonly Rect[]): boolean {
  const { width, height } = canvas;
  const size = width * height;
  const blocked = new Uint8Array(size);
  const extraCost = new Float32Array(size);
  const goal = new Uint8Array(size);
  const road = new Uint8Array(size);
  const grown = obstacles.map((r) => ({ x: r.x - 1, y: r.y - 1, w: r.w + 2, h: r.h + 2 }));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const inside = obstacles.some((r) => rectContains(r, x, y));
      blocked[i] = inside || canvas.has(x, y, Tag.Border) ? 1 : 0;
      const hugging = !inside && grown.some((r) => rectContains(r, x, y));
      extraCost[i] = canvas.has(x, y, Tag.Water) ? 6 : hugging ? 1.5 : 0;
      road[i] = !inside && canvas.has(x, y, Tag.Road) ? 1 : 0;
      goal[i] = road[i];
    }
  }
  for (const g of townGates) goal[g.y * width + g.x] = 1;

  const brushes = findRoad({ width, height, blocked, extraCost, goal, road }, start);
  if (!brushes) return false;
  for (const b of brushes) {
    for (const t of tilesOf({ x: b.x, y: b.y, w: 2, h: 2 })) {
      // Over water we build a bridge (and a later road merging onto it must not pave it over).
      const isBridge = canvas.has(t.x, t.y, Tag.Water) || canvas.ground(t.x, t.y) === Ground.Bridge;
      canvas.paint(t.x, t.y, isBridge ? Ground.Bridge : Ground.Path);
      canvas.untag(t.x, t.y, Tag.Water);
      canvas.tag(t.x, t.y, Tag.Road);
    }
  }
  return true;
}

/** Town gates that no road reached would be dead-end stubs: turn them back into grass. */
function closeUnusedGates(canvas: WorldCanvas, town: Village, gates: readonly Gate[]): void {
  for (const gate of gates) {
    const outside = toWorld(gate.point, town.rect);
    if (canvas.has(outside.x, outside.y, Tag.Road)) continue;
    for (const t of gate.tiles) {
      const p = toWorld(t, town.rect);
      canvas.paint(p.x, p.y, Ground.Grass);
      canvas.untag(p.x, p.y, Tag.Road);
    }
  }
}

/** Plain decorations may be cleared away; landmarks, signs and file markers may not. */
function isRemovableDecor(canvas: WorldCanvas, p: Point): boolean {
  const prop = canvas.propAt(p.x, p.y);
  if (!prop || prop.text !== undefined) return false;
  return REMOVABLE_DECOR.has(prop.kind) || prop.kind === "stump";
}

function regionOf(village: Village): Region {
  const { plan, rect } = village;
  return { id: plan.id, name: plan.name, dir: plan.dir, x: rect.x, y: rect.y, w: rect.w, h: rect.h, fileCount: plan.files.length };
}

function buildingsOf(village: Village, rng: Rng): Building[] {
  const { plan, layout, rect } = village;
  const buildings: Building[] = [];
  for (const { lot, x, y, door } of layout.lots) {
    if (isMarker(lot)) continue;
    buildings.push({
      id: `bld:${lot.file.path}`,
      path: lot.file.path,
      kind: lot.kind,
      x: rect.x + x,
      y: rect.y + y,
      w: lot.w,
      h: lot.h,
      door: toWorld(door, rect),
      regionId: plan.id,
      corrupted: lot.file.findings.length > 0,
      variant: randInt(rng, 0, 255),
    });
  }
  return buildings;
}
