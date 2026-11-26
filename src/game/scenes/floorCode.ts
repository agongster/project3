/**
 * FLOOR CODE, part 2: drawing the carvings that floorCodeLayout.ts placed.
 *
 * While its monster lives, a carving is CURSED: letters sunk into the stone
 * (a dark groove with a lighter lower lip) seeping a faint violet glow that
 * slowly breathes. It is drawn right after the floor tiles, so the hero,
 * monsters, props and coins all walk over it, and the dungeon's darkness
 * falls on it exactly as on the floor.
 *
 * When the monster is defeated the line HEALS (HEAL_SEC): a white-hot sweep
 * runs along the letters and leaves gold behind, sparkles pop up where it
 * passes, then the white afterglow fades into the calm HEALED state: gold
 * letters that give off a little warm light of their own.
 *
 * Speed: each carving is painted once, when the dungeon is built, into four
 * small canvases (groove, curse glow, healed, white flash). A frame is then
 * one to three `drawImage` copies per carving on screen.
 */
import { withAlpha } from "@/game/art/color";
import { drawText } from "@/game/art/font";
import { makeCanvas } from "@/game/art/engine";
import { uiSprite } from "@/game/art/ui";
import type { Camera } from "../engine/camera";
import type { Particles } from "../engine/particles";
import { CARVING_PAD_PX, type Carving } from "./floorCodeLayout";
import type { Light } from "./scene";

/** The groove: letters much darker than the darkest floor stone, so they read even in the gloom. */
const GROOVE_COLOR = "#150e22";
/** The groove's lower lip catching the light, lighter than the floor. */
const LIP_COLOR = "#887ba8";
/** Cursed glow seeping out around the groove (the dungeon's sickly violet). */
const CURSE_COLOR = "#b56cff";
/** The curse glow breathes between these opacities... */
const CURSE_ALPHA_MIN = 0.2;
const CURSE_ALPHA_MAX = 0.5;
/** ...once every this many seconds. */
const CURSE_BREATH_SEC = 2.6;
/** Neighbouring carvings breathe this far out of step (radians), so the room never pulses in unison. */
const CURSE_PHASE_STEP = 1.9;

/** Healed letters: the same groove, now filled with pale gold (the healed lights make it glow)... */
const HEALED_COLOR = "#ffe7a0";
/** ...with a warm amber lower lip instead of the cold stone one. */
const HEALED_LIP_COLOR = "#b9772f";
/** The sweep and the afterglow: white letters in a see-through white halo. */
const FLASH_COLOR = "#ffffff";
const FLASH_HALO_COLOR = withAlpha("#ffffff", 0.5);

/** The whole heal, from the first flash to the calm gold (s). */
export const HEAL_SEC = 0.6;
/** The white sweep crosses the letters in this long; the rest of HEAL_SEC is the afterglow fading. */
const SWEEP_SEC = 0.32;
/** Width of the white-hot band at the front of the sweep (px). */
const SWEEP_BAND_PX = 6;
/** Sparkles popping up along the line as the sweep passes, one somewhere in each equal slice of it. */
const HEAL_SPARKLES = 7;
const SPARKLE_LIFE_SEC = 0.7;
/** Upward speed of a sparkle (px/s): at least the minimum, up to minimum + spread. */
const SPARKLE_RISE_MIN = 14;
const SPARKLE_RISE_SPREAD = 16;
/** The most sideways drift of a sparkle (px/s). */
const SPARKLE_DRIFT = 10;
/** Sparkles are born at least SPARKLE_ABOVE_PX above the letters, up to SPARKLE_SCATTER_PX more. */
const SPARKLE_ABOVE_PX = 1;
const SPARKLE_SCATTER_PX = 6;
/** Frames of the "sparkle" UI sprite (dot, four-point star, glint), mixed so the burst never looks like a row of "+". */
const SPARKLE_FRAMES = 3;

/** A moving light rides the sweep so the floor around it lights up too. */
const SWEEP_LIGHT: Omit<Light, "x" | "y"> = { radius: 22, color: "#fff1c2", strength: 0.9 };
/** Healed carvings glow: one small warm light every HEALED_LIGHT_EVERY_PX along the text. */
const HEALED_LIGHT: Omit<Light, "x" | "y"> = { radius: 16, color: "#ffb04a", strength: 0.6 };
const HEALED_LIGHT_EVERY_PX = 32;

/** Marks a carving whose monster is still alive. */
const CURSED = -1;

interface Painted {
  carving: Carving;
  groove: HTMLCanvasElement;
  curse: HTMLCanvasElement;
  healed: HTMLCanvasElement;
  flash: HTMLCanvasElement;
  /** CURSED, or seconds since the heal began (HEAL_SEC and above = calm gold). */
  healAge: number;
  /** Where in the breathing cycle this carving starts (radians). */
  phase: number;
}

/** Letters cut into the stone: a `lip` copy 1 px lower first, so the letters on top cover all but its bottom edge. */
function drawCarvedText(g: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, lip: string): void {
  drawText(g, text, x, y + 1, { color: lip, outline: null });
  drawText(g, text, x, y, { color, outline: null });
}

/** Letters in `color` inside a 1 px `halo` (the halo is painted as a fat silhouette first, then the letters on top). */
function drawGlowingText(g: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, halo: string): void {
  drawText(g, text, x, y, { color: halo, outline: halo });
  drawText(g, text, x, y, { color, outline: null });
}

/** One carving's letters painted into a canvas the size of its box by `paint`. */
function paintCanvas(c: Carving, paint: (g: CanvasRenderingContext2D, x: number, y: number) => void): HTMLCanvasElement {
  const canvas = makeCanvas(c.w, c.h);
  paint(canvas.getContext("2d")!, CARVING_PAD_PX, CARVING_PAD_PX);
  return canvas;
}

/** Paints the four looks of one carving, once, when the dungeon is built. */
function paint(c: Carving, healed: boolean, phase: number): Painted {
  return {
    carving: c,
    groove: paintCanvas(c, (g, x, y) => drawCarvedText(g, c.text, x, y, GROOVE_COLOR, LIP_COLOR)),
    // A violet silhouette 1 px fatter than the letters: drawn under the groove, only its rim shows.
    curse: paintCanvas(c, (g, x, y) => drawText(g, c.text, x, y, { color: CURSE_COLOR, outline: CURSE_COLOR })),
    healed: paintCanvas(c, (g, x, y) => drawCarvedText(g, c.text, x, y, HEALED_COLOR, HEALED_LIP_COLOR)),
    flash: paintCanvas(c, (g, x, y) => drawGlowingText(g, c.text, x, y, FLASH_COLOR, FLASH_HALO_COLOR)),
    healAge: healed ? HEAL_SEC : CURSED,
    phase,
  };
}

/** Copies the columns [from, to) of a carving's canvas to its place on the floor. */
function drawColumns(g: CanvasRenderingContext2D, canvas: HTMLCanvasElement, c: Carving, from: number, to: number): void {
  const left = Math.max(0, Math.round(from));
  const right = Math.min(c.w, Math.round(to));
  if (right > left) g.drawImage(canvas, left, 0, right - left, c.h, c.x + left, c.y, right - left, c.h);
}

/** 0 → 1 with a soft landing, so the sweep slows as it reaches the end of the line. */
const easeOut = (k: number) => 1 - (1 - k) * (1 - k);
/** The inverse of easeOut: how far through the sweep's time it has covered a share `k` of its way. */
const easeOutInverse = (k: number) => 1 - Math.sqrt(1 - k);

/**
 * Front of the sweep `age` seconds into the heal, in px from the carving's
 * left edge. It travels from one band-width before the text to one after it.
 */
function sweepFront(c: Carving, age: number): number {
  const k = Math.min(1, age / SWEEP_SEC);
  return -SWEEP_BAND_PX + easeOut(k) * (c.w + 2 * SWEEP_BAND_PX);
}

/** Seconds into the heal at which the sweep's front reaches `x` px along the carving (sweepFront backwards). */
function sweepArrival(c: Carving, x: number): number {
  return SWEEP_SEC * easeOutInverse((x + SWEEP_BAND_PX) / (c.w + 2 * SWEEP_BAND_PX));
}

export class FloorCode {
  private readonly painted: Painted[];
  /** Seconds of (unpaused) time, for the breathing. */
  private time = 0;
  /** The save's defeated-id list last checked; the save is immutable, so a new defeat means a new array. */
  private seenDefeated: readonly string[] | null = null;

  /** `isHealed` says which carvings start out healed (their monster was beaten on an earlier visit). */
  constructor(carvings: readonly Carving[], isHealed: (findingId: string) => boolean) {
    this.painted = carvings.map((c, i) => paint(c, isHealed(c.findingId), i * CURSE_PHASE_STEP));
  }

  /** Call once per step with the save's defeated finding ids; starts the heal of any newly defeated line. */
  update(dt: number, particles: Particles, defeated: readonly string[]): void {
    this.time += dt;
    if (defeated !== this.seenDefeated) {
      this.seenDefeated = defeated;
      const ids = new Set(defeated);
      for (const p of this.painted) if (p.healAge === CURSED && ids.has(p.carving.findingId)) this.startHeal(p, particles);
    }
    for (const p of this.painted) if (p.healAge !== CURSED) p.healAge = Math.min(HEAL_SEC, p.healAge + dt);
  }

  /** Draws the carvings on screen. Call in world space, right after the floor tiles. */
  draw(g: CanvasRenderingContext2D, camera: Pick<Camera, "sees">): void {
    for (const p of this.painted) {
      const c = p.carving;
      if (!camera.sees(c.x, c.y, c.w, c.h)) continue;
      if (p.healAge === CURSED) this.drawCursed(g, p);
      else if (p.healAge >= HEAL_SEC) g.drawImage(p.healed, c.x, c.y);
      else drawHealing(g, p);
    }
  }

  /** The healed carvings' warm glow, plus the light riding each sweep. */
  lights(out: Light[], camera: Pick<Camera, "sees">): void {
    for (const p of this.painted) {
      const c = p.carving;
      if (p.healAge === CURSED || !camera.sees(c.x, c.y, c.w, c.h)) continue;
      const midY = c.y + c.h / 2;
      if (p.healAge < SWEEP_SEC) out.push({ ...SWEEP_LIGHT, x: c.x + sweepFront(c, p.healAge), y: midY });
      const count = Math.max(1, Math.round(c.w / HEALED_LIGHT_EVERY_PX));
      for (let i = 0; i < count; i++) out.push({ ...HEALED_LIGHT, x: c.x + ((i + 0.5) / count) * c.w, y: midY });
    }
  }

  private drawCursed(g: CanvasRenderingContext2D, p: Painted): void {
    const c = p.carving;
    const breath = 0.5 + 0.5 * Math.sin((this.time / CURSE_BREATH_SEC) * Math.PI * 2 + p.phase);
    g.globalAlpha = CURSE_ALPHA_MIN + (CURSE_ALPHA_MAX - CURSE_ALPHA_MIN) * breath;
    g.drawImage(p.curse, c.x, c.y);
    g.globalAlpha = 1;
    g.drawImage(p.groove, c.x, c.y);
  }

  /** Sparkles pop up along the line, each timed to the moment the sweep reaches it. */
  private startHeal(p: Painted, particles: Particles): void {
    p.healAge = 0;
    const c = p.carving;
    for (let i = 0; i < HEAL_SPARKLES; i++) {
      const x = ((i + Math.random()) / HEAL_SPARKLES) * c.w;
      particles.emit({
        x: c.x + x,
        y: c.y + c.h,
        // Born above the letters, so a sparkle is never mistaken for a "+" in the code.
        z: c.h + SPARKLE_ABOVE_PX + Math.random() * SPARKLE_SCATTER_PX,
        vx: (Math.random() - 0.5) * 2 * SPARKLE_DRIFT,
        vz: SPARKLE_RISE_MIN + Math.random() * SPARKLE_RISE_SPREAD,
        life: SPARKLE_LIFE_SEC,
        delay: sweepArrival(c, x),
        sprite: uiSprite("sparkle", i % SPARKLE_FRAMES),
        drag: 1,
      });
    }
  }
}

/** Mid-heal: gold behind the sweep, a white-hot band at its front, the cursed letters ahead; then the white fades. */
function drawHealing(g: CanvasRenderingContext2D, p: Painted): void {
  const c = p.carving;
  const front = sweepFront(c, p.healAge);
  drawColumns(g, p.healed, c, 0, front - SWEEP_BAND_PX);
  drawColumns(g, p.flash, c, front - SWEEP_BAND_PX, front);
  drawColumns(g, p.groove, c, front, c.w);
  const afterglow = 1 - Math.max(0, p.healAge - SWEEP_SEC) / (HEAL_SEC - SWEEP_SEC);
  if (p.healAge >= SWEEP_SEC && afterglow > 0) {
    g.globalAlpha = afterglow;
    g.drawImage(p.flash, c.x, c.y);
    g.globalAlpha = 1;
  }
}
