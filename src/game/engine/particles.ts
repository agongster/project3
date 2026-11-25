/**
 * A lightweight particle system: dust puffs, leaf bursts, hit sparks,
 * sparkles, miasma, trails...
 *
 * Particles are plain objects kept in a fixed-size POOL. A dead particle's
 * slot is reused by the next `emit`, so a big burst never makes the garbage
 * collector stutter. When the pool is full, new particles are simply
 * dropped (nobody notices the 601st sparkle).
 *
 * A particle is either a small coloured square or a sprite. It has a ground
 * position (x, y) plus a height `z` above the ground, so things can "pop
 * up" and fall back with gravity while staying at the right place on the map.
 */
import { drawSprite, type Sprite } from "@/game/art";

const POOL_SIZE = 600;

export interface ParticleSpec {
  x: number;
  y: number;
  /** Height above the ground (drawn higher on screen). */
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  /** Seconds to live. */
  life: number;
  /** Colour of a square particle (ignored when `sprite` is set). */
  color?: string;
  /** Side of the square in pixels. */
  size?: number;
  sprite?: Sprite;
  /** Pull toward the ground on z (px/s²). */
  gravity?: number;
  /** Fraction of velocity lost per second (0 = none, 3 = very floaty). */
  drag?: number;
  /** Fade out over the last part of its life (default true). */
  fade?: boolean;
  /** Shrink the square to nothing over its life. */
  shrink?: boolean;
  /** Seconds before it appears (staggers bursts). */
  delay?: number;
  /** Sideways sway amplitude in px (petals, snow). */
  wobble?: number;
}

interface Particle extends Required<Omit<ParticleSpec, "sprite" | "color">> {
  sprite: Sprite | null;
  color: string;
  age: number;
  alive: boolean;
  seed: number;
}

function blank(): Particle {
  return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, color: "#fff", size: 1, sprite: null, gravity: 0, drag: 0, fade: true, shrink: false, delay: 0, wobble: 0, age: 0, alive: false, seed: 0 };
}

export class Particles {
  private pool: Particle[] = Array.from({ length: POOL_SIZE }, blank);
  private cursor = 0;

  emit(spec: ParticleSpec): void {
    const p = this.freeSlot();
    if (!p) return;
    p.x = spec.x;
    p.y = spec.y;
    p.z = spec.z ?? 0;
    p.vx = spec.vx ?? 0;
    p.vy = spec.vy ?? 0;
    p.vz = spec.vz ?? 0;
    p.life = spec.life;
    p.color = spec.color ?? "#ffffff";
    p.size = spec.size ?? 1;
    p.sprite = spec.sprite ?? null;
    p.gravity = spec.gravity ?? 0;
    p.drag = spec.drag ?? 0;
    p.fade = spec.fade ?? true;
    p.shrink = spec.shrink ?? false;
    p.delay = spec.delay ?? 0;
    p.wobble = spec.wobble ?? 0;
    p.age = 0;
    p.seed = Math.random() * 10;
    p.alive = true;
  }

  /** Emits `count` particles in a ring of random directions at `speed` (± 40%). */
  burst(count: number, x: number, y: number, speed: number, base: Omit<ParticleSpec, "x" | "y">): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const s = speed * (0.6 + Math.random() * 0.8);
      this.emit({ ...base, x, y, vx: Math.cos(angle) * s, vy: Math.sin(angle) * s * 0.7 });
    }
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.alive) continue;
      if (p.delay > 0) {
        p.delay -= dt;
        continue;
      }
      p.age += dt;
      if (p.age >= p.life) {
        p.alive = false;
        continue;
      }
      const keep = Math.max(0, 1 - p.drag * dt);
      p.vx *= keep;
      p.vy *= keep;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.gravity !== 0 || p.vz !== 0) {
        p.vz -= p.gravity * dt;
        p.z = Math.max(0, p.z + p.vz * dt);
      }
    }
  }

  draw(g: CanvasRenderingContext2D): void {
    for (const p of this.pool) {
      if (!p.alive || p.delay > 0) continue;
      const t = p.age / p.life;
      const alpha = p.fade ? Math.min(1, (1 - t) * 2.5) : 1;
      const sway = p.wobble ? Math.sin(p.age * 3 + p.seed) * p.wobble : 0;
      const sx = p.x + sway;
      const sy = p.y - p.z;
      if (p.sprite) {
        drawSprite(g, p.sprite, sx, sy, alpha < 1 ? { alpha } : undefined);
        continue;
      }
      const size = p.shrink ? Math.max(1, Math.round(p.size * (1 - t))) : p.size;
      g.globalAlpha = alpha;
      g.fillStyle = p.color;
      g.fillRect(Math.round(sx - size / 2), Math.round(sy - size / 2), size, size);
    }
    g.globalAlpha = 1;
  }

  clear(): void {
    for (const p of this.pool) p.alive = false;
  }

  private freeSlot(): Particle | null {
    for (let i = 0; i < POOL_SIZE; i++) {
      const p = this.pool[(this.cursor + i) % POOL_SIZE];
      if (!p.alive) {
        this.cursor = (this.cursor + i + 1) % POOL_SIZE;
        return p;
      }
    }
    return null;
  }
}
