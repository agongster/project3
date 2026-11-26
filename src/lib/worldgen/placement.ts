/**
 * Placing the overworld's *meaningful* small things: region signposts and
 * villagers.
 *
 * All of them must be readable or talkable from a walkable tile, so each
 * placement also reserves ("keep clear") the tile in front of it.
 */
import type { NpcSpawn, Point, Rect } from "@/lib/types";
import { hashString, shuffled } from "@/lib/rng";
import { Tag, type WorldCanvas } from "./canvas";
import { chebyshev, DIRS4, rectContains } from "./grid";
import type { VillagerCast, VillagerScript } from "./villagers";

/** Villagers keep at least this many tiles between each other… */
const VILLAGER_SPACING = 3;
/** …or this many when the plaza is crowded (a gate had no room). */
const CROWDED_SPACING = 2;

/** Where a region's road starts, and which region it leads into. */
export interface RegionGate extends Point {
  regionId: string;
}

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
 * Villagers: the guide right next to the spawn point, the rest of Town
 * Square's folk (merchants and town folk) spread over the plaza, and each
 * region villager beside the road at its own region's gate, greeting
 * travellers. A region villager whose gate has no room moves to the plaza.
 * A villager's tile is blocked and the tile in front (south) is kept clear
 * for talking.
 */
export function placeVillagers(canvas: WorldCanvas, cast: VillagerCast, plaza: Rect, spawn: Point, gates: readonly RegionGate[]): NpcSpawn[] {
  const placed: { spot: Point; script: VillagerScript }[] = [];
  const spacedFrom = (p: Point, min: number) => placed.every((other) => chebyshev(other.spot, p) >= min);

  // Plaza spots: inside the ring, not crowding landmarks, closest to spawn first.
  const plazaSpots = tilesAround(canvas, spawn, Math.max(plaza.w, plaza.h)).filter(
    (p) =>
      rectContains({ x: plaza.x + 1, y: plaza.y + 1, w: plaza.w - 2, h: plaza.h - 2 }, p.x, p.y) &&
      !canvas.has(p.x, p.y, Tag.KeepClear | Tag.Prop) &&
      !canvas.near(p.x, p.y, Tag.Prop) &&
      canvas.isWalkable(p.x, p.y + 1) &&
      !canvas.has(p.x, p.y + 1, Tag.Prop),
  );
  const scatteredSpots = shuffled(canvas.rng, plazaSpots);
  const onPlaza = (script: VillagerScript) => {
    const spot = scatteredSpots.find((p) => spacedFrom(p, VILLAGER_SPACING)) ?? plazaSpots.find((p) => spacedFrom(p, CROWDED_SPACING));
    if (spot) placed.push({ spot, script });
  };

  const [guide, ...townFolk] = cast.town;
  const guideSpot = plazaSpots.find((p) => chebyshev(p, spawn) >= 2);
  if (guide && guideSpot) placed.push({ spot: guideSpot, script: guide });
  for (const script of townFolk) onPlaza(script);

  const homeless: VillagerScript[] = [];
  for (const { regionId, script } of cast.regional) {
    const gate = gates.find((g) => g.regionId === regionId);
    const spot = gate && tilesAround(canvas, gate, 3).find((p) => isGoodPostSpot(canvas, p) && spacedFrom(p, VILLAGER_SPACING));
    if (spot) placed.push({ spot, script });
    else homeless.push(script);
  }
  for (const script of homeless) onPlaza(script);

  return placed.map(({ spot, script }, i) => {
    canvas.tag(spot.x, spot.y, Tag.Npc);
    canvas.tag(spot.x, spot.y + 1, Tag.KeepClear);
    return {
      id: `npc-${i}`,
      name: script.name,
      x: spot.x,
      y: spot.y,
      // Seeded from the name so the dialog portrait (which only knows the
      // speaker's name) shows the same face as the villager in the world.
      lookSeed: hashString(script.name),
      lines: script.lines,
      bubbles: script.bubbles,
    };
  });
}
