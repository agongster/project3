/**
 * A dungeon's PRIZE CHEST: it drops in once every monster is gone (or the
 * code was purified by editing), lands with a thud, glows and bobs under a
 * "look here" arrow until it is opened, and sparkles when it comes back
 * opened from the chest overlay.
 *
 * The dungeon scene owns one and decides WHEN it appears (`drop`, or `place`
 * for a dungeon that was already cleared on entry); this class handles how
 * it looks, the landing and the "Press E" spot.
 */
import { drawSprite } from "@/game/art";
import { uiSprite } from "@/game/art/ui";
import { getProgress } from "@/lib/game";
import type { Dungeon } from "@/lib/types";
import { playPoof } from "../entities/monsters/sceneWorld";
import { emitDust } from "../entities/playerFx";
import type { SceneContext } from "./context";
import type { Interactable } from "./interactions";
import type { Drawable, Light } from "./scene";

const CHEST_LIGHT = { radius: 26, color: "#ffd36b" };
/** The prize chest falls from this high and takes this long to land. */
const DROP_PX = 48;
const DROP_SEC = 0.45;
const LAND_SHAKE = 0.25;
/** The bobbing arrow floats this far above the chest's base. */
const ARROW_ABOVE_PX = 18;
const DROP_STARS = 20;
const RETURN_SPARKLES = 16;

export class PrizeChest {
  /** True once the chest stands in the dungeon. */
  shown = false;
  /** Seconds since it appeared (Infinity when it was already there on entry). */
  private age = Infinity;
  private openedAtResume = false;

  constructor(
    private readonly ctx: SceneContext,
    private readonly dungeon: Dungeon,
    private readonly path: string,
  ) {}

  /** Puts the chest in place at once (a dungeon cleared on an earlier visit). */
  place(): void {
    const { chest } = this.dungeon;
    this.shown = true;
    this.ctx.setBlocked(chest.x, chest.y, true);
    this.openedAtResume = this.opened();
  }

  /** The chest falls in with a puff and a burst of stars. */
  drop(): void {
    this.place();
    this.age = 0;
    const { x, y } = this.center();
    playPoof(this.ctx, x, y - 6);
    this.ctx.particles.burst(DROP_STARS, x, y, 60, { life: 1, sprite: uiSprite("star", 0), drag: 2 });
  }

  opened(): boolean {
    return getProgress(this.ctx.save.get(), this.ctx.repoKey).opened.includes(this.path);
  }

  /** The landing: a thud and a puff of dust. */
  update(dt: number): void {
    const before = this.age;
    this.age += dt;
    if (before < DROP_SEC && this.age >= DROP_SEC) {
      const { chest } = this.dungeon;
      emitDust(this.ctx, chest.x * 16 + 8, chest.y * 16 + 15, 6);
      this.ctx.shake(LAND_SHAKE);
      this.ctx.audio.sfx("slam", { pitch: 1.2, volume: 0.6 });
    }
  }

  /** The game resumed: celebrate if the chest just came back opened. */
  onResume(): void {
    const opened = this.opened();
    if (opened && !this.openedAtResume && this.shown) {
      const { x, y } = this.center();
      this.ctx.particles.burst(RETURN_SPARKLES, x, y, 50, { life: 0.9, sprite: uiSprite("sparkle", 0), drag: 2.5 });
    }
    this.openedAtResume = opened;
  }

  drawables(out: Drawable[]): void {
    if (!this.shown) return;
    const { chest } = this.dungeon;
    const x = chest.x * 16 + 8;
    const y = chest.y * 16 + 15;
    const opened = this.opened();
    const bob = opened ? 0 : Math.round(Math.sin(this.ctx.time * 4) * 1);
    const z = this.height();
    out.push({
      y,
      shadow: (g) => drawSprite(g, uiSprite("shadowMedium"), x, y),
      draw: (g) => {
        if (!opened && z === 0) drawSprite(g, uiSprite("chestGlow", Math.floor(this.ctx.time * 6)), x, y);
        drawSprite(g, uiSprite(opened ? "chestOpen" : "chestClosed"), x, y + bob - z);
      },
    });
  }

  lights(out: Light[]): void {
    if (this.shown) out.push({ ...CHEST_LIGHT, x: this.dungeon.chest.x * 16 + 8, y: this.dungeon.chest.y * 16 + 8 });
  }

  /** "Over here!": a bobbing arrow over the unopened chest, drawn above the darkness. */
  drawArrow(g: CanvasRenderingContext2D): void {
    if (!this.shown || this.opened() || this.age < DROP_SEC) return;
    const { chest } = this.dungeon;
    drawSprite(g, uiSprite("arrowDown", Math.floor(this.ctx.time * 3)), chest.x * 16 + 8, chest.y * 16 + 15 - ARROW_ABOVE_PX);
  }

  /** "Press E to open the chest"; `open` asks the UI for the chest overlay. */
  interactable(open: () => void): Interactable {
    const { chest } = this.dungeon;
    return {
      x: chest.x * 16 + 8,
      y: chest.y * 16 + 24,
      radius: 14,
      prompt: () => (this.opened() ? "The chest is empty — great job!" : "Open the dungeon's treasure chest"),
      activate: () => {
        if (this.shown && !this.opened()) open();
      },
    };
  }

  private center(): { x: number; y: number } {
    return { x: this.dungeon.chest.x * 16 + 8, y: this.dungeon.chest.y * 16 + 12 };
  }

  /** Height of the falling chest above its spot (0 once landed). */
  private height(): number {
    const k = Math.min(1, this.age / DROP_SEC);
    return Math.round(DROP_PX * (1 - k * k));
  }
}
