/**
 * SWALLOWS SHOTS — the Swallow Toad gulps down what is thrown at it, like a
 * bare `except:` swallowing errors nobody ever hears about.
 *
 *   a hero projectile flies into its open mouth ──► gulp! (the shot is gone)
 *   third gulp ──► cheeks bulge (BURP_DELAY_SEC) ──► BURP! the shots pop
 *   back out, harmless, and the toad sits dazed for BURP_STUN_SEC
 *
 * The counters, so projectile players are never stuck:
 *   - every third shot buys a long free window (it is dazed, mouth shut);
 *   - shots from above or below miss its mouth and land;
 *   - shots land while it is busy puffing up and spitting (`committed`);
 *   - melee always works, and a dazed (0 HP) toad swallows nothing.
 * Three little dots over its head fill up as it swallows, so the burp
 * never comes as a surprise.
 */
import type { ProjectileName } from "@/game/art/weapons";
import type { MonsterWorld, Pose } from "../brain";
import type { Monster } from "../monster";
import { headY } from "../monsterDraw";
import type { IncomingShot, Trait } from "./trait";

/** Gulps before it has to burp. */
export const SWALLOWS_BEFORE_BURP = 3;
/** Cheeks bulge this long before the burp. */
export const BURP_DELAY_SEC = 0.45;
/** It sits dazed (and can be hit by anything) this long after burping. */
export const BURP_STUN_SEC = 2.4;
/** A shot must come at its face at least this much sideways (share of its speed) to be swallowed. */
const MOUTH_MIN_SIDEWAYS = 0.35;
/** Its mouth is this far in front of its feet (px), and this high. */
const MOUTH_DX = 5;
const MOUTH_DY = 6;
/** Toad frames (art/monstersElites.ts): 2 = cheeks puffed, 3 = mouth wide open. */
const FULL_FRAME = 2;
const OPEN_FRAME = 3;
/** The open-mouth burp frame shows this long. */
const BURP_FRAME_SEC = 0.3;
const GULP_STRETCH = -0.35;
const GULP_BITS = ["#9be36b", "#d8ff9e"];
const BURP_BUBBLES = 8;
const BURP_SHAKE = 0.18;
/** The "how full" dots over its head: PIP_PX squares, PIP_GAP_PX apart. */
const PIP_PX = 2;
const PIP_GAP_PX = 5;
const PIP_ABOVE_HEAD_PX = 5;
/** "gulp" pops up beside its mouth, out of the way of the dots. */
const GULP_TEXT_DX = 10;
const GULP_TEXT_DY = 14;
const PIP_FULL = "#9be36b";
const PIP_EMPTY = "#6b5a7a";
const PIP_BORDER = "#2b1d34";

export class SwallowTrait implements Trait {
  private swallowed: ProjectileName[] = [];
  /** Seconds until the burp, or -1 when it is not full. */
  private burpIn = -1;
  private stunLeft = 0;

  /** How many shots are in its belly right now. */
  get belly(): number {
    return this.swallowed.length;
  }

  catchShot(m: Monster, world: MonsterWorld, shot: IncomingShot): boolean {
    if (this.burpIn >= 0 || this.stunLeft > 0 || m.brain.committed?.(m) || !intoMouth(m, shot)) return false;
    this.swallowed.push(shot.sprite);
    m.stretch = GULP_STRETCH;
    const side = m.facingLeft ? -1 : 1;
    world.fx.sfx("catch", { pitch: 0.45, volume: 0.8 });
    world.fx.bits(m.x + side * MOUTH_DX, m.y - MOUTH_DY, 3, GULP_BITS);
    world.fx.floatText(m.x + side * GULP_TEXT_DX, m.y - GULP_TEXT_DY, "gulp", "info");
    if (this.swallowed.length >= SWALLOWS_BEFORE_BURP) this.burpIn = BURP_DELAY_SEC;
    return true;
  }

  holdsBrain(): boolean {
    return this.burpIn >= 0 || this.stunLeft > 0;
  }

  update(m: Monster, world: MonsterWorld, dt: number): void {
    if (this.burpIn >= 0) {
      this.burpIn -= dt;
      m.shiver = true;
      if (this.burpIn <= 0) this.burp(m, world);
    } else if (this.stunLeft > 0) {
      this.stunLeft = Math.max(0, this.stunLeft - dt);
      m.dizzy = this.stunLeft > 0;
    }
  }

  pose(): Pose | null {
    if (this.burpIn >= 0) return { frame: FULL_FRAME };
    if (this.stunLeft > BURP_STUN_SEC - BURP_FRAME_SEC) return { frame: OPEN_FRAME };
    return null;
  }

  reset(m: Monster): void {
    this.swallowed = [];
    this.burpIn = -1;
    this.stunLeft = 0;
    m.shiver = m.dizzy = false;
  }

  drawOverlay(g: CanvasRenderingContext2D, m: Monster): void {
    if (this.swallowed.length === 0 || this.stunLeft > 0 || m.dazed) return;
    const top = Math.round(headY(m) - PIP_ABOVE_HEAD_PX);
    const left = Math.round(m.x - ((SWALLOWS_BEFORE_BURP - 1) * PIP_GAP_PX + PIP_PX) / 2);
    for (let i = 0; i < SWALLOWS_BEFORE_BURP; i++) {
      const x = left + i * PIP_GAP_PX;
      g.fillStyle = PIP_BORDER;
      g.fillRect(x - 1, top - 1, PIP_PX + 2, PIP_PX + 2);
      g.fillStyle = i < this.swallowed.length ? PIP_FULL : PIP_EMPTY;
      g.fillRect(x, top, PIP_PX, PIP_PX);
    }
  }

  /** Everything it swallowed comes back up, harmless, and it has to sit down for a moment. */
  private burp(m: Monster, world: MonsterWorld): void {
    const mouthX = m.x + (m.facingLeft ? -MOUTH_DX : MOUTH_DX);
    world.fx.floatText(m.x, m.y - m.def.size - MOUTH_DY, "BURP!", "crit");
    world.fx.bubbles(mouthX, m.y - MOUTH_DY, BURP_BUBBLES);
    world.fx.spitOut(mouthX, m.y - MOUTH_DY, this.swallowed[0], this.swallowed.length);
    world.fx.sfx("splash", { pitch: 0.45 });
    world.fx.sfx("error", { pitch: 0.6, volume: 0.45 });
    world.fx.shake(BURP_SHAKE);
    this.swallowed = [];
    this.burpIn = -1;
    this.stunLeft = BURP_STUN_SEC;
    m.shiver = false;
    m.dizzy = true;
    m.z = 0;
    // It forgets what it was doing (a hop, a wind-up): after the stars it starts over calmly.
    m.brain.reset(m);
  }
}

/** True when the shot flies sideways into the side the toad faces (its mouth), not from above, below or behind. */
export function intoMouth(m: Pick<Monster, "facingLeft">, shot: Pick<IncomingShot, "vx" | "vy">): boolean {
  const speed = Math.hypot(shot.vx, shot.vy);
  if (speed < 1e-6 || Math.abs(shot.vx) / speed < MOUTH_MIN_SIDEWAYS) return false;
  return m.facingLeft ? shot.vx > 0 : shot.vx < 0;
}
