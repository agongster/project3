/**
 * SQUEAKS ITS NOTE — the Todo Mite runs away squeaking its own comment:
 * "TODO: ask Granny Marzipan…" (or, for commented-out code, the old code).
 * A speech bubble pops up when it notices the hero and again every
 * SQUEAK_EVERY_SEC while it is being chased. Pure decoration.
 */
import { drawText, FONT_CAP_HEIGHT, measureText } from "@/game/art/font";
import type { MonsterWorld } from "../brain";
import type { Monster } from "../monster";
import { headY } from "../monsterDraw";
import type { Trait } from "./trait";

const SQUEAK_SEC = 2.2;
const SQUEAK_EVERY_SEC = 4.5;
/** The bubble pops up over this long and fades over the last FADE_SEC. */
const POP_SEC = 0.1;
const FADE_SEC = 0.25;
const ABOVE_HEAD_PX = 5;
const PAD_X = 3;
const PAD_Y = 2;
const TAIL_PX = 3;
const BUBBLE_FILL = "#fff8e7";
const BUBBLE_EDGE = "#2b1d34";
const TEXT_COLOR = "#2b1d34";

export class SqueakTrait implements Trait {
  private showFor = 0;
  private untilNext = SQUEAK_EVERY_SEC;

  constructor(private readonly note: string) {}

  onNotice(_m: Monster, world: MonsterWorld): void {
    this.squeak(world);
  }

  update(m: Monster, world: MonsterWorld, dt: number): void {
    this.showFor = Math.max(0, this.showFor - dt);
    if (!m.engaged) return;
    this.untilNext -= dt;
    if (this.untilNext <= 0) this.squeak(world);
  }

  hidesNameTag(): boolean {
    return this.showFor > 0;
  }

  reset(): void {
    this.showFor = 0;
    this.untilNext = SQUEAK_EVERY_SEC;
  }

  drawOverlay(g: CanvasRenderingContext2D, m: Monster): void {
    if (this.showFor <= 0 || !m.alive || this.note === "") return;
    const age = SQUEAK_SEC - this.showFor;
    const alpha = Math.min(1, this.showFor / FADE_SEC);
    const rise = Math.round((1 - Math.min(1, age / POP_SEC)) * 3);
    const w = measureText(this.note) + PAD_X * 2;
    const h = FONT_CAP_HEIGHT + PAD_Y * 2 + 2;
    const bottom = Math.round(headY(m) - ABOVE_HEAD_PX + rise);
    const left = Math.round(m.x - w / 2);
    const top = bottom - h;
    g.save();
    g.globalAlpha = alpha;
    g.fillStyle = BUBBLE_EDGE;
    g.fillRect(left - 1, top - 1, w + 2, h + 2);
    for (let i = 0; i < TAIL_PX; i++) g.fillRect(Math.round(m.x) - TAIL_PX + i, bottom + i, (TAIL_PX - i) * 2, 1);
    g.fillStyle = BUBBLE_FILL;
    g.fillRect(left, top, w, h);
    for (let i = 0; i < TAIL_PX - 1; i++) g.fillRect(Math.round(m.x) - TAIL_PX + 1 + i, bottom + i, (TAIL_PX - 1 - i) * 2, 1);
    g.restore();
    drawText(g, this.note, left + PAD_X, top + PAD_Y, { color: TEXT_COLOR, outline: null, alpha });
  }

  private squeak(world: MonsterWorld): void {
    this.showFor = SQUEAK_SEC;
    this.untilNext = SQUEAK_EVERY_SEC;
    world.fx.sfx("talk", { pitch: 2, volume: 0.35 });
  }
}
