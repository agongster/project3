/**
 * Breakable props: bushes in the overworld, pots and crates in dungeons.
 *
 * They are Hittables of kind "object": one hit breaks them with a burst of
 * leaves / shards, a `break` sound, and often a little reward. Their tile is
 * solid until broken (see SceneContext.setBlocked).
 */
import { drawSprite, getAtlas, PALETTES, type Atlas } from "@/game/art";
import { uiSprite } from "@/game/art/ui";
import type { Prop, PropKind, ThemeId } from "@/lib/types";
import type { Hittable } from "../combat/hittable";
import type { SceneContext } from "../scenes/context";
import type { Drawable } from "../scenes/scene";

export const BREAKABLE_KINDS: ReadonlySet<PropKind> = new Set<PropKind>(["bush", "pot", "crate"]);

/** Chance that a broken prop drops coins, and how many. */
const COIN_DROP_CHANCE = 0.55;
const MIN_COINS = 1;
const MAX_COINS = 3;
/** Chance of a heart, only when the hero is hurt. */
const HEART_DROP_CHANCE = 0.08;
const HIT_RADIUS = 7;
const CHIP_COUNT = 10;

/** Colours of the bits that fly off (bush leaves follow the theme). */
function chipColors(kind: PropKind, theme: ThemeId): string[] {
  if (kind === "bush") return PALETTES[theme].leaves.slice(1, 4);
  if (kind === "pot") return ["#c9845a", "#a8643f", "#e8b07a"];
  return ["#9a6a4c", "#7a5038", "#c4936a"];
}

export class Breakable implements Hittable {
  readonly kind = "object";
  readonly radius = HIT_RADIUS;
  alive = true;
  readonly x: number;
  readonly y: number;

  constructor(
    readonly prop: Prop,
    private readonly ctx: SceneContext,
    /** Called once when it breaks (the overworld remembers broken bushes). */
    private readonly onBreak?: (b: Breakable) => void,
  ) {
    this.x = prop.x * 16 + 8;
    this.y = prop.y * 16 + 10;
  }

  /** Any hit breaks it, so the hit details are not needed. */
  takeHit(): void {
    if (!this.alive) return;
    this.alive = false;
    const ctx = this.ctx;
    ctx.setBlocked(this.prop.x, this.prop.y, false);
    ctx.hittables.delete(this);
    ctx.audio.sfx("break", { pitch: 0.9 + Math.random() * 0.2 });
    this.burst();
    this.dropLoot();
    this.onBreak?.(this);
  }

  drawable(atlas: Atlas): Drawable {
    const sprite = atlas.prop(this.prop.kind, this.prop.variant, 0);
    return { y: this.prop.y * 16 + 16, draw: (g) => drawSprite(g, sprite, this.x, this.prop.y * 16 + 16) };
  }

  private burst(): void {
    const ctx = this.ctx;
    const colors = chipColors(this.prop.kind, ctx.game.theme());
    for (let i = 0; i < CHIP_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 25 + Math.random() * 45;
      ctx.particles.emit({
        x: this.x,
        y: this.y + 2,
        z: 4 + Math.random() * 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.6,
        vz: 40 + Math.random() * 60,
        gravity: 260,
        life: 0.5 + Math.random() * 0.4,
        color: colors[i % colors.length],
        size: i % 3 === 0 ? 3 : 2,
        drag: 1.5,
      });
    }
    if (this.prop.kind === "bush") {
      for (let i = 0; i < 4; i++) {
        ctx.particles.emit({ x: this.x + (Math.random() - 0.5) * 10, y: this.y, z: 8, vx: (Math.random() - 0.5) * 30, vz: 20, gravity: 25, life: 1.2, sprite: uiSprite("leaf", i), wobble: 4, drag: 1 });
      }
    }
    ctx.particles.emit({ x: this.x, y: this.y, life: 0.3, sprite: uiSprite("poof", 0) });
  }

  private dropLoot(): void {
    const ctx = this.ctx;
    if (Math.random() < COIN_DROP_CHANCE) {
      ctx.spawnCoins(this.x, this.y, MIN_COINS + Math.floor(Math.random() * (MAX_COINS - MIN_COINS + 1)));
    }
    const player = ctx.game.player;
    if (player.hp < player.maxHp && Math.random() < HEART_DROP_CHANCE) ctx.spawnHeart(this.x, this.y);
  }
}

/**
 * Creates the breakables for every breakable prop, registers them as
 * hittables and blocks their tiles. `alreadyBroken` skips props broken
 * earlier this session.
 */
export function createBreakables(ctx: SceneContext, props: readonly Prop[], alreadyBroken: (p: Prop) => boolean, onBreak?: (b: Breakable) => void): Breakable[] {
  const list: Breakable[] = [];
  for (const prop of props) {
    if (!BREAKABLE_KINDS.has(prop.kind)) continue;
    if (alreadyBroken(prop)) {
      ctx.setBlocked(prop.x, prop.y, false);
      continue;
    }
    const b = new Breakable(prop, ctx, onBreak);
    ctx.hittables.add(b);
    ctx.setBlocked(prop.x, prop.y, prop.solid);
    list.push(b);
  }
  return list;
}

/** Live breakables' drawables (broken ones are skipped). */
export function breakableDrawables(list: readonly Breakable[], theme: ThemeId, out: Drawable[], visible: (x: number, y: number) => boolean): void {
  const atlas = getAtlas(theme);
  for (const b of list) if (b.alive && visible(b.x, b.y)) out.push(b.drawable(atlas));
}
