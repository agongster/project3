/**
 * GROWS WHEN HIT — a mutable default argument keeps its state from one
 * call to the next, so this monster keeps everything each hit gave it.
 *
 * Every hit (up to MAX_GROWTH_HITS) makes it visibly bigger and shows over
 * its head what its default holds now, like printing the list after each call:
 *
 *   basket=[1]  →  basket=[1, 1]  →  basket=[1, 1, 1]  →  basket=[1, 1, 1, …]
 *
 * Bigger is never harder: it gets SLOWER and its hit radius grows (easier
 * to hit), while its HP and its contact reach stay the same (engagement.ts
 * uses the body radius). The size stays when the hero faints — the state
 * leaks, that is the bug — and a dazed monster takes no more hits that
 * count, so it stops growing.
 */
import { drawText } from "@/game/art/font";
import { grownDefault } from "@/lib/analysis/traitNames";
import type { MonsterWorld } from "../brain";
import type { Monster } from "../monster";
import { headY } from "../monsterDraw";
import type { Trait } from "./trait";

/** Growth stops after this many hits. */
export const MAX_GROWTH_HITS = 6;
/** Size added per hit (6 hits → 1.72× as big). */
export const GROWTH_PER_HIT = 0.12;
/** Speed lost per hit (6 hits → 52% of its speed). */
export const SLOWDOWN_PER_HIT = 0.08;
/** The size eases toward its new value at this rate (per second). */
const GROW_RATE = 10;
/** The pop of squash & stretch on each growth spurt. */
const GROW_STRETCH = 0.35;
const GROW_BITS = ["#ffd36b", "#ffffff"];
/** The "basket=[1, 1]" label shows this long after each growth spurt (the newest replaces the last). */
const LABEL_SEC = 1.3;
const LABEL_FADE_SEC = 0.3;
const LABEL_POP_PX = 3;
const LABEL_POP_SEC = 0.1;
const LABEL_ABOVE_HEAD_PX = 12;
const LABEL_COLOR = "#ffe7a0";

export class GrowthTrait implements Trait {
  private calls = 0;
  private labelFor = 0;

  /** `name` and `opener` describe the default ("basket", "[") for the pop-up text. */
  constructor(
    private readonly name: string,
    private readonly opener: "[" | "{",
  ) {}

  onHit(m: Monster, world: MonsterWorld): void {
    if (this.calls >= MAX_GROWTH_HITS) return;
    this.calls++;
    m.speedScale = 1 - SLOWDOWN_PER_HIT * this.calls;
    m.stretch = GROW_STRETCH;
    this.labelFor = LABEL_SEC;
    world.fx.bits(m.x, m.y - m.def.size * targetScale(this.calls) + 4, 4, GROW_BITS);
    world.fx.sfx("catch", { pitch: 1.1 - this.calls * 0.08, volume: 0.6 });
  }

  update(m: Monster, _world: MonsterWorld, dt: number): void {
    const target = targetScale(this.calls);
    m.scale += (target - m.scale) * Math.min(1, dt * GROW_RATE);
    this.labelFor = Math.max(0, this.labelFor - dt);
  }

  /** The label stands in for the name tag while it shows. */
  hidesNameTag(): boolean {
    return this.labelFor > 0;
  }

  reset(): void {
    this.labelFor = 0;
  }

  drawOverlay(g: CanvasRenderingContext2D, m: Monster): void {
    if (this.labelFor <= 0 || m.dazed) return;
    const age = LABEL_SEC - this.labelFor;
    const pop = Math.round(LABEL_POP_PX * Math.max(0, 1 - age / LABEL_POP_SEC));
    const alpha = Math.min(1, this.labelFor / LABEL_FADE_SEC);
    const text = grownDefault(this.name, this.opener, this.calls);
    drawText(g, text, m.x, headY(m) - LABEL_ABOVE_HEAD_PX - pop, { color: LABEL_COLOR, align: "center", alpha });
  }
}

/** How big it is after `calls` growth hits. */
export function targetScale(calls: number): number {
  return 1 + GROWTH_PER_HIT * Math.min(calls, MAX_GROWTH_HITS);
}
