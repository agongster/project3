/**
 * The GLITCH KING's moves (a file that does not even parse). See boss.ts.
 *
 *   teleport – it flickers, leaving red/cyan after-images, and pops up again
 *              3–4 tiles from the hero.
 *   rain     – it throws its arms up and glitch blocks start to fall: every
 *              landing spot blinks on the floor for a full second first, and
 *              the blocks drop one after another.
 */
import { drawSprite } from "@/game/art";
import type { MonsterWorld } from "./brain";
import type { BossMove } from "./boss";
import type { Monster } from "./monster";
import { currentSprite, tinted } from "./monsterDraw";
import { findSpotAround } from "./steering";

const TELEPORT_MIN_PX = 48;
const TELEPORT_MAX_PX = 64;
/** It must land at least this far from where it was (or the teleport looks like a twitch). */
const TELEPORT_MIN_JUMP_PX = 32;
/** After-images: one every this many seconds while flickering, each fading over GHOST_LIFE_SEC. */
const GHOST_EVERY_SEC = 0.1;
const GHOST_LIFE_SEC = 0.5;
const GHOST_SPLIT_PX = 2;
const GHOST_COLORS = ["#ff3b6b", "#3bf0ff"];
/** Blinks this many times per second while flickering, dimming to FLICKER_ALPHA. */
const FLICKER_HZ = 16;
const FLICKER_ALPHA = 0.45;
const GLITCH_BITS = ["#ff3b6b", "#3bf0ff", "#ffffff"];

const BLOCK_COUNT = 4;
const ENRAGED_BLOCK_COUNT = 6;
/** The first block always targets the hero; the others land within this radius of them. */
const BLOCK_SCATTER_PX = 48;
/** Every marker blinks this long before its block falls; blocks are staggered by BLOCK_STAGGER_SEC. */
const BLOCK_MARKER_SEC = 1;
const BLOCK_STAGGER_SEC = 0.22;

interface Ghost {
  x: number;
  y: number;
  /** `m.anim` when it was left behind. */
  born: number;
}

export class TeleportMove implements BossMove {
  readonly range = 40;
  readonly windup = 0.6;
  readonly act = 0.3;
  readonly rest = 0.5;
  private ghosts: Ghost[] = [];
  private flickering = false;
  private lastGhost = 0;

  begin(m: Monster, world: MonsterWorld): void {
    this.flickering = true;
    this.lastGhost = m.anim;
    world.fx.sfx("error", { pitch: 1.4, volume: 0.5 });
  }

  release(m: Monster, world: MonsterWorld): void {
    this.flickering = false;
    const hero = world.hero;
    const good = (x: number, y: number) => m.fitsAt(x, y) && Math.hypot(x - m.x, y - m.y) >= TELEPORT_MIN_JUMP_PX && world.canSee(x, y, hero.x, hero.y);
    const spot = findSpotAround(hero.x, hero.y, TELEPORT_MIN_PX, TELEPORT_MAX_PX, good, world.random);
    this.leaveGhost(m);
    world.fx.bits(m.x, m.y - 14, 6, GLITCH_BITS);
    if (spot) m.teleport(spot.x, spot.y);
    world.fx.bits(m.x, m.y - 14, 6, GLITCH_BITS);
    world.fx.sfx("error", { pitch: 0.9, volume: 0.5 });
  }

  /** While flickering it blinks and sheds an after-image every GHOST_EVERY_SEC; old ones fade away. */
  tick(m: Monster): void {
    if (this.flickering && m.anim - this.lastGhost >= GHOST_EVERY_SEC) {
      this.lastGhost = m.anim;
      this.leaveGhost(m);
    }
    m.alpha = this.flickering && Math.floor(m.anim * FLICKER_HZ) % 2 === 0 ? FLICKER_ALPHA : 1;
    this.ghosts = this.ghosts.filter((ghost) => m.anim - ghost.born < GHOST_LIFE_SEC);
  }

  reset(): void {
    this.ghosts = [];
    this.flickering = false;
  }

  drawBehind(g: CanvasRenderingContext2D, m: Monster): void {
    const sprite = currentSprite(m);
    for (const ghost of this.ghosts) {
      const alpha = 0.5 * (1 - (m.anim - ghost.born) / GHOST_LIFE_SEC);
      GHOST_COLORS.forEach((color, i) => {
        const dx = i === 0 ? -GHOST_SPLIT_PX : GHOST_SPLIT_PX;
        drawSprite(g, tinted(sprite, color), ghost.x + dx, ghost.y, { alpha, flipX: m.facingLeft });
      });
    }
  }

  private leaveGhost(m: Monster): void {
    this.ghosts.push({ x: m.x, y: m.y - m.z, born: m.anim });
  }
}

export class GlitchRainMove implements BossMove {
  readonly range = 56;
  readonly windup = 0.5;
  readonly act = 0.4;
  readonly rest = 1.6;

  begin(m: Monster, world: MonsterWorld): void {
    m.stretch = 0.3;
    m.alert = this.windup;
    world.fx.sfx("error", { pitch: 0.7 });
  }

  release(m: Monster, world: MonsterWorld, enraged: boolean): void {
    const hero = world.hero;
    const count = enraged ? ENRAGED_BLOCK_COUNT : BLOCK_COUNT;
    const onFloor = (x: number, y: number) => !world.blockedTile(Math.floor(x / 16), Math.floor(y / 16), false);
    for (let i = 0; i < count; i++) {
      const spot = i === 0 ? { x: hero.x, y: hero.y } : findSpotAround(hero.x, hero.y, 0, BLOCK_SCATTER_PX, onFloor, world.random);
      if (spot) world.hazards.drop(m, spot.x, spot.y, BLOCK_MARKER_SEC + i * BLOCK_STAGGER_SEC);
    }
    world.fx.bits(m.x, m.y - 24, 8, GLITCH_BITS);
  }
}
