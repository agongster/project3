/**
 * Tiny hand-made village scenes drawn with the art atlas, for the menus:
 * the theme cards in `ThemePicker` and the panning backdrop of the title
 * screen both use `drawScenery`.
 *
 * A scene is written as text (one letter per 16×16 ground tile) plus lists of
 * buildings and props, so it is easy to edit by eye:
 *
 *   g grass · m meadow · p path · z plaza · w water · s sand · b bridge
 *
 * This is a much smaller cousin of the real engine's renderer: no camera, no
 * collision, just "paint these tiles and sprites in the right order".
 */
import { autotileMask, BUILDING_SIZE, drawSprite, getAtlas, glowSprite, PROP_LIGHTS, THEME_COLORS, type BuildingState, type Sprite } from "@/game/art";
import { TILE } from "@/lib/game/catalog";
import { Ground, type BuildingKind, type GroundId, type PropKind, type ThemeId } from "@/lib/types";

/** One ground tile is TILE × TILE pixels (16). */
const TILE_PX = TILE;

const GROUND_CODES: Record<string, GroundId> = {
  g: Ground.Grass,
  m: Ground.Meadow,
  p: Ground.Path,
  z: Ground.Plaza,
  w: Ground.Water,
  s: Ground.Sand,
  b: Ground.Bridge,
};

/** Ground tiles animate (water ripples) at this pace; props (lamps, well) too. */
const ANIM_FRAME_MS = 220;

/** Objects whose anchor is further than this outside the view cannot be seen. */
const OFFSCREEN_MARGIN_PX = 96;

export interface SceneryBuilding {
  kind: BuildingKind;
  /** Top-left tile of the footprint (its size comes from BUILDING_SIZE). */
  x: number;
  y: number;
  state: BuildingState;
  variant: number;
}

export interface SceneryProp {
  kind: PropKind;
  /** Tile of the prop's base. */
  x: number;
  y: number;
  variant?: number;
}

export interface Scenery {
  /** Ground letters, one string per tile row (all rows the same length). */
  rows: readonly string[];
  buildings: readonly SceneryBuilding[];
  props: readonly SceneryProp[];
  /** True if the scene repeats left/right forever (the title backdrop pans through it). */
  wrap: boolean;
}

/** The visible window into the scene, in scene pixels. */
export interface SceneryView {
  x: number;
  y: number;
  w: number;
  h: number;
  timeMs: number;
}

export function sceneryWidthPx(scenery: Scenery): number {
  return scenery.rows[0].length * TILE_PX;
}

export function sceneryHeightPx(scenery: Scenery): number {
  return scenery.rows.length * TILE_PX;
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/**
 * Ground id at a tile. Outside the scene we wrap (for repeating scenes) or
 * repeat the edge tile, so the autotiler never draws a border at the edge.
 */
function groundLookup(scenery: Scenery): (x: number, y: number) => number {
  const cols = scenery.rows[0].length;
  const rows = scenery.rows.length;
  return (x, y) => {
    const tx = scenery.wrap ? mod(x, cols) : Math.min(cols - 1, Math.max(0, x));
    const ty = Math.min(rows - 1, Math.max(0, y));
    return GROUND_CODES[scenery.rows[ty][tx]] ?? Ground.Grass;
  };
}

function drawGround(ctx: CanvasRenderingContext2D, theme: ThemeId, scenery: Scenery, view: SceneryView, frame: number): void {
  const atlas = getAtlas(theme);
  const at = groundLookup(scenery);
  // The first and last tile the view touches (a repeating scene has no left/right edge).
  const firstCol = Math.floor(view.x / TILE_PX);
  const lastCol = Math.ceil((view.x + view.w) / TILE_PX) - 1;
  const firstRow = Math.max(0, Math.floor(view.y / TILE_PX));
  const lastRow = Math.min(scenery.rows.length - 1, Math.ceil((view.y + view.h) / TILE_PX) - 1);
  for (let ty = firstRow; ty <= lastRow; ty++) {
    for (let tx = firstCol; tx <= lastCol; tx++) {
      const id = at(tx, ty) as GroundId;
      // A fixed per-tile number picks the tile's texture variation (stable while panning).
      const variant = (mod(tx, 97) * 7 + ty * 13) & 255;
      const sprite = atlas.ground(id, autotileMask(at, tx, ty), variant, frame);
      drawSprite(ctx, sprite, tx * TILE_PX - view.x, ty * TILE_PX - view.y);
    }
  }
}

/** A building or prop, ready to draw: both are anchored at the bottom-centre of their base. */
interface Placed {
  sprite: Sprite;
  /** Scene position of the sprite's anchor. */
  x: number;
  baseY: number;
}

/** Buildings and props as one list sorted back-to-front, so nearer things overlap farther ones. */
function placeObjects(theme: ThemeId, scenery: Scenery, frame: number): Placed[] {
  const atlas = getAtlas(theme);
  const placed: Placed[] = [];
  for (const b of scenery.buildings) {
    const size = BUILDING_SIZE[b.kind];
    placed.push({
      sprite: atlas.building(b.kind, b.state, b.variant),
      x: (b.x + size.w / 2) * TILE_PX,
      baseY: (b.y + size.h) * TILE_PX,
    });
  }
  for (const p of scenery.props) {
    placed.push({
      sprite: atlas.prop(p.kind, p.variant ?? 0, frame),
      x: p.x * TILE_PX + TILE_PX / 2,
      baseY: (p.y + 1) * TILE_PX,
    });
  }
  return placed.sort((a, b) => a.baseY - b.baseY);
}

/** Screen x for an object, taking the scene's horizontal repetition into account. */
function screenXs(scenery: Scenery, sceneX: number, view: SceneryView): number[] {
  if (!scenery.wrap) return [sceneX - view.x];
  const width = sceneryWidthPx(scenery);
  // The copy just left of, inside, and right of the view; big sprites can poke in from either side.
  const base = mod(sceneX - view.x, width);
  return [base - width, base, base + width];
}

/** Night themes darken the scene and let lamps glow through (additive light). */
function drawMood(ctx: CanvasRenderingContext2D, theme: ThemeId, scenery: Scenery, view: SceneryView): void {
  const colors = THEME_COLORS[theme];
  if (colors.overlayAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = colors.overlayAlpha;
    ctx.fillStyle = colors.overlay;
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.restore();
  }
  if (theme !== "night") return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of scenery.props) {
    const light = PROP_LIGHTS[p.kind];
    if (!light) continue;
    const glow = glowSprite(light.radius, light.color);
    for (const sx of screenXs(scenery, p.x * TILE_PX + TILE_PX / 2, view)) {
      drawSprite(ctx, glow, sx + light.dx, (p.y + 1) * TILE_PX - view.y + light.dy);
    }
  }
  ctx.restore();
}

/** Paints the part of `scenery` inside `view` onto `ctx` (whose origin is the view's top-left). */
export function drawScenery(ctx: CanvasRenderingContext2D, theme: ThemeId, scenery: Scenery, view: SceneryView): void {
  const frame = Math.floor(view.timeMs / ANIM_FRAME_MS);
  ctx.imageSmoothingEnabled = false;
  drawGround(ctx, theme, scenery, view, frame);

  for (const item of placeObjects(theme, scenery, frame)) {
    for (const sx of screenXs(scenery, item.x, view)) {
      // Skip copies that are far outside the view (the biggest buildings are ~70 px wide).
      if (sx < -OFFSCREEN_MARGIN_PX || sx > view.w + OFFSCREEN_MARGIN_PX) continue;
      drawSprite(ctx, item.sprite, sx, item.baseY - view.y);
    }
  }

  drawMood(ctx, theme, scenery, view);
}
