/**
 * Juice: short-lived particles, floating "+1" texts and big banners.
 *
 * The sim says WHAT happened (a SimEvent); this module decides how it LOOKS
 * (a burst of sparkles, a rising "+5", a "COIN SHOWER!" banner). It is plain
 * data with no DOM access — `draw.ts` paints it, `LoadingGame.tsx` feeds it
 * events and calls `updateEffects` every step.
 */
import { mulberry32, pick, randRange, type Rng } from "@/lib/rng";
import type { SimEvent } from "./sim";

/** What a particle looks like; `draw.ts` maps these to UI sprites or plain pixels. */
export type ParticleKind = "pixel" | "sparkle" | "star" | "dust" | "heart";

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Downward acceleration (negative floats upwards). */
  gravity: number;
  age: number;
  life: number;
  /** Only used by "pixel" particles. */
  color: string;
}

/** A little number or word that rises and fades ("+1", "x6!"). */
export interface FloatText {
  text: string;
  x: number;
  y: number;
  age: number;
  life: number;
  color: string;
  /** Font scale (1 = normal, 2 = big). */
  scale: number;
}

/** A big centred announcement ("COIN SHOWER!", "BIG NET!"). */
export interface Banner {
  text: string;
  age: number;
  life: number;
  color: string;
}

export interface Effects {
  rng: Rng;
  particles: Particle[];
  texts: FloatText[];
  banner: Banner | null;
}

/** Hard cap so a long coin shower can never slow the game down. */
const MAX_PARTICLES = 220;
const TEXT_LIFE = 0.9;
/** Floating texts rise this many px over their life. */
export const TEXT_RISE = 18;
const BANNER_LIFE = 1.6;
/** Streak texts ("x3!") start showing from this streak. */
const STREAK_TEXT_FROM = 3;

/** Colours of the confetti pixels in a catch burst. */
const POP_COLORS = ["#ffffff", "#fff1a8", "#ffd166", "#ff9ebb", "#8fe3ff"];
const GOLD_COLORS = ["#fff7cf", "#ffe08a", "#ffc94a", "#ffffff"];
const COIN_COLORS = ["#fff1a8", "#ffd166", "#f0a830"];
export const TEXT_COLORS = { normal: "#ffffff", golden: "#ffd84a", streak: "#ff9ebb", bonus: "#8fffd0" } as const;

export function createEffects(seed: number): Effects {
  return { rng: mulberry32(seed), particles: [], texts: [], banner: null };
}

function addParticle(fx: Effects, p: Omit<Particle, "age">): void {
  if (fx.particles.length >= MAX_PARTICLES) fx.particles.shift();
  fx.particles.push({ ...p, age: 0 });
}

/** `count` particles flying out of (x, y) in all directions. */
function burst(fx: Effects, x: number, y: number, count: number, kind: ParticleKind, colors: readonly string[], speed: number): void {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + randRange(fx.rng, -0.3, 0.3);
    const v = speed * randRange(fx.rng, 0.6, 1.1);
    addParticle(fx, {
      kind,
      x,
      y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v - speed * 0.4,
      gravity: kind === "pixel" ? 160 : -10,
      life: randRange(fx.rng, 0.35, 0.7),
      color: pick(fx.rng, colors),
    });
  }
}

function floatText(fx: Effects, text: string, x: number, y: number, color: string, scale = 1): void {
  fx.texts.push({ text, x, y, age: 0, life: TEXT_LIFE, color, scale });
}

function showBanner(fx: Effects, text: string, color: string): void {
  fx.banner = { text, age: 0, life: BANNER_LIFE, color };
}

/** Turns one sim event into its visual flourish. */
export function effectsForEvent(fx: Effects, event: SimEvent): void {
  switch (event.type) {
    case "catch":
      catchFlourish(fx, event);
      break;
    case "bounce":
      if (event.first) burst(fx, event.x, event.y, 3, "dust", POP_COLORS, 18);
      break;
    case "bonus":
      if (event.bonus === "coinShower") showBanner(fx, "COIN SHOWER!", TEXT_COLORS.golden);
      break;
    case "go":
      break;
  }
}

type CatchEvent = Extract<SimEvent, { type: "catch" }>;

function catchFlourish(fx: Effects, e: CatchEvent): void {
  if (e.golden) {
    burst(fx, e.x, e.y, 14, "pixel", GOLD_COLORS, 70);
    burst(fx, e.x, e.y, 5, "star", GOLD_COLORS, 40);
  } else if (e.kind === "coin") {
    burst(fx, e.x, e.y, 6, "pixel", COIN_COLORS, 50);
  } else if (e.kind === "heart") {
    burst(fx, e.x, e.y, 6, "heart", POP_COLORS, 45);
    showBanner(fx, "BIG NET!", TEXT_COLORS.bonus);
  } else {
    burst(fx, e.x, e.y, 10, "pixel", POP_COLORS, 60);
  }
  burst(fx, e.x, e.y, e.golden ? 4 : 2, "sparkle", POP_COLORS, 30);
  floatText(fx, `+${e.points}`, e.x, e.y - 8, e.golden ? TEXT_COLORS.golden : TEXT_COLORS.normal, e.golden ? 2 : 1);
  // A lower-case "x" because the bitmap font has no "×" sign.
  if (e.streak >= STREAK_TEXT_FROM) floatText(fx, `x${e.streak}!`, e.x, e.y - 22, TEXT_COLORS.streak);
}

/** Ages and moves everything; removes what has finished. */
export function updateEffects(fx: Effects, dt: number): void {
  for (const p of fx.particles) {
    p.age += dt;
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  fx.particles = fx.particles.filter((p) => p.age < p.life);
  for (const t of fx.texts) t.age += dt;
  fx.texts = fx.texts.filter((t) => t.age < t.life);
  if (fx.banner) {
    fx.banner.age += dt;
    if (fx.banner.age >= fx.banner.life) fx.banner = null;
  }
}
