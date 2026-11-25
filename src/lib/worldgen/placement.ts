/**
 * Placing the overworld's *meaningful* small things: region signposts and
 * villagers.
 *
 * All of them must be readable or talkable from a walkable tile, so each
 * placement also reserves ("keep clear") the tile in front of it.
 */
import type { NpcSpawn, Point, Rect } from "@/lib/types";
import { randInt, shuffled } from "@/lib/rng";
import { Tag, type WorldCanvas } from "./canvas";
import { chebyshev, DIRS4, rectContains } from "./grid";
import type { VillagerScript } from "./villagers";

/** Tiles within `radius` of `center`, nearest first (ties in reading order, so it is deterministic). */
function tilesAround(canvas: WorldCanvas, center: Point, radius: number): Point[] {
  const out: Point[] = [];
  for (let y = center.y - radius; y <= center.y + radius; y++) {
    for (let x = center.x - radius; x <= center.x + radius; x++) {
      if (canvas.inBounds(x, y)) out.push({ x, y });
    }
  }
  const dist = (p: Point) => Math.abs(p.x - center.x) + Math.abs(p.y - center.y);
  return out.sort((a, b) => dist(a) - dist(b) || a.y - b.y || a.x - b.x);
}

function touchesRoad(canvas: WorldCanvas, p: Point): boolean {
  return canvas.has(p.x, p.y, Tag.Road) || DIRS4.some((d) => canvas.has(p.x + d.x, p.y + d.y, Tag.Road));
}

/**
 * A spot where something solid can stand and be talked to / read: the tile
 * itself is free ground and the tile south of it ("front") is walkable and
 * on or right beside a road, so the player can always get there.
 */
function isGoodPostSpot(canvas: WorldCanvas, spot: Point): boolean {
  const front = { x: spot.x, y: spot.y + 1 };
  return (
    canvas.canDecorate(spot.x, spot.y) &&
    canvas.isWalkable(front.x, front.y) &&
    !canvas.has(front.x, front.y, Tag.Prop | Tag.Building | Tag.Water | Tag.Border) &&
    touchesRoad(canvas, front)
  );
}

/** Puts a signpost next to a region's gate. Returns false if there was no room at all. */
export function placeSign(canvas: WorldCanvas, gate: Point, text: string): boolean {
  const spot = tilesAround(canvas, gate, 4).find((p) => isGoodPostSpot(canvas, p));
  if (!spot) return false;
  canvas.addProp("sign", spot.x, spot.y, true, text);
  canvas.tag(spot.x, spot.y + 1, Tag.KeepClear);
  return true;
}

/**
 * Villagers: a couple on the plaza (the first one right next to the spawn
 * point) and the rest by region gates, greeting travellers. A villager's
 * tile is blocked and the tile in front (south) is kept clear for talking.
 */
export function placeVillagers(
  canvas: WorldCanvas,
  scripts: readonly VillagerScript[],
  plaza: Rect,
  spawn: Point,
  gates: readonly Point[],
): NpcSpawn[] {
  const atGates = Math.min(scripts.length - 2, gates.length);
  const spots: Point[] = [];
  const farFromOthers = (p: Point) => spots.every((s) => chebyshev(s, p) >= 3);

  // Plaza villagers: inside the ring, not crowding landmarks, closest to spawn first.
  const plazaSpots = tilesAround(canvas, spawn, Math.max(plaza.w, plaza.h)).filter(
    (p) =>
      rectContains({ x: plaza.x + 1, y: plaza.y + 1, w: plaza.w - 2, h: plaza.h - 2 }, p.x, p.y) &&
      !canvas.has(p.x, p.y, Tag.KeepClear | Tag.Prop) &&
      !canvas.near(p.x, p.y, Tag.Prop) &&
      canvas.isWalkable(p.x, p.y + 1) &&
      !canvas.has(p.x, p.y + 1, Tag.Prop),
  );
  const firstPlaza = plazaSpots.find((p) => chebyshev(p, spawn) >= 2);
  if (firstPlaza) spots.push(firstPlaza);
  for (const p of shuffled(canvas.rng, plazaSpots)) {
    if (spots.length >= scripts.length - atGates) break;
    if (farFromOthers(p)) spots.push(p);
  }

  // Gate villagers: beside the road at a few region entrances.
  for (const gate of shuffled(canvas.rng, gates)) {
    if (spots.length >= scripts.length) break;
    const spot = tilesAround(canvas, gate, 3).find((p) => isGoodPostSpot(canvas, p) && farFromOthers(p));
    if (spot) spots.push(spot);
  }
  // If some gate had no room, the plaza takes in the extra villagers.
  for (const p of plazaSpots) {
    if (spots.length >= scripts.length) break;
    if (spots.every((s) => chebyshev(s, p) >= 2)) spots.push(p);
  }

  return spots.slice(0, scripts.length).map((spot, i) => {
    canvas.tag(spot.x, spot.y, Tag.Npc);
    canvas.tag(spot.x, spot.y + 1, Tag.KeepClear);
    return {
      id: `npc-${i}`,
      name: scripts[i].name,
      x: spot.x,
      y: spot.y,
      lookSeed: randInt(canvas.rng, 0, 0x7fffffff),
      lines: scripts[i].lines,
    };
  });
}
