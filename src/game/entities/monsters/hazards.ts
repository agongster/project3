/**
 * Attacks that LAND on a spot after a clear warning, instead of flying
 * straight at the hero:
 *
 *   glob  – the Swallow Toad's spit arcs through the air and splats where
 *           the hero WAS standing when it was spat.
 *   block – the Glitch King's glitch blocks wait on a blinking floor marker,
 *           then fall out of the sky.
 *
 * The landing spot is marked on the floor the whole time, and only a hero
 * still standing inside the marker when it lands gets hurt — so stepping
 * aside always works.
 */
import { drawSprite } from "@/game/art";
import { projectileSprite } from "@/game/art/weapons";
import type { Drawable } from "../../scenes/scene";
import type { MonsterWorld } from "./brain";
import type { Monster } from "./monster";
import { drawWarningRing } from "./telegraphs";

export type HazardKind = "glob" | "block";

export interface Hazard {
  kind: HazardKind;
  owner: Monster;
  /** Where it was launched from (globs) — blocks fall straight down. */
  fromX: number;
  fromY: number;
  /** The landing spot (marked on the floor). */
  x: number;
  y: number;
  /** Seconds of marker only, before it starts falling (blocks). */
  delay: number;
  /** Seconds in the air. */
  flight: number;
  age: number;
  /** Hurts a hero whose feet are this close to the landing spot (px). */
  radius: number;
  /** Half-hearts. */
  damage: number;
}

/** Peak height of a glob's arc (px). */
const GLOB_ARC_PX = 22;
const GLOB_RADIUS = 9;
/** Blocks start this high above their marker. */
const BLOCK_FALL_HEIGHT_PX = 90;
const BLOCK_FALL_SEC = 0.4;
const BLOCK_RADIUS = 10;
/** The hero's feet count as a small circle this big. */
const HERO_FEET_RADIUS = 4;
const GLOB_COLORS = ["#9be36b", "#6fc25a", "#d8ff9e"];
const GLITCH_COLORS = ["#ff3b6b", "#3bf0ff", "#ffffff", "#b06bff"];

export class Hazards {
  readonly list: Hazard[] = [];

  /** Lobs a spit glob from (fromX, fromY) to (toX, toY), `flight` seconds in the air. */
  lob(owner: Monster, fromX: number, fromY: number, toX: number, toY: number, flight: number, damage = 1): void {
    this.list.push({ kind: "glob", owner, fromX, fromY, x: toX, y: toY, delay: 0, flight, age: 0, radius: GLOB_RADIUS, damage });
  }

  /** Marks (x, y) for `delay` seconds, then drops a glitch block on it. */
  drop(owner: Monster, x: number, y: number, delay: number, damage = 1): void {
    this.list.push({ kind: "block", owner, fromX: x, fromY: y, x, y, delay, flight: BLOCK_FALL_SEC, age: 0, radius: BLOCK_RADIUS, damage });
  }

  update(dt: number, world: MonsterWorld): void {
    for (const h of this.list) h.age += dt;
    const landed = this.list.filter((h) => h.age >= h.delay + h.flight);
    for (const h of landed) this.land(h, world);
    this.removeWhere((h) => landed.includes(h));
  }

  /** Forgets everything in flight (the hero fainted). */
  clear(): void {
    this.list.length = 0;
  }

  /** Drops the hazards of a monster that was just defeated. */
  removeOwnedBy(owner: Monster): void {
    this.removeWhere((h) => h.owner === owner);
  }

  private removeWhere(test: (h: Hazard) => boolean): void {
    const keep = this.list.filter((h) => !test(h));
    this.list.length = 0;
    this.list.push(...keep);
  }

  private land(h: Hazard, world: MonsterWorld): void {
    const hero = world.hero;
    if (Math.hypot(hero.x - h.x, hero.y - h.y) <= h.radius + HERO_FEET_RADIUS) world.hurtHero(h.damage, h.x, h.y, h.owner);
    if (h.kind === "glob") {
      world.fx.bits(h.x, h.y, 6, GLOB_COLORS);
      world.fx.sfx("splash", { volume: 0.5, pitch: 1.3 });
    } else {
      world.fx.poof(h.x, h.y);
      world.fx.bits(h.x, h.y, 8, GLITCH_COLORS);
      world.fx.sfx("slam", { volume: 0.5, pitch: 1.4 });
      world.fx.shake(0.12);
    }
  }
}

/** 0 → 1 through the whole warning (marker time + flight). */
function urgency(h: Hazard): number {
  return Math.min(1, h.age / (h.delay + h.flight));
}

/** Where a hazard is drawn right now: ground point plus height above it. */
function airPosition(h: Hazard): { x: number; y: number; z: number } {
  const k = Math.max(0, Math.min(1, (h.age - h.delay) / h.flight));
  if (h.kind === "glob") {
    return { x: h.fromX + (h.x - h.fromX) * k, y: h.fromY + (h.y - h.fromY) * k, z: Math.sin(Math.PI * k) * GLOB_ARC_PX };
  }
  return { x: h.x, y: h.y, z: (1 - k * k) * BLOCK_FALL_HEIGHT_PX };
}

/** The floor markers (in the shadow pass, under every body) and the flying globs / falling blocks. */
export function hazardDrawables(hazards: Hazards, time: number, out: Drawable[]): void {
  for (const h of hazards.list) {
    const falling = h.age >= h.delay;
    const pos = airPosition(h);
    const sprite = projectileSprite(h.kind === "glob" ? "spit" : "glitchBlock", Math.floor(time * 8));
    out.push({
      y: pos.y,
      shadow: (g) => drawWarningRing(g, h.x, h.y, h.radius, urgency(h), time),
      draw: (g) => {
        if (falling) drawSprite(g, sprite, pos.x, pos.y - pos.z);
      },
    });
  }
}
