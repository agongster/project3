/**
 * Where the Workshop opens when the player presses its key (or the HUD
 * button): "the code right where I am".
 *
 *   inside a dungeon   that file, at the line of the nearest living monster
 *                      (else at the room the hero stands in)
 *   in the overworld   the building in front of the hero (at its first
 *                      living monster's line if it is cursed), else no file
 *
 * A pure decision on plain data, so it is easy to test; the scenes only
 * describe the hero's situation.
 */
import type { WorkshopTarget } from "../bridge";

/** A building counts as "in front of the hero" when its door is at most this far away (px). */
export const BUILDING_REACH_PX = 40;

interface Spot {
  x: number;
  y: number;
}

/** A monster still standing in the dungeon: where it is, and the line of its finding. */
export interface LivingMonster extends Spot {
  line: number;
}

/** One building near the hero: its door, its file, and the first line of a bug still alive inside (if any). */
export interface NearbyBuilding {
  door: Spot;
  path: string;
  firstLivingLine: number | null;
}

export type HeroSituation =
  | { scene: "dungeon"; path: string; hero: Spot; monsters: readonly LivingMonster[]; roomLine: number | null }
  | { scene: "overworld"; hero: Spot; buildings: readonly NearbyBuilding[] };

const NOWHERE: WorkshopTarget = { path: null };

function distance(a: Spot, b: Spot): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** The item of `items` whose spot is closest to `hero`, or null for an empty list. */
function nearest<T>(items: readonly T[], hero: Spot, spot: (item: T) => Spot): T | null {
  let best: T | null = null;
  for (const item of items) if (best === null || distance(spot(item), hero) < distance(spot(best), hero)) best = item;
  return best;
}

/** The Workshop target for the hero's situation (see the file comment). */
export function workshopTargetFor(situation: HeroSituation): WorkshopTarget {
  if (situation.scene === "dungeon") {
    const monster = nearest(situation.monsters, situation.hero, (m) => m);
    const line = monster?.line ?? situation.roomLine;
    return line === null ? { path: situation.path } : { path: situation.path, line };
  }
  const inReach = situation.buildings.filter((b) => distance(b.door, situation.hero) <= BUILDING_REACH_PX);
  const building = inReach.length > 0 ? nearest(inReach, situation.hero, (b) => b.door) : null;
  if (!building) return NOWHERE;
  return building.firstLivingLine === null ? { path: building.path } : { path: building.path, line: building.firstLivingLine };
}
