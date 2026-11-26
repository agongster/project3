/**
 * Speech bubbles: when the hero walks near villagers, one of them now and
 * then pops a short bubble with one of their sayings (a real comment from
 * their region's code), without the player pressing anything.
 *
 * Rules that keep it charming instead of noisy:
 *   - only one villager speaks at a time, and there is a pause between bubbles
 *   - the same villager waits REPEAT_SEC before speaking again
 *   - talking to anyone (E) hushes the bubble, so none shows during a dialog
 *   - at most MAX_LINES short lines, clipped with "…"
 *   - a bubble sits over the speaker's head, or under their feet when the top
 *     of the screen has no room; it never covers the HUD (hearts, minimap,
 *     the "Press E" prompt) or the hero, and when neither spot works the
 *     villager simply waits
 */
import { drawText, FONT_LINE_HEIGHT, measureText } from "@/game/art/font";
import { VIEW_H, VIEW_W, type AudioApi } from "../bridge";
import type { Villager } from "../entities/npc";
import { wrapBubbleText } from "./bubbleText";

/** Villagers at most this far sideways… */
const HEAR_X_PX = 88;
/** …and this far up or down from the hero may speak. */
const HEAR_Y_PX = 64;
/** A speaker who wanders off this much beyond hearing range stops mid-sentence. */
const OUT_OF_RANGE_FACTOR = 1.5;
/** After the hero arrives near someone, the first bubble waits this long. */
const FIRST_DELAY_SEC = 1.2;
/** How long a bubble stays up, including its fade in and out. */
const SHOW_SEC = 3.8;
const FADE_SEC = 0.25;
/** Quiet time between two bubbles, plus a random part so it does not feel mechanical. */
const GAP_SEC = 3.5;
const GAP_JITTER_SEC = 3;
/** The same villager waits at least this long before speaking again. */
const REPEAT_SEC = 14;
/** Text area of a bubble: at most this wide (art px) and this many lines. */
const MAX_TEXT_W = 148;
const MAX_LINES = 2;
const PAD_X = 4;
const PAD_Y = 3;
/** Rows of the little tail, and the gap between its tip and the speaker's head or feet. */
const TAIL_H = 3;
const TIP_GAP_PX = 1;
/** The bubble drifts this many px toward its speaker while it fades in. */
const DRIFT_PX = 3;
/** Rows of glyph cell below the capitals' top (7 cap height + 2 descender rows). */
const TEXT_CELL_H = 9;
/**
 * Where the HUD sits on the 400 × 225 screen, which a bubble must never
 * cover: a strip along the top (location name), the two top corners
 * (hearts panel, minimap) and a band along the bottom (weapon panel,
 * buttons and the "Press E" prompt).
 */
const HUD = { top: 20, cornerW: 78, cornerBottom: 60, bottom: 48, side: 4 };
/** The hero's sprite around their feet, which a bubble must not hide. */
const HERO_BOX = { halfW: 9, h: 26 };
/** The pop sound is a soft version of the dialog's "talk" blip. */
const POP_VOLUME = 0.35;
const COLORS = { fill: "#fff6e0", border: "#2b1b3d", text: "#2b1b3d", shadow: "rgba(0, 0, 0, 0.25)" };

/** The camera's top-left corner in world px. */
type View = { left: number; top: number };
type Point = { x: number; y: number };

/** Where a bubble is drawn (world px). */
interface Box {
  left: number;
  top: number;
  w: number;
  h: number;
  /** The tail points at the speaker's x… */
  tipX: number;
  /** …down at their head, or up at their feet when the bubble hangs below them. */
  below: boolean;
}

interface Speech {
  villager: Villager;
  lines: string[];
  box: Box;
  age: number;
}

export class SpeechBubbles {
  private speech: Speech | null = null;
  /** Seconds until the next bubble may start. */
  private quiet = FIRST_DELAY_SEC;
  private clock = 0;
  private readonly lastSpoke = new Map<Villager, number>();
  /** Which of their sayings each villager says next (they take turns through the list). */
  private readonly nextSaying = new Map<Villager, number>();

  constructor(private readonly audio: AudioApi) {}

  /** Call every overworld step, after the villagers moved. `view` is the camera. */
  update(dt: number, villagers: readonly Villager[], hero: Point, view: View): void {
    this.clock += dt;
    const speech = this.speech;
    if (speech) {
      speech.age += dt;
      const box = placeBubble(speech.villager, speech.lines, hero, view);
      if (speech.age >= SHOW_SEC || !box || !canHear(speech.villager, hero, OUT_OF_RANGE_FACTOR)) this.hush();
      else speech.box = box;
      return;
    }
    const listeners = villagers.filter((v) => (v.spawn.bubbles?.length ?? 0) > 0 && canHear(v, hero, 1));
    if (listeners.length === 0) {
      this.quiet = Math.max(this.quiet, FIRST_DELAY_SEC);
      return;
    }
    this.quiet -= dt;
    if (this.quiet > 0) return;
    const rested = listeners.filter((v) => this.clock - (this.lastSpoke.get(v) ?? -Infinity) >= REPEAT_SEC);
    for (const villager of byDistance(rested, hero)) {
      const lines = this.nextLines(villager);
      const box = lines.length > 0 ? placeBubble(villager, lines, hero, view) : null;
      if (box) {
        this.start(villager, lines, box);
        return;
      }
    }
  }

  /** Ends the current bubble at once (the hero started talking to someone, or the speaker left). */
  hush(): void {
    this.speech = null;
    this.quiet = GAP_SEC + Math.random() * GAP_JITTER_SEC;
  }

  /** World-space; call with the camera transform applied, above the lighting. */
  draw(g: CanvasRenderingContext2D): void {
    const speech = this.speech;
    if (!speech) return;
    const appear = Math.min(1, speech.age / FADE_SEC);
    const alpha = Math.min(appear, (SHOW_SEC - speech.age) / FADE_SEC);
    if (alpha <= 0) return;
    // While fading in, the bubble drifts in from a little further away from its speaker.
    const drift = Math.round((1 - appear) * DRIFT_PX) * (speech.box.below ? 1 : -1);
    const box = { ...speech.box, top: speech.box.top + drift };

    g.save();
    g.globalAlpha *= alpha;
    drawBubble(g, box);
    speech.lines.forEach((line, i) => drawText(g, line, box.left + PAD_X, box.top + PAD_Y + i * FONT_LINE_HEIGHT, { color: COLORS.text, outline: null }));
    g.restore();
  }

  /** The villager's next saying, wrapped into bubble lines (empty if it has none). */
  private nextLines(villager: Villager): string[] {
    const sayings = villager.spawn.bubbles ?? [];
    const index = this.nextSaying.get(villager) ?? 0;
    return wrapBubbleText(sayings[index % sayings.length] ?? "", MAX_TEXT_W, MAX_LINES, (text) => measureText(text));
  }

  private start(villager: Villager, lines: string[], box: Box): void {
    this.nextSaying.set(villager, (this.nextSaying.get(villager) ?? 0) + 1);
    this.lastSpoke.set(villager, this.clock);
    this.speech = { villager, lines, box, age: 0 };
    this.audio.sfx("talk", { volume: POP_VOLUME });
  }
}

/** The bubble over the villager's head if it fits there, else under their feet if that fits, else null. */
function placeBubble(villager: Villager, lines: readonly string[], hero: Point, view: View): Box | null {
  const w = Math.max(...lines.map((line) => measureText(line))) + PAD_X * 2;
  const h = PAD_Y * 2 + (lines.length - 1) * FONT_LINE_HEIGHT + TEXT_CELL_H;
  const tipX = Math.round(villager.x);
  const left = tipX - Math.round(w / 2);
  const above: Box = { left, top: Math.round(villager.headY) - TIP_GAP_PX - TAIL_H - h, w, h, tipX, below: false };
  const below: Box = { left, top: Math.round(villager.y) + TIP_GAP_PX + TAIL_H, w, h, tipX, below: true };
  return [above, below].find((box) => isClearOfHud(box, view) && !coversHero(box, hero)) ?? null;
}

/** True when the whole bubble (and its tail) is on screen and covers no part of the HUD. */
function isClearOfHud(box: Box, view: View): boolean {
  const left = box.left - view.left;
  const right = left + box.w;
  const top = box.top - view.top - (box.below ? TAIL_H : 0);
  const bottom = box.top - view.top + box.h + (box.below ? 0 : TAIL_H);
  const inCornerRows = top < HUD.cornerBottom;
  return (
    left >= HUD.side &&
    right <= VIEW_W - HUD.side &&
    top >= HUD.top &&
    bottom <= VIEW_H - HUD.bottom &&
    (!inCornerRows || (left >= HUD.cornerW && right <= VIEW_W - HUD.cornerW))
  );
}

function coversHero(box: Box, hero: Point): boolean {
  const overlapsX = box.left < hero.x + HERO_BOX.halfW && box.left + box.w > hero.x - HERO_BOX.halfW;
  const overlapsY = box.top < hero.y && box.top + box.h > hero.y - HERO_BOX.h;
  return overlapsX && overlapsY;
}

function canHear(villager: Villager, hero: Point, factor: number): boolean {
  return Math.abs(villager.x - hero.x) <= HEAR_X_PX * factor && Math.abs(villager.y - hero.y) <= HEAR_Y_PX * factor;
}

/** Nearest first. */
function byDistance(villagers: readonly Villager[], hero: Point): Villager[] {
  const distance = (v: Villager) => Math.hypot(v.x - hero.x, v.y - hero.y);
  return [...villagers].sort((a, b) => distance(a) - distance(b));
}

/**
 * A cream bubble with a 1-px ink border, cut corners and a soft shadow, and
 * a tail pointing at the speaker: three rows (5, 3 and 1 px wide) whose
 * inside opens into the bubble, under it (pointing down at the head) or
 * over it (pointing up at the feet).
 */
function drawBubble(g: CanvasRenderingContext2D, box: Box): void {
  const { left: x, top: y, w, h, tipX } = box;
  // Tail rows counted from the bubble's edge outward: row 0 touches the bubble.
  const tailRow = (row: number) => (box.below ? y - 1 - row : y + h + row);
  g.fillStyle = COLORS.shadow;
  g.fillRect(x + 1, y + 2, w - 2, h);
  g.fillStyle = COLORS.border;
  g.fillRect(x + 1, y, w - 2, h);
  g.fillRect(x, y + 1, w, h - 2);
  g.fillRect(tipX - 2, tailRow(0), 5, 1);
  g.fillRect(tipX - 1, tailRow(1), 3, 1);
  g.fillRect(tipX, tailRow(2), 1, 1);
  g.fillStyle = COLORS.fill;
  g.fillRect(x + 1, y + 1, w - 2, h - 2);
  g.fillRect(tipX - 1, box.below ? y : y + h - 1, 3, 1); // opens the border where the tail joins
  g.fillRect(tipX - 1, tailRow(0), 3, 1);
  g.fillRect(tipX, tailRow(1), 1, 1);
}
