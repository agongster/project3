/**
 * WEARS A NAME — a Mimic standing for a shadowed builtin (`list = …`) or a
 * hidden import wears that name like an item label while it sits disguised
 * as a chest: it looks exactly like the real `list`. When it springs, the
 * label bursts apart — it never was the real thing. Pure decoration.
 */
import { drawText, FONT_CAP_HEIGHT, measureText } from "@/game/art/font";
import type { MonsterWorld } from "../brain";
import type { Monster } from "../monster";
import type { Trait } from "./trait";

/** The label's bottom edge sits this far above the monster's feet (just over the chest lid). */
const LABEL_ABOVE_FEET_PX = 14;
const BOB_PX = 1;
const BOB_RATE = 2.5;
const PAD_X = 2;
const PLATE = "#1a1226";
const PLATE_ALPHA = 0.7;
const TEXT_COLOR = "#ffe7a0";
/** When it springs, the label flies up this far while fading over BURST_SEC. */
const BURST_SEC = 0.35;
const BURST_RISE_PX = 14;
const BURST_BITS = ["#ffe7a0", "#ffd36b", "#ffffff"];

export class DisguiseNameTrait implements Trait {
  private wasHiding = true;
  /** Seconds since the disguise dropped (-1 while still hiding or long after). */
  private burstAge = -1;

  constructor(private readonly name: string) {}

  update(m: Monster, world: MonsterWorld, dt: number): void {
    const hiding = m.brain.disguised?.(m) ?? false;
    if (this.wasHiding && !hiding) {
      this.burstAge = 0;
      world.fx.bits(m.x, m.y - LABEL_ABOVE_FEET_PX - FONT_CAP_HEIGHT, 6, BURST_BITS);
    } else if (this.burstAge >= 0) {
      this.burstAge += dt;
      if (this.burstAge >= BURST_SEC) this.burstAge = -1;
    }
    this.wasHiding = hiding;
  }

  /** While disguised it shows only the name it wears. */
  hidesNameTag(): boolean {
    return this.wasHiding;
  }

  reset(): void {
    this.wasHiding = true;
    this.burstAge = -1;
  }

  drawOverlay(g: CanvasRenderingContext2D, m: Monster, time: number): void {
    if (!m.alive || m.dazed) return;
    const burst = this.burstAge >= 0 ? this.burstAge / BURST_SEC : null;
    if (!this.wasHiding && burst === null) return;
    const lift = burst === null ? Math.round(Math.sin(time * BOB_RATE) * BOB_PX) : -Math.round(burst * BURST_RISE_PX);
    const alpha = burst === null ? 1 : 1 - burst;
    const w = measureText(this.name) + PAD_X * 2;
    const bottom = Math.round(m.y - m.z - LABEL_ABOVE_FEET_PX * m.scale + lift);
    const top = bottom - FONT_CAP_HEIGHT - 3;
    g.save();
    g.globalAlpha = PLATE_ALPHA * alpha;
    g.fillStyle = PLATE;
    g.fillRect(Math.round(m.x - w / 2), top - 1, w, FONT_CAP_HEIGHT + 4);
    g.restore();
    drawText(g, this.name, m.x, top + 1, { color: TEXT_COLOR, align: "center", alpha });
  }
}
