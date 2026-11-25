/**
 * Water features: a pond in its own reserved spot (it was packed like a
 * tiny region, so it never collides with a village), plus a little winding
 * river that flows out of the forest, through the pond and back into the
 * forest. Roads are laid after the water and turn into bridges where they
 * cross it, so water never cuts anything off.
 */
import { Ground, type Point, type Rect } from "@/lib/types";
import { chance } from "@/lib/rng";
import { Tag, type WorldCanvas } from "./canvas";
import { DIRS4, rectContains } from "./grid";
import { makeValueNoise } from "./noise";
import { cheapestPath } from "./paths";

/** River arms longer than this are skipped (the pond alone is pretty enough). */
const MAX_ARM_LENGTH = 45;

/** Fills a wobbly ellipse inside `rect` with water. Returns the water tiles. */
export function digPond(canvas: WorldCanvas, rect: Rect): Point[] {
  const noise = makeValueNoise(canvas.rng, canvas.width, canvas.height, 3);
  const cx = rect.x + (rect.w - 1) / 2;
  const cy = rect.y + (rect.h - 1) / 2;
  const rx = Math.max(1, (rect.w - 2) / 2);
  const ry = Math.max(1, (rect.h - 2) / 2);
  const water: Point[] = [];
  for (let y = rect.y + 1; y < rect.y + rect.h - 1; y++) {
    for (let x = rect.x + 1; x < rect.x + rect.w - 1; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      // The noise nudges the shoreline in and out so the pond is not a perfect oval.
      const isCenter = Math.abs(x - cx) <= 0.5 && Math.abs(y - cy) <= 0.5;
      if (isCenter || nx * nx + ny * ny <= 0.75 + 0.5 * noise(x, y)) {
        canvas.paint(x, y, Ground.Water, true);
        canvas.tag(x, y, Tag.Water);
        water.push({ x, y });
      }
    }
  }
  return water;
}

/**
 * A little river: it leaves the pond toward the nearest edge of the forest,
 * and a second arm leaves it on the opposite side, so the river flows
 * forest → pond → forest. Each arm is the cheapest route over a noisy cost
 * field, so it meanders around "hills" instead of running ruler-straight,
 * and it keeps out of villages.
 *
 * The river is dug *before* the roads: road builders later cross it with
 * bridges wherever it stands between a region and the town.
 * Returns the river tiles (none if even the first arm would be too long).
 */
export function runRiver(canvas: WorldCanvas, pond: readonly Point[], villages: readonly Rect[]): Point[] {
  if (pond.length === 0) return [];
  const center = {
    x: pond.reduce((sum, p) => sum + p.x, 0) / pond.length,
    y: pond.reduce((sum, p) => sum + p.y, 0) / pond.length,
  };
  const first = flowToForest(canvas, pond, villages, () => true);
  if (first.length === 0) return [];
  // The second arm must head the other way: its mouth lies on the far side of the pond.
  const mouth = first[first.length - 1];
  const away = { x: mouth.x - center.x, y: mouth.y - center.y };
  const second = flowToForest(canvas, pond, villages, (p) => (p.x - center.x) * away.x + (p.y - center.y) * away.y < 0);
  return [...first, ...second];
}

/** Digs one meandering arm from the pond to a forest-edge tile accepted by `isMouth`. */
function flowToForest(canvas: WorldCanvas, pond: readonly Point[], villages: readonly Rect[], isMouth: (p: Point) => boolean): Point[] {
  const { width, height } = canvas;
  const noise = makeValueNoise(canvas.rng, width, height, 4);
  const nearVillage = (x: number, y: number) =>
    villages.some((r) => rectContains({ x: r.x - 2, y: r.y - 2, w: r.w + 4, h: r.h + 4 }, x, y));

  const stepCost = (i: number) => {
    const x = i % width;
    const y = (i - x) / width;
    if (canvas.has(x, y, Tag.Water)) return 0.1; // flowing through existing water is (almost) free
    if (canvas.has(x, y, Tag.Border | Tag.KeepClear | Tag.Building | Tag.Road) || nearVillage(x, y)) return Infinity;
    const n = noise(x, y);
    return 0.5 + 25 * n * n * n;
  };
  const isGoal = (i: number) => {
    const x = i % width;
    const y = (i - x) / width;
    if (canvas.has(x, y, Tag.Water) || !DIRS4.some((d) => canvas.has(x + d.x, y + d.y, Tag.Border))) return false;
    return isMouth({ x, y });
  };

  const path = cheapestPath(width, height, pond, stepCost, isGoal);
  const arm = (path ?? []).filter((p) => !canvas.has(p.x, p.y, Tag.Water));
  if (arm.length > MAX_ARM_LENGTH) return [];
  for (const p of arm) {
    canvas.paint(p.x, p.y, Ground.Water, true);
    canvas.tag(p.x, p.y, Tag.Water);
  }
  return arm;
}

/** Turns some grass next to water into sand, for a soft beach-y rim. */
export function rimWithSand(canvas: WorldCanvas, probability: number): void {
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (!canvas.canDecorate(x, y) || canvas.has(x, y, Tag.Region)) continue;
      const besideWater = DIRS4.some((d) => canvas.has(x + d.x, y + d.y, Tag.Water));
      if (besideWater && chance(canvas.rng, probability)) canvas.paint(x, y, Ground.Sand, false);
    }
  }
}
