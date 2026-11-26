/**
 * FLOOR CODE, part 2: how a carved line LOOKS in each state of its bug
 * (see src/lib/game/progress.ts for the states):
 *
 *   alive    CURSED: pale violet letters seeping a faint violet glow that
 *            slowly breathes
 *   subdued  CAUGHT: its monster was beaten and is bound here, waiting. The
 *            letters turn almost white with a cool cyan glow that pulses,
 *            inviting the hero to stand on it and press E: the clearest
 *            text in the room. Entering this look, the line blinks white for
 *            a moment (CATCH_SEC)
 *   fixed    HEALED: a white-hot sweep runs along the letters and leaves gold
 *            behind, sparkles pop up where it passes, then the white
 *            afterglow fades into calm gold letters with a warm light (HEAL_SEC)
 *   sealed   SEALED: the letters fade to plain grey stone, with a red wax
 *            seal at the end of the line (SEAL_SEC): accepted, not fixed
 *
 * Readability first: in every look the letters are light and wear a 1 px
 * dark outline (LETTER_OUTLINE), so they keep their shape on dark stone and
 * inside a glow; a glow is a silhouette 2 px fatter than the letters drawn
 * under them, so it shows as a rim beyond the outline.
 *
 * Carvings are drawn right after the floor tiles, so the hero, monsters,
 * props and coins all walk over them, and the dungeon's darkness falls on
 * them as on the floor. Each carving's looks are painted once into small
 * canvases; a frame is then one to three `drawImage` copies per carving.
 */
import { withAlpha } from "@/game/art/color";
import { drawText, measureText } from "@/game/art/font";
import { makeCanvas } from "@/game/art/engine";
import { uiSprite } from "@/game/art/ui";
import type { FindingState } from "@/lib/game/progress";
import type { Camera } from "../engine/camera";
import type { Particles } from "../engine/particles";
import { CARVING_PAD_PX, fitText, type Carving } from "./floorCodeLayout";
import type { Light } from "./scene";

/** The dark rim every look's letters wear, so they keep their shape on dark stone and inside a glow. */
const LETTER_OUTLINE = "#120a1c";

// ── cursed ──
/** Pale violet letters: readable, but quieter than a caught line. */
const CURSED_COLOR = "#c6b3ee";
/** Cursed glow seeping out around the letters (the dungeon's sickly violet). */
const CURSE_COLOR = "#b56cff";
/** The curse glow breathes between these opacities, once every CURSE_BREATH_SEC. */
const CURSE_ALPHA = { min: 0.2, max: 0.5 };
const CURSE_BREATH_SEC = 2.6;
/** Neighbouring carvings breathe this far out of step (radians), so the room never pulses in unison. */
const PHASE_STEP = 1.9;

// ── caught (subdued) ──
/** Almost white letters with a cool cyan glow: not the curse's violet, not the heal's gold, and the brightest text around. */
const CAUGHT_COLOR = "#e4fdff";
/** The inviting glow pulses quicker than the curse breathes, between these opacities. */
const CAUGHT_GLOW_COLOR = "#3fd8ff";
const CAUGHT_ALPHA = { min: 0.5, max: 1 };
const CAUGHT_PULSE_SEC = 1.4;
/** Entering the caught look: a white blink that fades over this long. */
export const CATCH_SEC = 0.45;
const CATCH_SPARKS = 5;
/** A cool little light along the caught line, so it shows up in the dark; it pulses with the halo. */
const CAUGHT_LIGHT = { radius: 14, color: "#5fe3ff" };
const CAUGHT_LIGHT_STRENGTH = 0.55;
const CAUGHT_LIGHT_EVERY_PX = 40;

// ── healed (fixed) ──
/** Healed letters: pale gold (the healed lights make them glow). */
const HEALED_COLOR = "#ffe7a0";
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
const SPARKLE_RISE = { min: 14, spread: 16 };
/** The most sideways drift of a sparkle (px/s). */
const SPARKLE_DRIFT = 10;
/** Sparkles are born at least `above` px above the letters, up to `scatter` px more. */
const SPARKLE_HEIGHT = { above: 1, scatter: 6 };
/** Frames of the "sparkle" UI sprite (dot, four-point star, glint), mixed so the burst never looks like a row of "+". */
const SPARKLE_FRAMES = 3;
/** A moving light rides the sweep so the floor around it lights up too. */
const SWEEP_LIGHT: Omit<Light, "x" | "y"> = { radius: 22, color: "#fff1c2", strength: 0.9 };
/** Healed carvings glow: one small warm light every HEALED_LIGHT_EVERY_PX along the text. */
const HEALED_LIGHT: Omit<Light, "x" | "y"> = { radius: 16, color: "#ffb04a", strength: 0.6 };
const HEALED_LIGHT_EVERY_PX = 32;

// ── sealed ──
/** Plain stone: grey letters, no glow at all. */
const SEALED_COLOR = "#a19cb2";
/** The wax seal stamped after the last letter: a 5 px red disc with a highlight. */
const WAX_COLOR = "#c2414b";
const WAX_SHINE_COLOR = "#ff8a8f";
const WAX_PX = 5;
/** The line fades from its old look to the sealed one over this long. */
export const SEAL_SEC = 0.35;
const SEAL_DUST = 4;

interface Painted {
  carving: Carving;
  cursed: HTMLCanvasElement;
  curse: HTMLCanvasElement;
  caught: HTMLCanvasElement;
  caughtGlow: HTMLCanvasElement;
  healed: HTMLCanvasElement;
  flash: HTMLCanvasElement;
  sealed: HTMLCanvasElement;
  state: FindingState;
  /** The look before the current one (what the heal sweep and the seal fade start from). */
  from: FindingState;
  /** Seconds since `state` began (Infinity: it was already so when the dungeon was built). */
  age: number;
  /** Where in the breathing cycle this carving starts (radians). */
  phase: number;
}

/** Light letters in their dark outline. */
function drawLetters(g: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): void {
  drawText(g, text, x, y, { color, outline: LETTER_OUTLINE });
}

/** A silhouette of the letters 2 px fatter all round: a 1 px-outlined copy stamped at every neighbouring offset. */
function drawHalo(g: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): void {
  for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1]) drawText(g, text, x + dx, y + dy, { color, outline: color });
}

/** One carving's letters painted into a canvas the size of its box by `paint`. */
function paintCanvas(c: Carving, paint: (g: CanvasRenderingContext2D, x: number, y: number) => void): HTMLCanvasElement {
  const canvas = makeCanvas(c.w, c.h);
  paint(canvas.getContext("2d")!, CARVING_PAD_PX, CARVING_PAD_PX);
  return canvas;
}

/** Paints every look of one carving, once, when the dungeon is built. */
function paint(c: Carving, state: FindingState, phase: number): Painted {
  const letters = (color: string) => paintCanvas(c, (g, x, y) => drawLetters(g, c.text, x, y, color));
  // Glows are drawn under the outlined letters: only their outer rim shows.
  const glow = (color: string) => paintCanvas(c, (g, x, y) => drawHalo(g, c.text, x, y, color));
  return {
    carving: c,
    cursed: letters(CURSED_COLOR),
    curse: glow(CURSE_COLOR),
    caught: letters(CAUGHT_COLOR),
    caughtGlow: glow(CAUGHT_GLOW_COLOR),
    healed: letters(HEALED_COLOR),
    // The flash is meant to dazzle: white letters in a white haze, no dark rim.
    flash: paintCanvas(c, (g, x, y) => {
      drawHalo(g, c.text, x, y, FLASH_HALO_COLOR);
      drawText(g, c.text, x, y, { color: FLASH_COLOR, outline: null });
    }),
    sealed: letters(SEALED_COLOR),
    state,
    from: state,
    age: Infinity,
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

/** Front of the sweep `age` seconds into the heal, in px from the carving's left edge. */
function sweepFront(c: Carving, age: number): number {
  const k = Math.min(1, age / SWEEP_SEC);
  return -SWEEP_BAND_PX + easeOut(k) * (c.w + 2 * SWEEP_BAND_PX);
}

/** Seconds into the heal at which the sweep's front reaches `x` px along the carving (sweepFront backwards). */
function sweepArrival(c: Carving, x: number): number {
  return SWEEP_SEC * easeOutInverse((x + SWEEP_BAND_PX) / (c.w + 2 * SWEEP_BAND_PX));
}

/** 0 → 1 → 0 once every `period` seconds, offset by `phase` radians. */
function pulse(time: number, period: number, phase: number): number {
  return 0.5 + 0.5 * Math.sin((time / period) * Math.PI * 2 + phase);
}

export class CarvingLooks {
  private readonly painted: Painted[];
  /** Seconds of (unpaused) time, for the breathing and pulsing. */
  private time = 0;

  /** `stateOf` gives each carving's look when the dungeon is built (no entrance effect). */
  constructor(carvings: readonly Carving[], stateOf: (findingId: string) => FindingState) {
    this.painted = carvings.map((c, i) => paint(c, stateOf(c.findingId), i * PHASE_STEP));
  }

  /** Call once per step: any carving whose bug changed state starts its new look (with its little effect). */
  update(dt: number, particles: Particles, stateOf: (findingId: string) => FindingState): void {
    this.time += dt;
    for (const p of this.painted) {
      p.age += dt;
      const state = stateOf(p.carving.findingId);
      if (state !== p.state) this.enter(p, state, particles);
    }
  }

  /** The code was edited and findings moved: each carving follows its finding to its new id (`renamed`: old id → new id). */
  rekey(renamed: ReadonlyMap<string, string>): void {
    for (const p of this.painted) {
      const id = renamed.get(p.carving.findingId);
      if (id !== undefined) p.carving = { ...p.carving, findingId: id };
    }
  }

  /**
   * A moved finding's line number changed: its carving is cut again with
   * `text` (never wider than before, so it still fits the spot it was given).
   */
  relabel(findingId: string, text: string): void {
    const index = this.painted.findIndex((p) => p.carving.findingId === findingId);
    const old = this.painted[index];
    if (!old || old.carving.text === text) return;
    const fitted = fitText(text, old.carving.w - 2 * CARVING_PAD_PX);
    if (fitted === "") return;
    const carving = { ...old.carving, text: fitted, w: measureText(fitted) + 2 * CARVING_PAD_PX };
    this.painted[index] = { ...paint(carving, old.state, old.phase), from: old.from, age: old.age };
  }

  /** Draws the carvings on screen. Call in world space, right after the floor tiles. */
  draw(g: CanvasRenderingContext2D, camera: Pick<Camera, "sees">): void {
    for (const p of this.painted) {
      const c = p.carving;
      if (camera.sees(c.x, c.y, c.w + WAX_PX + 1, c.h)) this.drawLook(g, p, p.state, p.age);
    }
  }

  /** The caught lines' cool glow, the healed lines' warm glow, and the light riding each heal sweep. */
  lights(out: Light[], camera: Pick<Camera, "sees">): void {
    for (const p of this.painted) {
      const c = p.carving;
      if (!camera.sees(c.x, c.y, c.w, c.h)) continue;
      const midY = c.y + c.h / 2;
      if (p.state === "subdued") {
        const strength = CAUGHT_LIGHT_STRENGTH * (0.6 + 0.4 * pulse(this.time, CAUGHT_PULSE_SEC, p.phase));
        spreadLights(out, c, { ...CAUGHT_LIGHT, strength }, CAUGHT_LIGHT_EVERY_PX);
      } else if (p.state === "fixed") {
        if (p.age < SWEEP_SEC) out.push({ ...SWEEP_LIGHT, x: c.x + sweepFront(c, p.age), y: midY });
        spreadLights(out, c, HEALED_LIGHT, HEALED_LIGHT_EVERY_PX);
      }
    }
  }

  private enter(p: Painted, state: FindingState, particles: Particles): void {
    p.from = p.state;
    p.state = state;
    p.age = 0;
    const c = p.carving;
    if (state === "fixed") healSparkles(c, particles);
    else if (state === "subdued") particles.burst(CATCH_SPARKS, c.x + c.w / 2, c.y + c.h / 2, 30, { life: 0.5, sprite: uiSprite("sparkle", 1), drag: 3 });
    else if (state === "sealed") particles.burst(SEAL_DUST, c.x + c.w, c.y + c.h / 2, 16, { life: 0.5, sprite: uiSprite("dust", 0), drag: 3 });
  }

  private drawLook(g: CanvasRenderingContext2D, p: Painted, state: FindingState, age: number): void {
    switch (state) {
      case "alive":
        return this.drawCursed(g, p);
      case "subdued":
        return this.drawCaught(g, p, age);
      case "fixed":
        if (age < HEAL_SEC) return this.drawHealing(g, p);
        g.drawImage(p.healed, p.carving.x, p.carving.y);
        return;
      case "sealed":
        return this.drawSealed(g, p, age);
    }
  }

  private drawCursed(g: CanvasRenderingContext2D, p: Painted): void {
    const c = p.carving;
    g.globalAlpha = CURSE_ALPHA.min + (CURSE_ALPHA.max - CURSE_ALPHA.min) * pulse(this.time, CURSE_BREATH_SEC, p.phase);
    g.drawImage(p.curse, c.x, c.y);
    g.globalAlpha = 1;
    g.drawImage(p.cursed, c.x, c.y);
  }

  /** The pulsing cyan halo under cyan letters; just after the catch, a white blink fading out on top. */
  private drawCaught(g: CanvasRenderingContext2D, p: Painted, age: number): void {
    const c = p.carving;
    g.globalAlpha = CAUGHT_ALPHA.min + (CAUGHT_ALPHA.max - CAUGHT_ALPHA.min) * pulse(this.time, CAUGHT_PULSE_SEC, p.phase);
    g.drawImage(p.caughtGlow, c.x, c.y);
    g.globalAlpha = 1;
    g.drawImage(p.caught, c.x, c.y);
    if (age < CATCH_SEC) {
      g.globalAlpha = 1 - age / CATCH_SEC;
      g.drawImage(p.flash, c.x, c.y);
      g.globalAlpha = 1;
    }
  }

  /** Mid-heal: gold behind the sweep, a white-hot band at its front, the old look ahead; then the white fades. */
  private drawHealing(g: CanvasRenderingContext2D, p: Painted): void {
    const c = p.carving;
    const front = sweepFront(c, p.age);
    drawColumns(g, p.healed, c, 0, front - SWEEP_BAND_PX);
    drawColumns(g, p.flash, c, front - SWEEP_BAND_PX, front);
    drawColumns(g, p.from === "subdued" ? p.caught : p.cursed, c, front, c.w);
    const afterglow = 1 - Math.max(0, p.age - SWEEP_SEC) / (HEAL_SEC - SWEEP_SEC);
    if (p.age >= SWEEP_SEC && afterglow > 0) {
      g.globalAlpha = afterglow;
      g.drawImage(p.flash, c.x, c.y);
      g.globalAlpha = 1;
    }
  }

  /** Grey stone and the wax seal just after the last letter; while it settles, the old look fades out over it. */
  private drawSealed(g: CanvasRenderingContext2D, p: Painted, age: number): void {
    const c = p.carving;
    g.drawImage(p.sealed, c.x, c.y);
    drawWaxSeal(g, c.x + c.w + 1, c.y + Math.floor((c.h - WAX_PX) / 2));
    if (age >= SEAL_SEC || p.from === "sealed") return;
    g.globalAlpha = 1 - age / SEAL_SEC;
    this.drawLook(g, p, p.from, Infinity);
    g.globalAlpha = 1;
  }
}

/** One light every `every` px along a carving. */
function spreadLights(out: Light[], c: Carving, light: Omit<Light, "x" | "y">, every: number): void {
  const count = Math.max(1, Math.round(c.w / every));
  for (let i = 0; i < count; i++) out.push({ ...light, x: c.x + ((i + 0.5) / count) * c.w, y: c.y + c.h / 2 });
}

/** A 5 px red wax disc (corners cut) with a one-pixel shine, its top-left at (x, y). */
function drawWaxSeal(g: CanvasRenderingContext2D, x: number, y: number): void {
  g.fillStyle = WAX_COLOR;
  g.fillRect(x + 1, y, WAX_PX - 2, WAX_PX);
  g.fillRect(x, y + 1, WAX_PX, WAX_PX - 2);
  g.fillStyle = WAX_SHINE_COLOR;
  g.fillRect(x + 1, y + 1, 1, 1);
}

/** Sparkles pop up along the line, each timed to the moment the heal's sweep reaches it. */
function healSparkles(c: Carving, particles: Particles): void {
  for (let i = 0; i < HEAL_SPARKLES; i++) {
    const x = ((i + Math.random()) / HEAL_SPARKLES) * c.w;
    particles.emit({
      x: c.x + x,
      y: c.y + c.h,
      // Born above the letters, so a sparkle is never mistaken for a "+" in the code.
      z: c.h + SPARKLE_HEIGHT.above + Math.random() * SPARKLE_HEIGHT.scatter,
      vx: (Math.random() - 0.5) * 2 * SPARKLE_DRIFT,
      vz: SPARKLE_RISE.min + Math.random() * SPARKLE_RISE.spread,
      life: SPARKLE_LIFE_SEC,
      delay: sweepArrival(c, x),
      sprite: uiSprite("sparkle", i % SPARKLE_FRAMES),
      drag: 1,
    });
  }
}
