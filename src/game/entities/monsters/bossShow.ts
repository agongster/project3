/**
 * The boss "presentation": when a boss notices the hero, boss music starts,
 * the camera eases toward the boss for the intro (BOSS_INTRO_SEC), and a
 * banner with its name and the finding it stands for slides in at the top
 * of the screen. A champion (champion.ts) gets the same show with its own
 * banner and a shorter camera pull.
 */
import { drawText } from "@/game/art/font";
import { VIEW_W } from "../../bridge";
import type { SceneContext } from "../../scenes/context";
import { BOSS_INTRO_SEC } from "./boss";
import type { Monster } from "./monster";
import { tagText } from "./nameTags";

const BANNER_SEC = 2.8;
const BANNER_SLIDE_SEC = 0.3;
/** Below the HUD's top row (location pill and boss bar), so the bar never covers the name. */
const BANNER_TOP_PX = 40;
const BANNER_HEIGHT_PX = 34;
const BANNER_BG = "#1a1226";
const BANNER_BG_ALPHA = 0.72;
const TITLE_COLOR = "#ffd36b";
const SUBTITLE_COLOR = "#ffb3c7";
const OUTLINE = "#2b1d34";
/** The camera looks at this point above the boss's feet. */
const FOCUS_LIFT_PX = 16;

export class BossShow {
  private banner: { title: string; subtitle: string; age: number } | null = null;
  private focus: Monster | null = null;
  private focusLeft = 0;

  /** `banner` defaults to the boss's name over its finding; `focusSec` to the boss intro's length. */
  introduce(ctx: SceneContext, boss: Monster, banner?: { title: string; subtitle: string }, focusSec = BOSS_INTRO_SEC): void {
    this.banner = { ...(banner ?? { title: boss.def.name.toUpperCase(), subtitle: tagText(boss.finding) }), age: 0 };
    this.focus = boss;
    this.focusLeft = focusSec;
    ctx.audio.music("boss");
  }

  /** Call after the scene moved the camera: pulls it toward the boss during the intro. */
  update(ctx: SceneContext, dt: number): void {
    if (this.banner) {
      this.banner.age += dt;
      if (this.banner.age >= BANNER_SEC) this.banner = null;
    }
    if (!this.focus) return;
    this.focusLeft -= dt;
    if (this.focusLeft <= 0 || !this.focus.alive) {
      this.focus = null;
      return;
    }
    // A second follow per step toward the boss: the camera settles between hero and boss.
    ctx.camera.follow(this.focus.x, this.focus.y - FOCUS_LIFT_PX, dt);
  }

  /** The hero fainted: drop the show and go back to the dungeon tune. */
  cancel(ctx: SceneContext): void {
    this.banner = null;
    this.focus = null;
    ctx.audio.music("dungeon");
  }

  /** Screen-space banner, drawn from the world overlay (so the camera offset is added back). */
  draw(g: CanvasRenderingContext2D, ctx: SceneContext): void {
    if (!this.banner) return;
    const { age, title, subtitle } = this.banner;
    const slideIn = Math.min(1, age / BANNER_SLIDE_SEC);
    const slideOut = Math.min(1, (BANNER_SEC - age) / BANNER_SLIDE_SEC);
    const k = Math.min(slideIn, slideOut);
    const left = ctx.camera.left;
    const top = ctx.camera.top + BANNER_TOP_PX - (1 - k) * (BANNER_TOP_PX + BANNER_HEIGHT_PX);
    g.save();
    g.globalAlpha = BANNER_BG_ALPHA * k;
    g.fillStyle = BANNER_BG;
    g.fillRect(left, Math.round(top), VIEW_W, BANNER_HEIGHT_PX);
    g.restore();
    const cx = left + VIEW_W / 2;
    drawText(g, title, cx, Math.round(top) + 5, { color: TITLE_COLOR, outline: OUTLINE, align: "center", scale: 2, alpha: k });
    drawText(g, subtitle, cx, Math.round(top) + 23, { color: SUBTITLE_COLOR, outline: OUTLINE, align: "center", alpha: k });
  }
}
