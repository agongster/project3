/**
 * Everything drawn on top of the world: the score in the corner (bitmap font
 * + coin icon), the "READY? CATCH!" intro, bonus banners, the floating
 * "+1" / "x6!" texts and the big-net timer.
 *
 * The loading screen around the canvas shows the progress bar and tips; the
 * only number inside the canvas is the score.
 */
import { drawSprite } from "@/game/art";
import { drawText } from "@/game/art/font";
import { uiSprite } from "@/game/art/ui";
import type { Scene } from "./draw";
import { TEXT_COLORS, TEXT_RISE } from "./effects";
import { BIG_NET_SECONDS, GAME_W, GROUND_Y, INTRO_SECONDS, READY_SECONDS } from "./tuning";

const OUTLINE = "#2b1d34";
/** Score panel position (top-left corner). */
const SCORE_X = 8;
const SCORE_Y = 8;
/** For this long after a catch the score jumps up a pixel and flashes gold. */
const SCORE_POP_SECONDS = 0.15;
/** Intro words pop in from this scale... */
const INTRO_POP_SCALE = 4;
/** ...and settle at this one. */
const INTRO_SCALE = 3;
const INTRO_Y = 64;
/** Banners slide down to this y. */
const BANNER_Y = 40;
const BANNER_SLIDE_PX = 10;
/** Big-net timer bar, just under the hero's feet (above the head it would hide the net). */
const NET_BAR_W = 20;
const NET_BAR_Y = GROUND_Y + 3;

export function drawHud(ctx: CanvasRenderingContext2D, scene: Scene): void {
  drawFloatTexts(ctx, scene);
  drawBigNetTimer(ctx, scene);
  drawBanner(ctx, scene);
  drawIntro(ctx, scene.sim.time);
  drawScore(ctx, scene);
}

function drawScore(ctx: CanvasRenderingContext2D, scene: Scene): void {
  const { sim } = scene;
  const popping = sim.time - sim.lastCatchAt < SCORE_POP_SECONDS;
  const coin = uiSprite("coin", 0);
  drawSprite(ctx, coin, SCORE_X + coin.ax, SCORE_Y + coin.ay);
  drawText(ctx, String(sim.score), SCORE_X + coin.w + 3, SCORE_Y + (popping ? -1 : 0) + 1, {
    color: popping ? TEXT_COLORS.golden : TEXT_COLORS.normal,
    outline: OUTLINE,
    scale: 2,
  });
}

/** "READY?" then "CATCH!", each popping in large and settling. */
function drawIntro(ctx: CanvasRenderingContext2D, time: number): void {
  if (time >= INTRO_SECONDS) return;
  const ready = time < READY_SECONDS;
  const wordStart = ready ? 0 : READY_SECONDS;
  const scale = time - wordStart < 0.08 ? INTRO_POP_SCALE : INTRO_SCALE;
  const fadeOut = ready ? 1 : Math.min(1, (INTRO_SECONDS - time) / 0.2);
  drawText(ctx, ready ? "READY?" : "CATCH!", GAME_W / 2, INTRO_Y, {
    color: ready ? TEXT_COLORS.normal : TEXT_COLORS.golden,
    outline: OUTLINE,
    align: "center",
    scale,
    alpha: fadeOut,
  });
}

function drawBanner(ctx: CanvasRenderingContext2D, scene: Scene): void {
  const banner = scene.fx.banner;
  if (!banner) return;
  const t = banner.age / banner.life;
  const slide = Math.max(0, 1 - banner.age / 0.15) * BANNER_SLIDE_PX;
  const alpha = t > 0.8 ? (1 - t) / 0.2 : 1;
  drawText(ctx, banner.text, GAME_W / 2, BANNER_Y - slide, { color: banner.color, outline: OUTLINE, align: "center", scale: 2, alpha });
}

function drawFloatTexts(ctx: CanvasRenderingContext2D, scene: Scene): void {
  for (const t of scene.fx.texts) {
    const k = t.age / t.life;
    const rise = TEXT_RISE * (1 - (1 - k) * (1 - k)); // fast at first, then slows (ease-out)
    const alpha = k > 0.7 ? (1 - k) / 0.3 : 1;
    drawText(ctx, t.text, Math.round(t.x), Math.round(t.y - rise), { color: t.color, outline: OUTLINE, align: "center", scale: t.scale, alpha });
  }
}

/** A shrinking bar under the hero while the big net lasts. */
function drawBigNetTimer(ctx: CanvasRenderingContext2D, scene: Scene): void {
  const hero = scene.sim.hero;
  if (hero.bigNetLeft <= 0) return;
  const left = Math.round(hero.x - NET_BAR_W / 2);
  const filled = Math.ceil((NET_BAR_W - 2) * (hero.bigNetLeft / BIG_NET_SECONDS));
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(left, NET_BAR_Y, NET_BAR_W, 4);
  ctx.fillStyle = TEXT_COLORS.bonus;
  ctx.fillRect(left + 1, NET_BAR_Y + 1, filled, 2);
}
