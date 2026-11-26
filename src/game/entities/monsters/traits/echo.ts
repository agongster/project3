/**
 * ECHO TWIN — the Echo Bat of code that says the same thing twice comes
 * with an ECHO: a second body for the same finding (not a second finding).
 *
 *   the voice (the real bat)  +  the echo (see-through, trailing after-images)
 *   one falls ──► a countdown ring appears around the other (ECHO_WINDOW_SEC)
 *   the other falls in time ──► "ECHO BROKEN!" and the finding pays double coins
 *   the other falls later    ──► the usual reward, nothing lost
 *
 * The finding's HP is split between the two bodies (createBodies, index.ts)
 * and the echo never hurts on contact, so the pair is never harder than one
 * bat. Only the LAST body's death defeats the finding (oneDefeat.ts).
 */
import { drawSprite } from "@/game/art";
import type { MonsterWorld } from "../brain";
import type { Monster } from "../monster";
import { currentSprite, tinted } from "../monsterDraw";
import type { Trait } from "./trait";

/** Beat the second body within this long after the first for the bonus. */
export const ECHO_WINDOW_SEC = 3;
/** The bonus: the finding's coins are multiplied by this. */
export const ECHO_BONUS_MULT = 2;
/** Circles on the floor are seen at an angle: their height is this share of their width. */
const FLOOR_SQUASH = 0.6;
/** The echo is drawn this see-through. */
const ECHO_ALPHA = 0.6;
/** It leaves an after-image every this many seconds; each fades over AFTERIMAGE_SEC. */
const AFTERIMAGE_EVERY_SEC = 0.07;
const AFTERIMAGE_SEC = 0.28;
const AFTERIMAGE_ALPHA = 0.35;
const ECHO_TINT = "#b58cff";
/** Both bodies send out a soft "sound ring" every RIPPLE_EVERY_SEC, growing to RIPPLE_MAX_PX. */
const RIPPLE_EVERY_SEC = 1.6;
const RIPPLE_SEC = 0.6;
const RIPPLE_MAX_PX = 14;
const RIPPLE_COLOR = "#cdb4ff";
const RIPPLE_ALPHA = 0.5;
const RIPPLE_START_PX = 4;
/** The countdown ring around the survivor: one dot every RING_GAP_PX. */
const RING_GAP_PX = 3;
const RING_COLOR = "#cdb4ff";
const RING_EXTRA_PX = 6;
const RING_ALPHA = 0.9;
const BROKEN_COLORS = ["#cdb4ff", "#ffffff", "#ffe066"];

/** What the two bodies of one finding share. */
export class EchoPair {
  /** `world.time` when the first body fell, or null while both stand. */
  firstDownAt: number | null = null;
}

interface AfterImage {
  x: number;
  y: number;
  born: number;
}

export class EchoTrait implements Trait {
  private afterImages: AfterImage[] = [];
  private lastImageAt = 0;

  constructor(
    private readonly pair: EchoPair,
    /** "voice" = the real bat; "echo" = its see-through copy. */
    readonly role: "voice" | "echo",
  ) {}

  update(m: Monster): void {
    if (this.role !== "echo") return;
    m.alpha = ECHO_ALPHA;
    if (m.anim - this.lastImageAt >= AFTERIMAGE_EVERY_SEC) {
      this.lastImageAt = m.anim;
      this.afterImages.push({ x: m.x, y: m.y - m.z, born: m.anim });
    }
    this.afterImages = this.afterImages.filter((a) => m.anim - a.born < AFTERIMAGE_SEC);
  }

  reset(): void {
    this.afterImages = [];
    this.pair.firstDownAt = null;
  }

  onDefeat(m: Monster, world: MonsterWorld, lastBody: boolean): number {
    const midY = m.y - m.def.size / 2;
    if (!lastBody) {
      this.pair.firstDownAt = world.time;
      world.fx.floatText(m.x, midY - 12, "1/2", "info");
      return 1;
    }
    const first = this.pair.firstDownAt;
    if (first === null || world.time - first > ECHO_WINDOW_SEC) return 1;
    world.fx.floatText(m.x, midY - 14, "ECHO BROKEN!", "crit");
    world.fx.bits(m.x, midY, 14, BROKEN_COLORS);
    world.fx.ring(m.x, midY);
    world.fx.sfx("revealEpic", { pitch: 1.4, volume: 0.6 });
    return ECHO_BONUS_MULT;
  }

  drawBehind(g: CanvasRenderingContext2D, m: Monster): void {
    if (this.role !== "echo") return;
    const sprite = tinted(currentSprite(m), ECHO_TINT);
    for (const a of this.afterImages) {
      drawSprite(g, sprite, a.x, a.y, { alpha: AFTERIMAGE_ALPHA * (1 - (m.anim - a.born) / AFTERIMAGE_SEC), flipX: m.facingLeft });
    }
  }

  drawFloor(g: CanvasRenderingContext2D, m: Monster, time: number): void {
    g.save();
    g.fillStyle = RIPPLE_COLOR;
    const k = (m.anim % RIPPLE_EVERY_SEC) / RIPPLE_SEC;
    if (k < 1) {
      g.globalAlpha = RIPPLE_ALPHA * (1 - k);
      ellipseDots(g, m.x, m.y - 2, RIPPLE_START_PX + k * (RIPPLE_MAX_PX - RIPPLE_START_PX), 1);
    }
    const first = this.pair.firstDownAt;
    const left = first === null ? 0 : 1 - (time - first) / ECHO_WINDOW_SEC;
    if (left > 0) {
      g.globalAlpha = RING_ALPHA;
      g.fillStyle = RING_COLOR;
      ellipseDots(g, m.x, m.y - 2, m.radius + RING_EXTRA_PX, left);
    }
    g.restore();
  }
}

/** Dots around a flattened circle, clockwise from 12 o'clock; `share` (0–1) of them are drawn. */
function ellipseDots(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, share: number): void {
  const dots = Math.ceil((Math.PI * 2 * r) / RING_GAP_PX);
  for (let i = 0; i < Math.ceil(dots * share); i++) {
    const a = -Math.PI / 2 + (i / dots) * Math.PI * 2;
    g.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * FLOOR_SQUASH), 1, 1);
  }
}
