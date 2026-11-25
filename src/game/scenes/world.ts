/**
 * The parts of updating and drawing that the overworld and dungeons share:
 * the hero, pet, trail, projectiles, pickups, particles, camera, the
 * y-sorted draw pass, lighting, ambient particles and screen effects.
 *
 * A scene calls `updateShared` once per step and `renderShared` once per
 * frame, passing in its own drawables (props, buildings, villagers...) and
 * lights. Draw order:
 *
 *   backdrop → ground → shadows → y-sorted objects → attack FX → particles
 *   → (tint / darkness + lights) → ambient → world overlays (badges, labels,
 *   floating text) → vignette → screen flashes
 */
import { uiSprite } from "@/game/art/ui";
import { VIEW_H, VIEW_W } from "../bridge";
import type { Ambient } from "../engine/ambient";
import type { Lighting, Darkness } from "../engine/lighting";
import { drawVignette } from "../engine/lighting";
import type { GroundRenderer } from "../engine/tiles";
import { facingVector } from "../entities/facing";
import { emitDust } from "../entities/playerFx";
import { quantizeDash } from "../hud";
import type { SceneContext } from "./context";
import type { Drawable, Light } from "./scene";

/** The camera looks this far ahead of the hero in the facing direction. */
const CAMERA_LEAD_PX = 14;
/** Seconds the hero lies dazed before the screen fades out. */
const FAINT_DELAY_SEC = 1.1;
/** Light around the hero in the dark. */
const HERO_LIGHT: Omit<Light, "x" | "y"> = { radius: 34, color: "#ffe8b8", strength: 0.9 };

export interface SharedLayers {
  backdrop: string;
  ground: GroundRenderer;
  /** The scene's own y-sorted objects (props, buildings, villagers, breakables...). */
  drawables: Drawable[];
  lights: Light[];
  /** Night / dungeon darkness, or null in daylight. */
  darkness: Darkness | null;
  /** A light full-screen colour tint (autumn warmth, snowy blue), or null. */
  tint: { color: string; alpha: number } | null;
  vignette: { color: string; alpha: number } | null;
  lighting: Lighting;
  ambient: Ambient;
  /** World-space things drawn above the lighting (badges, labels). */
  overlay?: (g: CanvasRenderingContext2D) => void;
}

/** Simulation shared by all scenes. Returns false while a hit-stop freezes the action. */
export function updateShared(ctx: SceneContext, dt: number): boolean {
  if (ctx.juice.consumeHitStop(dt)) return false;
  const game = ctx.game;
  const player = game.player;
  ctx.time += dt;
  game.combo.update(dt);
  player.update(dt, ctx);
  game.pet.update(dt, ctx);
  game.trail.update(dt, ctx);
  ctx.projectiles.update(dt);
  ctx.pickups.update(dt);
  ctx.particles.update(dt);
  ctx.juice.update(dt);
  const lead = facingVector(player.facing);
  ctx.camera.follow(player.x + lead.x * CAMERA_LEAD_PX, player.y - 8 + lead.y * CAMERA_LEAD_PX * 0.6, dt);
  ctx.camera.update(dt, ctx.save.get().settings.screenShake);
  game.hud.patch({ hp: player.hp, maxHp: player.maxHp, combo: game.combo.count, dashReady: quantizeDash(player.dashReady) });
  return true;
}

/** Adds the hero's own light (night, dungeons). */
export function heroLight(ctx: SceneContext, out: Light[]): void {
  const p = ctx.game.player;
  out.push({ ...HERO_LIGHT, x: p.x, y: p.y - 8 });
}

export function renderShared(ctx: SceneContext, g: CanvasRenderingContext2D, layers: SharedLayers): void {
  const game = ctx.game;
  const cam = ctx.camera;
  const left = cam.left;
  const top = cam.top;

  g.fillStyle = layers.backdrop;
  g.fillRect(0, 0, VIEW_W, VIEW_H);

  g.save();
  g.translate(-left, -top);
  layers.ground.draw(g, game.theme(), left, top, VIEW_W, VIEW_H, ctx.time);

  const list = layers.drawables;
  list.push(game.player.drawable(ctx));
  const petDrawable = game.pet.drawable();
  if (petDrawable) list.push(petDrawable);
  ctx.pickups.drawables(list);
  ctx.projectiles.drawables(list);
  for (const d of list) d.shadow?.(g);
  list.sort((a, b) => a.y - b.y);
  for (const d of list) d.draw(g);
  game.player.attack.drawFx(g, game.player);
  ctx.particles.draw(g);
  g.restore();

  if (layers.tint) {
    g.globalAlpha = layers.tint.alpha;
    g.fillStyle = layers.tint.color;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    g.globalAlpha = 1;
  }
  if (layers.darkness || layers.lights.length > 0) layers.lighting.draw(g, VIEW_W, VIEW_H, left, top, layers.darkness, layers.lights);
  layers.ambient.draw(g, left, top);

  g.save();
  g.translate(-left, -top);
  layers.overlay?.(g);
  ctx.juice.drawWorld(g);
  g.restore();

  if (layers.vignette) drawVignette(g, VIEW_W, VIEW_H, layers.vignette.color, layers.vignette.alpha);
  ctx.juice.drawScreen(g, VIEW_W, VIEW_H);
}

/**
 * Fainting (HP reached 0): the hero lies dazed for a moment under circling
 * stars, the screen fades out, `respawn` puts them somewhere safe with full
 * health, and the screen fades back in. No penalty — it's a cozy game.
 */
export class FaintSequence {
  private timer = -1;

  get active(): boolean {
    return this.timer >= 0;
  }

  /** Call every step; starts the sequence when HP hits 0. */
  update(dt: number, ctx: SceneContext, respawn: () => void): void {
    const player = ctx.game.player;
    if (this.timer < 0) {
      if (player.hp > 0 || player.fainted) return;
      player.fainted = true;
      this.timer = 0;
      ctx.audio.sfx("faint");
      ctx.juice.flash("#2b1d34", 0.4, 0.6);
      emitDust(ctx, player.x, player.y, 6);
      return;
    }
    const before = this.timer;
    this.timer += dt;
    if (Math.floor(before * 4) !== Math.floor(this.timer * 4)) {
      ctx.particles.emit({ x: player.x + (Math.random() - 0.5) * 12, y: player.y, z: player.height + 2, vz: 8, life: 0.7, sprite: uiSprite("star", 0) });
    }
    if (before < FAINT_DELAY_SEC && this.timer >= FAINT_DELAY_SEC) {
      ctx.game.fade(() => {
        this.timer = -1;
        respawn();
        player.restore(ctx.stats.maxHp);
        ctx.emit({ type: "toast", text: "You fainted… but you're back on your feet!", tone: "info" });
      });
    }
  }
}
