/**
 * LEFTOVERS: little paper tags beaten monsters leave behind — the name
 * nobody used (`import os`, `leftovers = …`) from a Dust Bunny, the
 * variable that held the secret from a Key Thief.
 *
 *   pop (POP_SEC, drawn twice as big) ─► float up (RISE_SEC) ─► swept away
 *   sideways in a puff of dust, fading (SWEEP_SEC) ─► gone
 *
 * Pure decoration owned by the director: never saved, and cleared when the
 * hero faints or leaves, so nothing is ever left behind for real.
 */
import { drawText, FONT_CAP_HEIGHT, measureText } from "@/game/art/font";
import type { SceneContext } from "../../../scenes/context";
import { emitDust } from "../../playerFx";
import type { LeftoverTag, Trait } from "./trait";

const POP_SEC = 0.12;
const RISE_SEC = 1.5;
const SWEEP_SEC = 0.6;
const RISE_PX = 16;
/** How far the sweep carries it sideways (px). */
const SWEEP_PX = 70;
/** A dust puff trails the sweep every this many seconds. */
const SWEEP_DUST_SEC = 0.08;
/** The tag starts this far above the monster's feet. */
const START_LIFT_PX = 18;
const PAD_X = 3;
const PAD_Y = 2;
const INK = "#3a2a1c";
const EDGE = "#8a6f4e";
const SHADOW = "#1a1226";

interface Floating extends LeftoverTag {
  x: number;
  y: number;
  age: number;
  /** -1 or 1: which way the broom sweeps it. */
  sweepDir: number;
  lastDust: number;
}

export class Leftovers {
  private tags: Floating[] = [];

  constructor(private readonly ctx: SceneContext) {}

  /** A tag pops out of a beaten monster standing at (x, y). */
  add(tag: LeftoverTag, x: number, y: number): void {
    this.tags.push({ ...tag, x, y: y - START_LIFT_PX, age: 0, sweepDir: Math.random() < 0.5 ? -1 : 1, lastDust: 0 });
    this.ctx.audio.sfx("uiMove", { pitch: 0.8, volume: 0.6 });
  }

  update(dt: number): void {
    for (const t of this.tags) {
      const before = t.age;
      t.age += dt;
      if (before < RISE_SEC && t.age >= RISE_SEC) this.ctx.audio.sfx("dash", { pitch: 1.7, volume: 0.3 });
      if (t.age >= RISE_SEC && t.age - t.lastDust >= SWEEP_DUST_SEC) {
        t.lastDust = t.age;
        const p = position(t);
        emitDust(this.ctx, p.x, p.y + RISE_PX, 1);
      }
    }
    this.tags = this.tags.filter((t) => t.age < RISE_SEC + SWEEP_SEC);
  }

  /** World-space, above the darkness. */
  draw(g: CanvasRenderingContext2D): void {
    for (const t of this.tags) {
      const { x, y, alpha } = position(t);
      const scale = t.age < POP_SEC ? 2 : 1;
      const w = (measureText(t.text) + PAD_X * 2) * scale;
      const h = (FONT_CAP_HEIGHT + PAD_Y * 2 + 2) * scale;
      const left = Math.round(x - w / 2);
      const top = Math.round(y - h);
      g.save();
      g.globalAlpha = alpha;
      g.fillStyle = SHADOW;
      g.fillRect(left + 1, top + 1, w, h);
      g.fillStyle = EDGE;
      g.fillRect(left, top, w, h);
      g.fillStyle = t.paper;
      g.fillRect(left + 1, top + 1, w - 2, h - 2);
      // The string hole of a luggage tag.
      g.fillStyle = EDGE;
      g.fillRect(left + 2, top + Math.floor(h / 2), 1, 1);
      g.restore();
      drawText(g, t.text, left + (PAD_X + 1) * scale, top + PAD_Y * scale, { color: INK, outline: null, scale, alpha });
    }
  }

  clear(): void {
    this.tags = [];
  }
}

/** Where a tag is now and how see-through: rising with an ease-out, then swept sideways and fading. */
function position(t: Floating): { x: number; y: number; alpha: number } {
  const rise = Math.min(1, t.age / RISE_SEC);
  const y = t.y - (1 - (1 - rise) * (1 - rise)) * RISE_PX;
  if (t.age < RISE_SEC) return { x: t.x, y, alpha: 1 };
  const sweep = Math.min(1, (t.age - RISE_SEC) / SWEEP_SEC);
  return { x: t.x + t.sweepDir * sweep * sweep * SWEEP_PX, y, alpha: 1 - sweep };
}

/** The trait that leaves a tag behind: `text` on `paper`-coloured card when the finding is defeated. */
export class LeavesNameTrait implements Trait {
  constructor(private readonly tag: LeftoverTag) {}

  leftover(): LeftoverTag {
    return this.tag;
  }
}
