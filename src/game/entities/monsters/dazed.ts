/**
 * The DAZED moment: the engine side of the pick-the-fix finisher (its rules
 * live in src/lib/game/finisher.ts, the question itself in the Finisher
 * overlay).
 *
 *   killing blow on an elite / boss ─► dazed at 0 HP (Monster.daze, DAZE_SEC)
 *     ├─ hero stands close and presses E ─► `finisher` event: the game pauses,
 *     │    the overlay asks, the UI answers with game.resolveFinisher(id, correct)
 *     │    ─► collapse(correct): a right fix is a critical fix (juicier death, double pay)
 *     ├─ hero keeps hitting (after a short grace) ─► ordinary death
 *     └─ nobody does anything for DAZE_SEC ─► ordinary death
 *
 * Every branch ends in `Monster.collapse`, so a dazed monster always dies,
 * and dies exactly once.
 */
import type { SceneContext } from "../../scenes/context";
import type { Interactable } from "../../scenes/interactions";
import { DAZE_SEC, type Monster } from "./monster";

/** The hero may finish a dazed monster from this far beyond its body (px). */
const FINISH_REACH_PX = 24;
/** The gold countdown ring: one dot every this many px of its circumference. */
const RING_DOT_GAP_PX = 3;
const RING_COLOR = "#ffd36b";
const RING_ALPHA = 0.85;
/** The ring blinks this many times per second in its last second. */
const RING_HURRY_BLINKS = 8;

/** How close the hero's feet must be (px) to finish this monster. */
function finishReach(m: Monster): number {
  return m.radius + FINISH_REACH_PX;
}

/** "Press E to finish it with a fix": one of the dungeon's interactables while the monster is dazed. */
export function finisherSpot(ctx: SceneContext, m: Monster): Interactable {
  return {
    x: m.x,
    y: m.y,
    radius: finishReach(m),
    prompt: () => `Finish the ${m.def.name} with a fix!`,
    activate: () => {
      if (!m.dazed || m.finisherOpened) return;
      m.finisherOpened = true;
      ctx.game.emitPausing({ type: "finisher", finding: m.finding });
    },
  };
}

/** The player's answer from the overlay: the dazed monster goes down, critically if the pick was right. */
export function answerFinisher(monsters: readonly Monster[], findingId: string, correct: boolean): void {
  const m = monsters.find((candidate) => candidate.dazed && candidate.finisherOpened && candidate.finding.id === findingId);
  m?.collapse(correct);
}

/**
 * Safety net, run every step: a monster whose finisher was opened but is
 * still standing when the game runs again was never answered, which counts
 * as declining (an ordinary defeat). So no UI path can leave it hanging.
 */
export function declineUnanswered(monsters: readonly Monster[]): void {
  for (const m of monsters) if (m.dazed && m.finisherOpened) m.collapse();
}

/**
 * A ring of gold dots on the floor around a dazed monster: it shows where to
 * stand, and drains like a clock as the moment runs out (blinking at the end).
 */
export function drawFinisherRing(g: CanvasRenderingContext2D, m: Monster, time: number): void {
  const left = Math.max(0, 1 - m.dazedFor / DAZE_SEC);
  const hurry = left * DAZE_SEC < 1;
  if (hurry && Math.floor(time * RING_HURRY_BLINKS) % 2 === 1) return;
  const r = finishReach(m);
  const dots = Math.ceil((Math.PI * 2 * r) / RING_DOT_GAP_PX);
  g.save();
  g.globalAlpha = RING_ALPHA;
  g.fillStyle = RING_COLOR;
  // Clockwise from 12 o'clock; the dots still lit are the time that is left.
  for (let i = 0; i < Math.ceil(dots * left); i++) {
    const a = -Math.PI / 2 + (i / dots) * Math.PI * 2;
    g.fillRect(Math.round(m.x + Math.cos(a) * r), Math.round(m.y + Math.sin(a) * r), 1, 1);
  }
  g.restore();
}
