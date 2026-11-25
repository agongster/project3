/**
 * The overworld's scratch pad while it is being generated.
 *
 * Besides the final ground/solid arrays, the generator needs to remember
 * *why* each tile is the way it is ("this is a door, never put a bush here",
 * "a villager stands here"...). WorldCanvas keeps those reasons as bit flags
 * (`Tag`) next to the map and offers the few operations every step needs:
 * paint ground, tag tiles, add/remove props, and ask "may I decorate here?".
 */
import { Ground, type GroundId, type PropKind, type Prop, type TileMap } from "@/lib/types";
import { randInt, type Rng } from "@/lib/rng";
import { createTileMap, inBounds, setTile } from "./grid";

/** Why a tile is special. A tile may carry several tags at once. */
export const Tag = {
  /** Inside a region's rectangle (village ground rather than wild nature). */
  Region: 1 << 0,
  /** Street, road, plaza or bridge: props never go here. */
  Road: 1 << 1,
  /** Part of a building's solid footprint. */
  Building: 1 << 2,
  /** Must stay free: doors, landmark fronts, sign fronts, spawn, walkways. */
  KeepClear: 1 << 3,
  /** Some prop stands here. */
  Prop: 1 << 4,
  /** ...and that prop blocks movement. */
  SolidProp: 1 << 5,
  /** A villager stands here (blocked like a solid prop). */
  Npc: 1 << 6,
  Water: 1 << 7,
  /** The impassable forest ring around the map. */
  Border: 1 << 8,
} as const;

/** Tags that make a tile unavailable for new decorations. */
const NOT_DECORATABLE = Tag.Road | Tag.Building | Tag.KeepClear | Tag.Prop | Tag.Npc | Tag.Water | Tag.Border;

export class WorldCanvas {
  readonly map: TileMap;
  readonly tags: Uint16Array;
  /** Tile index → the prop standing there (at most one per tile). */
  private readonly propByTile = new Map<number, Prop>();

  constructor(
    readonly width: number,
    readonly height: number,
    readonly rng: Rng,
  ) {
    this.map = createTileMap(width, height, Ground.Grass, false);
    this.tags = new Uint16Array(width * height);
  }

  inBounds(x: number, y: number): boolean {
    return inBounds(this.map, x, y);
  }

  ground(x: number, y: number): number {
    return this.inBounds(x, y) ? this.map.ground[y * this.width + x] : -1;
  }

  paint(x: number, y: number, ground: GroundId, solid = false): void {
    if (this.inBounds(x, y)) setTile(this.map, x, y, ground, solid);
  }

  has(x: number, y: number, flags: number): boolean {
    return this.inBounds(x, y) && (this.tags[y * this.width + x] & flags) !== 0;
  }

  tag(x: number, y: number, flags: number): void {
    if (this.inBounds(x, y)) this.tags[y * this.width + x] |= flags;
  }

  untag(x: number, y: number, flags: number): void {
    if (this.inBounds(x, y)) this.tags[y * this.width + x] &= ~flags;
  }

  /** The player could stand here: not solid terrain, no solid prop, no villager. */
  isWalkable(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.map.solid[y * this.width + x] === 0 && !this.has(x, y, Tag.SolidProp | Tag.Npc);
  }

  /** Plain open ground (grass, meadow or sand) with nothing reserved on it. */
  canDecorate(x: number, y: number): boolean {
    if (!this.inBounds(x, y) || this.has(x, y, NOT_DECORATABLE)) return false;
    const g = this.ground(x, y);
    return (g === Ground.Grass || g === Ground.Meadow || g === Ground.Sand) && this.map.solid[y * this.width + x] === 0;
  }

  /** True when any of the 8 tiles around (x, y) (or the tile itself) carries one of `flags`. */
  near(x: number, y: number, flags: number, radius = 1): boolean {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (this.has(x + dx, y + dy, flags)) return true;
      }
    }
    return false;
  }

  /** Places a prop. Each tile holds at most one prop. */
  addProp(kind: PropKind, x: number, y: number, solid: boolean, text?: string): Prop {
    const prop: Prop = { kind, x, y, variant: randInt(this.rng, 0, 255), solid };
    if (text !== undefined) prop.text = text;
    this.propByTile.set(y * this.width + x, prop);
    this.tag(x, y, solid ? Tag.Prop | Tag.SolidProp : Tag.Prop);
    return prop;
  }

  /** Removes the prop standing on (x, y), if any. */
  removePropAt(x: number, y: number): void {
    this.propByTile.delete(y * this.width + x);
    this.untag(x, y, Tag.Prop | Tag.SolidProp);
  }

  propAt(x: number, y: number): Prop | undefined {
    return this.inBounds(x, y) ? this.propByTile.get(y * this.width + x) : undefined;
  }

  /** Every prop, sorted top-to-bottom then left-to-right (the order a renderer draws them in). */
  get props(): Prop[] {
    return [...this.propByTile.values()].sort((a, b) => a.y - b.y || a.x - b.x);
  }
}
