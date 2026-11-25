/**
 * Decorations: everything that makes the overworld feel alive but has no
 * gameplay meaning of its own (trees, meadows, bushes, flowers, lamps...).
 *
 * Every function only touches tiles that `canvas.canDecorate` allows, so
 * decorations can never land on a road, a door, a landmark's front tile or
 * a villager. Solid decorations *could* still wall something off by bad
 * luck; the overworld's final repair step clears such spots.
 */
import { Ground, type Point, type PropKind } from "@/lib/types";
import { chance, pick, randInt, shuffled } from "@/lib/rng";
import { Tag, type WorldCanvas } from "./canvas";
import { chebyshev, DIRS4 } from "./grid";
import { makeValueNoise } from "./noise";

/** Fence prop variant for a left-to-right run (see src/game/art/props.ts). */
const FENCE_HORIZONTAL = 0;

/** Thickness of the impassable forest ring around the whole map. */
export const BORDER = 4;

/** Decorations the repair step may remove to reopen a blocked path. */
export const REMOVABLE_DECOR: ReadonlySet<PropKind> = new Set<PropKind>([
  "tree",
  "treeAlt",
  "bush",
  "rock",
  "lamp",
  "fence",
  "bench",
  "mushroom",
  "flower",
]);

const TREE_KINDS: readonly PropKind[] = ["tree", "treeAlt"];

function distanceToEdge(canvas: WorldCanvas, x: number, y: number): number {
  return Math.min(x, y, canvas.width - 1 - x, canvas.height - 1 - y);
}

/**
 * The forest ring: BORDER tiles of solid terrain, each with a tree on it, so
 * the world fades into woods instead of stopping at a hard edge. (Later,
 * `fringeBorderForest` scatters loose trees just inside it so the treeline
 * looks ragged rather than ruler-straight.)
 */
export function plantBorderForest(canvas: WorldCanvas): void {
  const kindNoise = makeValueNoise(canvas.rng, canvas.width, canvas.height, 4);
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (distanceToEdge(canvas, x, y) >= BORDER) continue;
      canvas.paint(x, y, Ground.Grass, true);
      canvas.tag(x, y, Tag.Border);
      canvas.addProp(kindNoise(x, y) > 0.5 ? "treeAlt" : "tree", x, y, true);
    }
  }
}

/** Loose trees just inside the forest ring (called after roads exist, so roads stay clear). */
export function fringeBorderForest(canvas: WorldCanvas): void {
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const depth = distanceToEdge(canvas, x, y) - BORDER; // 0 = right next to the forest
      if (depth > 1 || !canvas.canDecorate(x, y) || canvas.near(x, y, Tag.Road | Tag.Region)) continue;
      if (chance(canvas.rng, depth === 0 ? 0.5 : 0.2)) canvas.addProp(pick(canvas.rng, TREE_KINDS), x, y, true);
    }
  }
}

/** Soft patches of meadow ground; a little more of it inside villages (their "accent" ground). */
export function paintMeadows(canvas: WorldCanvas): void {
  const noise = makeValueNoise(canvas.rng, canvas.width, canvas.height, 7);
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (canvas.ground(x, y) !== Ground.Grass || canvas.has(x, y, Tag.Border | Tag.Building)) continue;
      const threshold = canvas.has(x, y, Tag.Region) ? 0.55 : 0.64;
      if (noise(x, y) > threshold) canvas.paint(x, y, Ground.Meadow, false);
    }
  }
}

/** Clumps of trees in the wild space between villages, never crowding a road. */
export function plantGroves(canvas: WorldCanvas): void {
  const density = makeValueNoise(canvas.rng, canvas.width, canvas.height, 6);
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (!canvas.canDecorate(x, y) || canvas.has(x, y, Tag.Region)) continue;
      if (canvas.near(x, y, Tag.Road | Tag.Region | Tag.KeepClear | Tag.Npc)) continue;
      const probability = density(x, y) > 0.64 ? 0.5 : 0.012;
      if (chance(canvas.rng, probability)) canvas.addProp(pick(canvas.rng, TREE_KINDS), x, y, true);
    }
  }
}

/** Lamp posts beside roads and streets, roughly every `spacing` tiles. */
export function lineRoadsWithLamps(canvas: WorldCanvas, spacing = 8): void {
  const spots: Point[] = [];
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (canvas.canDecorate(x, y) && touchesGround(canvas, x, y, Ground.Path)) spots.push({ x, y });
    }
  }
  const lamps: Point[] = canvas.props.filter((p) => p.kind === "lamp").map((p) => ({ x: p.x, y: p.y }));
  for (const spot of shuffled(canvas.rng, spots)) {
    if (lamps.some((l) => chebyshev(l, spot) < spacing)) continue;
    canvas.addProp("lamp", spot.x, spot.y, true);
    lamps.push(spot);
  }
}

/**
 * Bushes near paths (the player loves whacking them for coins), in little
 * clusters of one to three.
 */
export function scatterBushes(canvas: WorldCanvas): void {
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (!canvas.canDecorate(x, y) || !canvas.near(x, y, Tag.Road, 2)) continue;
      const probability = touchesGround(canvas, x, y, Ground.Path) ? 0.13 : 0.08;
      if (!chance(canvas.rng, probability)) continue;
      canvas.addProp("bush", x, y, true);
      // Sometimes a buddy bush grows right next to it.
      const buddy = pick(canvas.rng, DIRS4);
      if (chance(canvas.rng, 0.4) && canvas.canDecorate(x + buddy.x, y + buddy.y)) {
        canvas.addProp("bush", x + buddy.x, y + buddy.y, true);
      }
    }
  }
}

/** Flowers everywhere (more on meadows), rocks and stumps in the wild, mushrooms under trees. */
export function scatterSmallThings(canvas: WorldCanvas): void {
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (!canvas.canDecorate(x, y)) continue;
      const wild = !canvas.has(x, y, Tag.Region);
      const flowerChance = canvas.ground(x, y) === Ground.Meadow ? 0.08 : 0.03;
      const roll = canvas.rng();
      if (roll < flowerChance) canvas.addProp("flower", x, y, false);
      else if (wild && besideTree(canvas, x, y) && roll < flowerChance + 0.04) canvas.addProp("mushroom", x, y, false);
      else if (wild && roll > 0.993) canvas.addProp("rock", x, y, true);
      else if (wild && roll > 0.99) canvas.addProp("stump", x, y, true);
    }
  }
}

/**
 * A garden strip along row `y`: runs of fence or flowers with gaps between
 * them. Used for the yards between rows of houses and for Town Square's edge.
 */
export function decorateYard(canvas: WorldCanvas, y: number, x0: number, x1: number, fenceChance: number): void {
  let x = x0;
  while (x <= x1) {
    const runLength = randInt(canvas.rng, 2, 5);
    const fenced = chance(canvas.rng, fenceChance);
    for (let i = 0; i < runLength && x <= x1; i++, x++) {
      // Leave a gap beside any street crossing the strip, so it never looks walled in.
      const besideCrossing = canvas.ground(x - 1, y) === Ground.Path || canvas.ground(x + 1, y) === Ground.Path;
      if (!canvas.canDecorate(x, y) || besideCrossing) continue;
      // Variant 0 is the art's "horizontal run" fence piece (yards always run left-to-right).
      if (fenced) canvas.addProp("fence", x, y, true).variant = FENCE_HORIZONTAL;
      else if (chance(canvas.rng, 0.3)) canvas.addProp("flower", x, y, false);
    }
    x += 1; // a gap between runs
  }
}

function touchesGround(canvas: WorldCanvas, x: number, y: number, ground: number): boolean {
  return DIRS4.some((d) => canvas.ground(x + d.x, y + d.y) === ground);
}

function besideTree(canvas: WorldCanvas, x: number, y: number): boolean {
  return DIRS4.some((d) => {
    const prop = canvas.propAt(x + d.x, y + d.y);
    return prop !== undefined && TREE_KINDS.includes(prop.kind);
  });
}
