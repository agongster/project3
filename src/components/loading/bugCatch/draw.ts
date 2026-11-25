/**
 * Paints one frame of Bug Catch from the current state. Reads, never writes.
 *
 * Layers, back to front:
 *   static backdrop (sky, hills, trees, ground) → clouds/stars → shadows →
 *   fallers (with their parachutes / leaves) → hero + net → particles →
 *   theme overlay (night tint) + glows → ambient motes → HUD and texts
 *
 * All coordinates are internal canvas pixels (GAME_W × GAME_H); the
 * component scales the canvas up with CSS.
 */
import { drawSprite, glowSprite, renderCharacter, THEME_COLORS, WALK_CYCLE, type Sprite } from "@/game/art";
import { monsterSprite } from "@/game/art/monsters";
import { uiSprite } from "@/game/art/ui";
import type { CharacterLook, ThemeId } from "@/lib/types";
import type { Ambient } from "./ambient";
import { backdropFor, drawSkyLife, isNightSky } from "./backdrop";
import type { Effects } from "./effects";
import type { Faller } from "./fallers";
import { drawAmbient, drawFallerShadow, drawHeroShadow, drawNet, drawParticles, drawPickup } from "./drawBits";
import { drawHud } from "./drawHud";
import { leafSprite, parachuteSprite } from "./gliders";
import { goldenSprite } from "./golden";
import type { SimState } from "./sim";
import { GAME_H, GAME_W, GROUND_Y, STRIDE_PIXELS } from "./tuning";

/** Everything one frame needs. */
export interface Scene {
  sim: SimState;
  fx: Effects;
  ambient: Ambient;
  theme: ThemeId;
  look: CharacterLook;
  hatId: string | null;
}

/** Below this speed the hero stands still instead of playing the walk cycle. */
const WALK_MIN_SPEED = 12;
/** How much wider / shorter the hero gets at full squash. */
const SQUASH_WIDEN = 0.22;
const SQUASH_FLATTEN = 0.18;
/** Monster idle animation speed (seconds per frame); bats flap faster. */
const BUG_FRAME_SECONDS = 0.22;
const BAT_FRAME_SECONDS = 0.1;
/** A sparkle jumps to a new spot around each golden bug this often, at this distance. */
const TWINKLE_SECONDS = 0.3;
const TWINKLE_RADIUS = 9;
/** A falling bug hangs this far below its glider's anchor. */
const GLIDER_GAP = 1;
/** Max tilt of a glider while its bug sways (radians). */
const GLIDER_TILT = 0.18;

export function drawScene(ctx: CanvasRenderingContext2D, scene: Scene): void {
  const { sim, theme } = scene;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(backdropFor(theme), 0, 0);
  drawSkyLife(ctx, theme, sim.time);

  for (const f of sim.fallers) drawFallerShadow(ctx, f);
  drawHeroShadow(ctx, sim.hero);
  for (const f of sim.fallers) drawFaller(ctx, f, theme, sim.time);
  drawHero(ctx, scene);
  drawParticles(ctx, scene.fx);

  drawThemeOverlay(ctx, theme);
  if (isNightSky(theme)) drawNightGlows(ctx, sim.fallers);
  drawAmbient(ctx, scene.ambient, theme);
  drawHud(ctx, scene);
}

// ───────────────────────────── fallers ─────────────────────────────

function drawFaller(ctx: CanvasRenderingContext2D, f: Faller, theme: ThemeId, time: number): void {
  if (f.kind === "coin" || f.kind === "heart") {
    drawPickup(ctx, f, time);
    return;
  }
  const frameSeconds = f.kind === "echoBat" ? BAT_FRAME_SECONDS : BUG_FRAME_SECONDS;
  const sprite = monsterSprite(f.kind, Math.floor(time / frameSeconds) + f.id);
  const feetY = f.y + sprite.h / 2;
  const flipX = f.hopping ? f.vx < 0 : f.id % 2 === 0;
  if (!f.hopping && f.kind !== "echoBat") drawGlider(ctx, f, theme, f.y - sprite.h / 2 + GLIDER_GAP, time);
  drawSprite(ctx, f.golden ? goldenSprite(sprite) : sprite, f.x, feetY, { flipX });
  if (f.golden) drawGoldTwinkle(ctx, f, time);
}

/** Dust bunnies ride parachutes, todo mites hold a leaf; both tilt gently as they sway. */
function drawGlider(ctx: CanvasRenderingContext2D, f: Faller, theme: ThemeId, topY: number, time: number): void {
  const glider = f.kind === "dustBunny" ? parachuteSprite(f.id, f.golden) : leafSprite(theme, f.golden);
  const tilt = GLIDER_TILT * Math.sin(time * 2 + f.id);
  drawSprite(ctx, glider, f.x, topY, { rotation: tilt });
}

/**
 * A sparkle that hops to a new spot around a golden bug every TWINKLE_SECONDS.
 * The spot comes from a tiny hash of (bug id, hop number), so it looks random
 * but needs no extra state.
 */
function drawGoldTwinkle(ctx: CanvasRenderingContext2D, f: Faller, time: number): void {
  const hop = Math.floor(time / TWINKLE_SECONDS);
  const angle = ((f.id * 7 + hop * 13) % 16) * (Math.PI / 8);
  const frame = Math.floor(((time % TWINKLE_SECONDS) / TWINKLE_SECONDS) * 3);
  const sparkle = uiSprite("sparkle", frame);
  drawSprite(ctx, sparkle, f.x + Math.cos(angle) * TWINKLE_RADIUS, f.y + Math.sin(angle) * TWINKLE_RADIUS);
}

// ───────────────────────────── hero ─────────────────────────────

function drawHero(ctx: CanvasRenderingContext2D, scene: Scene): void {
  const hero = scene.sim.hero;
  const sheet = renderCharacter(scene.look, scene.hatId);
  const walking = Math.abs(hero.vx) > WALK_MIN_SPEED;
  const step = walking ? WALK_CYCLE[Math.floor(hero.distance / STRIDE_PIXELS) % WALK_CYCLE.length] : 0;
  const sprite = sheet.frame(hero.facing === 1 ? "right" : "left", step);
  drawSquashed(ctx, sprite, hero.x, GROUND_Y, hero.squash);
  drawNet(ctx, hero, step);
}

/** Draws a feet-anchored sprite squashed (wider + shorter) by `amount` (0–1). */
function drawSquashed(ctx: CanvasRenderingContext2D, sprite: Sprite, x: number, y: number, amount: number): void {
  if (amount <= 0) {
    drawSprite(ctx, sprite, x, y);
    return;
  }
  const w = Math.round(sprite.w * (1 + SQUASH_WIDEN * amount));
  const h = Math.round(sprite.h * (1 - SQUASH_FLATTEN * amount));
  ctx.drawImage(sprite.canvas, Math.round(x - w / 2), Math.round(y - h), w, h);
}

// ───────────────────────────── theme light ─────────────────────────────

function drawThemeOverlay(ctx: CanvasRenderingContext2D, theme: ThemeId): void {
  const colors = THEME_COLORS[theme];
  if (colors.overlayAlpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = colors.overlayAlpha;
  ctx.fillStyle = colors.overlay;
  ctx.fillRect(0, 0, GAME_W, GAME_H);
  ctx.restore();
}

/** At night golden bugs, coins and hearts glow softly through the dark. */
function drawNightGlows(ctx: CanvasRenderingContext2D, fallers: Faller[]): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const f of fallers) {
    if (!f.golden && f.kind !== "coin" && f.kind !== "heart") continue;
    drawSprite(ctx, glowSprite(14, f.kind === "heart" ? "#ff9ebb" : "#ffd36b"), f.x, f.y);
  }
  ctx.restore();
}
