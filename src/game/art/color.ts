/**
 * Colour helpers for the pixel-art module.
 *
 * Pixel artists rarely shade by only making a colour darker. Shadows drift
 * towards cool blue/purple and highlights drift towards warm yellow (called
 * "hue shifting"); it is what makes pixel art look rich instead of muddy.
 * `shade()` and `light()` do exactly that, so a whole ramp of tones can be
 * derived from ONE base colour (used for outfits, hair, roofs, ...).
 *
 * Colours are plain CSS hex strings everywhere: "#rrggbb" or "#rrggbbaa".
 */

export interface Rgba {
  r: number;
  g: number;
  b: number;
  /** 0–255 */
  a: number;
}

const parsed = new Map<string, Rgba>();

/** "#rgb", "#rrggbb" or "#rrggbbaa" → {r,g,b,a}. Results are cached (palettes reuse colours a lot). */
export function parseHex(hex: string): Rgba {
  let c = parsed.get(hex);
  if (c) return c;
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((ch) => ch + ch).join("");
  const n = parseInt(h.slice(0, 6), 16);
  c = { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: h.length >= 8 ? parseInt(h.slice(6, 8), 16) : 255 };
  parsed.set(hex, c);
  return c;
}

const hex2 = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");

export function toHex(r: number, g: number, b: number, a = 255): string {
  return "#" + hex2(r) + hex2(g) + hex2(b) + (a >= 255 ? "" : hex2(a));
}

/** RGB (0–255) → [hue 0–360, saturation 0–1, lightness 0–1]. */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

export function hslToHex(h: number, s: number, l: number, a = 255): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const k = (n: number) => (n + h / 30) % 12;
  const f = (n: number) => l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return toHex(f(0) * 255, f(8) * 255, f(4) * 255, a);
}

/** Moves hue `h` towards `target` along the shorter way round the colour wheel, by at most `deg`. */
function towardHue(h: number, target: number, deg: number): number {
  let diff = target - h;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return h + Math.sign(diff) * Math.min(Math.abs(diff), deg);
}

const COOL_HUE = 250; // blue-violet: where shadows drift
const WARM_HUE = 50; // golden yellow: where highlights drift

/** A darker, cooler, slightly more saturated version of `hex` (amount ≈ 0.05–0.4). */
export function shade(hex: string, amount = 0.12): string {
  const { r, g, b, a } = parseHex(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const hue = s < 0.04 ? COOL_HUE : towardHue(h, COOL_HUE, amount * 110);
  const sat = s < 0.04 ? 0.08 + amount * 0.3 : Math.min(1, s + amount * 0.35);
  return hslToHex(hue, sat, l - amount, a);
}

/** A lighter, warmer version of `hex` (amount ≈ 0.05–0.3). */
export function light(hex: string, amount = 0.1): string {
  const { r, g, b, a } = parseHex(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const hue = s < 0.04 ? h : towardHue(h, WARM_HUE, amount * 90);
  return hslToHex(hue, Math.min(1, s * (1 - amount * 0.2) + (s < 0.04 ? 0 : 0.02)), l + amount, a);
}

/** Linear blend between two colours: t = 0 → a, t = 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const x = parseHex(a);
  const y = parseHex(b);
  return toHex(x.r + (y.r - x.r) * t, x.g + (y.g - x.g) * t, x.b + (y.b - x.b) * t, x.a + (y.a - x.a) * t);
}

/** Same colour with a new opacity (0–1). */
export function withAlpha(hex: string, a: number): string {
  const { r, g, b } = parseHex(hex);
  return toHex(r, g, b, a * 255);
}

/** Changes saturation (multiplier) and lightness (offset) without hue shifting. */
export function adjust(hex: string, satMul: number, lightAdd: number, hueAdd = 0): string {
  const { r, g, b, a } = parseHex(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  return hslToHex(h + hueAdd, s * satMul, l + lightAdd, a);
}

/** The deep plum used for outlines across the whole game (never pure black). */
export const INK = "#2b1d34";

/**
 * A 5-tone ramp derived from one base colour:
 *   hi (highlight) > base > lo (shadow) > lo2 (deep shadow) > line (outline)
 * The outline is a very dark version of the colour blended with INK, so an
 * outline around a red roof is a deep wine colour rather than flat black
 * ("selective outlining").
 */
export interface Ramp {
  hi: string;
  base: string;
  lo: string;
  lo2: string;
  line: string;
}

export function ramp(base: string, strength = 1): Ramp {
  return {
    hi: light(base, 0.1 * strength),
    base,
    lo: shade(base, 0.11 * strength),
    lo2: shade(base, 0.22 * strength),
    line: mix(shade(base, 0.38), INK, 0.55),
  };
}

/** Relative brightness 0–1 (for picking readable text colours etc.). */
export function luminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
