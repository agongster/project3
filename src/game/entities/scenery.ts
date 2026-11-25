/**
 * Static scenery: drawing props (trees, lamps, the well...) with their
 * animation frames, and the "see-through" rule for tall sprites.
 *
 * SEE-THROUGH: a tree canopy or a roof can completely hide the hero when
 * they walk behind it. When the hero's feet are ABOVE the base of a tall
 * sprite (= behind it) and the two pictures overlap on screen, the tall
 * sprite is drawn at TALL_ALPHA so the hero is never lost.
 */
import { drawSprite, getAtlas, PROP_FRAMES, PROP_LIGHTS, type Sprite } from "@/game/art";
import type { Prop, PropKind, ThemeId } from "@/lib/types";
import type { Drawable, Light } from "../scenes/scene";

/** Opacity of a tall sprite while the hero stands behind it. */
export const TALL_ALPHA = 0.45;
/** Seconds per prop animation frame (lamps, fountain, torches...). */
export const PROP_FRAME_SEC = 0.16;
/** Approximate on-screen box of the hero relative to their feet. */
const HERO_BOX = { dx: -7, dy: -22, w: 14, h: 22 };
/** Flame height above the anchor of a wall-sconce torch (see art/dungeonProps.ts torchArt). */
const SCONCE_FLAME_DY = -12;
const TALL_KINDS: ReadonlySet<PropKind> = new Set<PropKind>(["tree", "treeAlt", "lamp", "fountain", "board", "wardrobe", "well"]);

/** True when a sprite drawn with its anchor at (x, y) hides the hero standing behind it. */
export function hidesHero(sprite: Sprite, x: number, y: number, hero: { x: number; y: number }): boolean {
  if (hero.y >= y) return false; // hero is in front
  const left = x - sprite.ax;
  const top = y - sprite.ay;
  const hx = hero.x + HERO_BOX.dx;
  const hy = hero.y + HERO_BOX.dy;
  return hx < left + sprite.w && hx + HERO_BOX.w > left && hy < top + sprite.h && hy + HERO_BOX.h > top;
}

/** World position of a prop's anchor (bottom-centre of its tile). */
export function propAnchor(p: Prop): { x: number; y: number } {
  return { x: p.x * 16 + 8, y: p.y * 16 + 16 };
}

/** The current animation frame of a prop (variants are offset so lamps don't flicker in sync). */
export function propFrame(p: Prop, time: number): number {
  return (PROP_FRAMES[p.kind] ?? 1) > 1 ? Math.floor(time / PROP_FRAME_SEC) + p.variant : 0;
}

/** Drawables for the props whose tile is visible. */
export function propDrawables(props: readonly Prop[], theme: ThemeId, time: number, hero: { x: number; y: number }, visible: (x: number, y: number) => boolean, out: Drawable[]): void {
  const atlas = getAtlas(theme);
  for (const p of props) {
    const a = propAnchor(p);
    if (!visible(a.x, a.y)) continue;
    const sprite = atlas.prop(p.kind, p.variant, propFrame(p, time));
    const seeThrough = TALL_KINDS.has(p.kind) && hidesHero(sprite, a.x, a.y, hero);
    out.push({ y: a.y, draw: (g) => drawSprite(g, sprite, a.x, a.y, seeThrough ? { alpha: TALL_ALPHA } : undefined) });
  }
}

/**
 * Lights of glowing props. `dark` = night theme or dungeon; props marked
 * `night` in PROP_LIGHTS only glow then. Torches flicker.
 */
export function propLights(props: readonly Prop[], dark: boolean, time: number, visible: (x: number, y: number) => boolean, out: Light[]): void {
  for (const p of props) {
    const l = PROP_LIGHTS[p.kind];
    if (!l || (l.night && !dark)) continue;
    const a = propAnchor(p);
    if (!visible(a.x, a.y)) continue;
    const isTorch = p.kind === "torch";
    const flicker = isTorch ? Math.sin(time * 9 + p.x * 3) * 1.5 + Math.sin(time * 23 + p.y) : 0;
    // PROP_LIGHTS describes the tall standing torch; odd variants are short wall sconces whose flame sits lower.
    const dy = isTorch && p.variant % 2 === 1 ? SCONCE_FLAME_DY : l.dy;
    out.push({ x: a.x + l.dx, y: a.y + dy, radius: l.radius + flicker, color: l.color });
  }
}
