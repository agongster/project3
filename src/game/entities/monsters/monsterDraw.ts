/**
 * Drawing monsters: shadow, body (with squash & stretch, hit flash, the
 * dazed wobble, the death squash), the little badges over their heads ("!",
 * dizzy stars, "zzz") and the soft light they give off in the dark.
 */
import { drawSprite, flashSprite, monsterSprite, type Sprite } from "@/game/art";
import { uiSprite, type UiSpriteName } from "@/game/art/ui";
import type { MonsterKind } from "@/lib/types";
import type { Light } from "../../scenes/scene";
import { ALERT_SEC, HIT_FLASH_SEC, type Monster } from "./monster";

/** Shadow sprites from small to large, and the drawn body size (px) each one suits up to. */
const SHADOWS: readonly { upTo: number; name: UiSpriteName }[] = [
  { upTo: 20, name: "shadowSmall" },
  { upTo: 28, name: "shadowMedium" },
  { upTo: Infinity, name: "shadowLarge" },
];
/** A champion's glow reaches this much further than its species' own. */
const CHAMPION_GLOW_SCALE = 1.6;
/** Normal monsters squash flat over this long when defeated (bosses: see BOSS_DEATH_SEC in deaths.ts). */
export const DEATH_SQUASH_SEC = 0.3;
/** Strongest opacity of the white hit flash over the body (bosses get hit a lot, so theirs is softer). */
const FLASH_ALPHA = 0.85;
const BOSS_FLASH_ALPHA = 0.6;
/** Wind-up trembling amplitude (px). */
const SHIVER_PX = 1;
/** How fast the "!" pops in. */
const ALERT_POP_SEC = 0.12;
/** Dizzy stars circle this far from the centre of the head. */
const DIZZY_RADIUS_PX = 6;
/** A resting monster shows two dizzy stars; a dazed one (waiting to be finished) three, spinning faster. */
const DIZZY_STARS = 2;
const DAZED_STARS = 3;
const DIZZY_SPIN = 5;
const DAZED_SPIN = 8;
/** The dazed wobble: the body rocks on its feet this far (radians), this many times per second. */
const DAZED_WOBBLE_RAD = 0.16;
const DAZED_WOBBLE_HZ = 1.6;

/** The soft light each monster gives off (so it never vanishes in a dark corner). */
const GLOW: Record<MonsterKind, { radius: number; color: string }> = {
  dustBunny: { radius: 14, color: "#d8cff0" },
  todoMite: { radius: 14, color: "#ffe08a" },
  echoBat: { radius: 14, color: "#b58cff" },
  gremlin: { radius: 16, color: "#9dff8a" },
  phantom: { radius: 20, color: "#8affe0" },
  mimic: { radius: 14, color: "#ffd36b" },
  swallowToad: { radius: 16, color: "#9be36b" },
  spaghetti: { radius: 20, color: "#ffc46b" },
  keyThief: { radius: 36, color: "#9d8aff" },
  evalSerpent: { radius: 36, color: "#6b8aff" },
  glitchKing: { radius: 36, color: "#ff6bd2" },
};

/** Cache of colour-tinted silhouettes (glitch after-images), keyed by sprite then colour. */
const tintCache = new WeakMap<Sprite, Map<string, Sprite>>();

/** A one-colour silhouette of `sprite` (cached; safe to call every frame). */
export function tinted(sprite: Sprite, color: string): Sprite {
  let byColor = tintCache.get(sprite);
  if (!byColor) tintCache.set(sprite, (byColor = new Map()));
  let out = byColor.get(color);
  if (!out) {
    const c = document.createElement("canvas");
    c.width = sprite.w;
    c.height = sprite.h;
    const g = c.getContext("2d")!;
    g.drawImage(sprite.canvas, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = color;
    g.fillRect(0, 0, sprite.w, sprite.h);
    out = { ...sprite, canvas: c };
    byColor.set(color, out);
  }
  return out;
}

/** The sprite for the monster's current pose. */
export function currentSprite(m: Monster): Sprite {
  // A dazed monster's brain is switched off, so it shows its plain face.
  const pose = m.dazed ? null : (m.trait?.pose?.(m) ?? m.brain.pose?.(m));
  return monsterSprite(m.species, pose?.frame ?? m.idleFrame(), pose?.variant ?? "normal", m.look);
}

/** How white the body is drawn over: a fading flash after a hit, blinking while it dies. */
function flashAmount(m: Monster): number {
  if (m.dyingFor >= 0) return Math.floor(m.dyingFor * 20) % 2 === 0 ? 1 : 0;
  return (m.flash / HIT_FLASH_SEC) * (m.isBoss || m.champion ? BOSS_FLASH_ALPHA : FLASH_ALPHA);
}

export function drawMonsterShadow(g: CanvasRenderingContext2D, m: Monster): void {
  if (m.alpha < 0.2) return;
  const fade = Math.max(0.35, 1 - m.z / 30);
  const drawnSize = m.def.size * m.sizeScale;
  const shadow = SHADOWS.find((s) => drawnSize <= s.upTo) ?? SHADOWS[0];
  drawSprite(g, uiSprite(shadow.name), m.x, m.y, { alpha: fade * m.alpha });
}

/** Horizontal and vertical scale for squash & stretch, the flattening death squash, and its size (look, modifier, champion and a trait's growth). */
function bodyScale(m: Monster, deathSec: number): { sx: number; sy: number } {
  const size = m.scale * m.sizeScale;
  if (m.dyingFor >= 0) {
    const k = Math.min(1, m.dyingFor / deathSec);
    return { sx: (1 + 0.6 * k) * size, sy: Math.max(0.15, 1 - 0.8 * k) * size };
  }
  return { sx: (1 - m.stretch * 0.6) * size, sy: (1 + m.stretch) * size };
}

export function drawMonsterBody(g: CanvasRenderingContext2D, m: Monster, deathSec: number): void {
  if (m.alpha <= 0.02) return;
  if (!m.dazed) m.brain.drawBehind?.(g, m);
  if (m.alive) m.trait?.drawBehind?.(g, m, m.anim);
  const sprite = currentSprite(m);
  const jitter = m.shiver ? (Math.floor(m.anim * 30) % 2 === 0 ? -SHIVER_PX : SHIVER_PX) : 0;
  const { sx, sy } = bodyScale(m, deathSec);
  g.save();
  g.globalAlpha *= m.alpha;
  g.translate(Math.round(m.x + jitter), Math.round(m.y - m.z));
  if (m.dazed) g.rotate(Math.sin(m.dazedFor * DAZED_WOBBLE_HZ * Math.PI * 2) * DAZED_WOBBLE_RAD);
  g.scale(m.facingLeft ? -sx : sx, sy);
  g.drawImage(sprite.canvas, -sprite.ax, -sprite.ay);
  const flash = flashAmount(m);
  if (flash > 0) {
    g.globalAlpha *= flash;
    g.drawImage(flashSprite(sprite).canvas, -sprite.ax, -sprite.ay);
  }
  g.restore();
}

/** Top of the monster's head in world pixels (for badges and name tags). */
export function headY(m: Monster): number {
  return m.y - m.z - m.def.size * m.scale * m.sizeScale * (1 + Math.max(0, m.stretch));
}

/** "!", dizzy stars and "zzz" over the head. Drawn above the darkness so they always read. */
export function drawMonsterBadges(g: CanvasRenderingContext2D, m: Monster, time: number): void {
  if (!m.alive || m.alpha < 0.3) return;
  const top = headY(m);
  if (m.alert > 0) {
    // Pops up a few pixels right after it appears.
    const shownFor = ALERT_SEC - Math.min(ALERT_SEC, m.alert);
    const rise = Math.min(1, shownFor / ALERT_POP_SEC);
    drawSprite(g, uiSprite("alert"), m.x, top - 2 - 3 * rise);
  }
  if (m.dizzy) {
    const stars = m.dazed ? DAZED_STARS : DIZZY_STARS;
    const spin = m.dazed ? DAZED_SPIN : DIZZY_SPIN;
    for (let i = 0; i < stars; i++) {
      const a = time * spin + (i / stars) * Math.PI * 2;
      drawSprite(g, uiSprite("star"), m.x + Math.cos(a) * DIZZY_RADIUS_PX, top + 2 + Math.sin(a) * 2);
    }
  }
  if (m.sleepy) {
    const bob = Math.round(Math.sin(time * 2) * 2);
    drawSprite(g, uiSprite("zzz"), m.x + 6, top - 1 + bob);
  }
}

/** The monster's glow (bosses get a big aura, champions a bigger one than their species). */
export function monsterLight(m: Monster): Light | null {
  if (!m.alive || m.alpha < 0.2) return null;
  const glow = GLOW[m.species];
  const radius = m.champion ? glow.radius * CHAMPION_GLOW_SCALE : glow.radius;
  return { x: m.x, y: m.y - (m.def.size * m.sizeScale) / 2 - m.z, radius, color: glow.color, strength: 0.55 * m.alpha };
}
