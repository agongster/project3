/**
 * The tiny sprite "engine" every art file builds on.
 *
 * ─────────────────────────── THE SPRITE FORMAT ───────────────────────────
 *
 * Lintlands ships no image files. Every sprite is drawn in code, in one of
 * two ways (most sprites mix both):
 *
 * 1. STRING GRIDS — a picture written as text, one string per pixel row,
 *    one character per pixel, plus a palette that says which colour each
 *    character means. "." (or a space) is a transparent pixel.
 *
 *        const HEART = [          const pal = {
 *          ".oo.oo.",               o: "#2b1d34",  // outline
 *          "orrorro",               r: "#ff5a6e",  // red
 *          "orrrrro",               w: "#ffffff",  // shine
 *          ".orrro.",             };
 *          "..oro..",
 *          "...o...",
 *        ];
 *
 *    Because colours live in the palette, the SAME grid can be re-coloured
 *    for free ("palette swap"): a hoodie grid becomes red or blue just by
 *    passing a different palette.
 *
 * 2. DRAWING ROUTINES — small functions that paint pixels with shapes
 *    (rectangles, lines, discs...). Used for things with lots of variation,
 *    like ground tiles, trees and buildings.
 *
 * Both paint into a `Pix`: an in-memory RGBA pixel buffer (no canvas yet,
 * so it also works on the server). When a picture is finished,
 * `pix.toSprite(ax, ay)` copies it onto a real <canvas> once and returns a
 * `Sprite`, which the game draws with `ctx.drawImage` every frame.
 *
 * Every sprite has an ANCHOR (ax, ay): the pixel of the sprite that sits on
 * the entity's position. For things standing on the ground it is the
 * bottom-centre (their "feet"); `drawSprite(ctx, s, x, y)` puts the anchor at
 * (x, y), so callers never have to think about sprite sizes.
 *
 * Sprites are expensive-ish to create and cheap to draw, so every public
 * getter caches its sprites (see `cached`). Nothing here touches `document`
 * until a sprite is actually requested in the browser.
 */
import { INK, parseHex, type Rgba } from "./color";

export interface Sprite {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
  /** Anchor: the pixel inside the sprite that sits on the entity's position. */
  ax: number;
  ay: number;
}

/** Maps grid characters to colours ("#rrggbb" / "#rrggbbaa"). Missing or null = transparent. */
export type Palette = Record<string, string | null | undefined>;

/** Characters that always mean "transparent" in a grid. */
const EMPTY = new Set([".", " "]);

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

// ───────────────────────────── Pix ─────────────────────────────

/** An RGBA pixel buffer with a handful of pixel-art drawing tools. */
export class Pix {
  readonly data: Uint8ClampedArray;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  /** Builds a buffer straight from a string grid. */
  static fromGrid(rows: readonly string[], pal: Palette): Pix {
    const w = Math.max(...rows.map((r) => r.length));
    const p = new Pix(w, rows.length);
    p.stamp(rows, pal, 0, 0);
    return p;
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  /** Alpha (0–255) of a pixel; 0 outside the buffer. */
  alpha(x: number, y: number): number {
    return this.inside(x, y) ? this.data[(y * this.w + x) * 4 + 3] : 0;
  }

  /** True when the pixel is (at least partly) painted. */
  has(x: number, y: number): boolean {
    return this.alpha(x, y) > 0;
  }

  get(x: number, y: number): Rgba | null {
    if (!this.has(x, y)) return null;
    const i = (y * this.w + x) * 4;
    return { r: this.data[i], g: this.data[i + 1], b: this.data[i + 2], a: this.data[i + 3] };
  }

  /** The colour of a pixel as "#rrggbb" (or "#rrggbbaa" if translucent); null when empty. */
  hexAt(x: number, y: number): string | null {
    const c = this.get(x, y);
    if (!c) return null;
    const h = (v: number) => v.toString(16).padStart(2, "0");
    return "#" + h(c.r) + h(c.g) + h(c.b) + (c.a < 255 ? h(c.a) : "");
  }

  /** Paints one pixel (replacing what was there). `null`/`undefined` colours are ignored. */
  set(x: number, y: number, color: string | null | undefined): void {
    if (!color || !this.inside(x | 0, y | 0)) return;
    const c = parseHex(color);
    const i = ((y | 0) * this.w + (x | 0)) * 4;
    this.data[i] = c.r;
    this.data[i + 1] = c.g;
    this.data[i + 2] = c.b;
    this.data[i + 3] = c.a;
  }

  /** Paints a (possibly translucent) colour OVER the existing pixel (alpha blending). */
  blend(x: number, y: number, color: string, opacity = 1): void {
    if (!this.inside(x, y)) return;
    const c = parseHex(color);
    const i = (y * this.w + x) * 4;
    const sa = (c.a / 255) * opacity;
    const da = this.data[i + 3] / 255;
    const oa = sa + da * (1 - sa);
    if (oa <= 0) return;
    for (const [k, v] of [c.r, c.g, c.b].entries()) {
      this.data[i + k] = (v * sa + this.data[i + k] * da * (1 - sa)) / oa;
    }
    this.data[i + 3] = oa * 255;
  }

  /** Makes a pixel transparent. */
  erase(x: number, y: number): void {
    if (this.inside(x, y)) this.data[(y * this.w + x) * 4 + 3] = 0;
  }

  /** Paints only where something is already painted (recolour without changing the silhouette). */
  setIfPainted(x: number, y: number, color: string | null | undefined): void {
    if (this.has(x, y)) this.set(x, y, color);
  }

  rect(x: number, y: number, w: number, h: number, color: string | null | undefined): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, color);
  }

  hline(x0: number, x1: number, y: number, color: string | null | undefined): void {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, color);
  }

  vline(x: number, y0: number, y1: number, color: string | null | undefined): void {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, color);
  }

  /** Bresenham line (1 px wide). */
  line(x0: number, y0: number, x1: number, y1: number, color: string | null | undefined): void {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /**
   * Filled ellipse centred on (cx, cy) with radii rx, ry. Use .5 centres for
   * even-sized shapes (e.g. cx = 7.5 is the exact middle of a 16 px tile).
   */
  ellipse(cx: number, cy: number, rx: number, ry: number, color: string | null | undefined): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x - cx) / (rx + 0.5);
        const ny = (y - cy) / (ry + 0.5);
        if (nx * nx + ny * ny <= 1) this.set(x, y, color);
      }
    }
  }

  /** Draws a string grid with its top-left corner at (x, y). */
  stamp(rows: readonly string[], pal: Palette, x: number, y: number, opts: { flipX?: boolean } = {}): void {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (EMPTY.has(ch)) continue;
        const color = ch in pal ? pal[ch] : "#ff00ff"; // magenta = a typo in a grid
        const px = opts.flipX ? x + row.length - 1 - i : x + i;
        this.set(px, y + j, color);
      }
    });
  }

  /** Copies another buffer on top of this one (transparent pixels are skipped). */
  paste(src: Pix, x: number, y: number, opts: { flipX?: boolean; opacity?: number } = {}): void {
    for (let j = 0; j < src.h; j++) {
      for (let i = 0; i < src.w; i++) {
        const k = (j * src.w + i) * 4;
        const a = src.data[k + 3];
        if (!a) continue;
        const tx = opts.flipX ? x + src.w - 1 - i : x + i;
        const color = "#" + [src.data[k], src.data[k + 1], src.data[k + 2], a].map((v) => v.toString(16).padStart(2, "0")).join("");
        if (a === 255 && (opts.opacity ?? 1) === 1) this.set(tx, y + j, color);
        else this.blend(tx, y + j, color, opts.opacity ?? 1);
      }
    }
  }

  /**
   * Adds a 1 px outline around everything painted: each transparent pixel
   * that touches a painted one becomes `color`. Using only the 4 direct
   * neighbours (default) gives the soft, rounded outline cute sprites use;
   * `diagonals: true` gives a chunkier one.
   */
  outline(color: string = INK, opts: { diagonals?: boolean } = {}): this {
    const add: number[] = [];
    const n4 = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    const n8 = [...n4, [1, 1], [1, -1], [-1, 1], [-1, -1]];
    const dirs = opts.diagonals ? n8 : n4;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.alpha(x, y) > 0) continue;
        if (dirs.some(([dx, dy]) => this.alpha(x + dx, y + dy) > 64)) add.push(x, y);
      }
    }
    for (let i = 0; i < add.length; i += 2) this.set(add[i], add[i + 1], color);
    return this;
  }

  /** Calls `fn` for every painted pixel. */
  forEach(fn: (x: number, y: number, c: Rgba) => void): void {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const c = this.get(x, y);
      if (c) fn(x, y, c);
    }
  }

  clone(): Pix {
    const p = new Pix(this.w, this.h);
    p.data.set(this.data);
    return p;
  }

  /** A mirrored copy (left ↔ right). */
  flippedX(): Pix {
    const p = new Pix(this.w, this.h);
    p.paste(this, 0, 0, { flipX: true });
    return p;
  }

  /** Copies the pixels onto a new <canvas>. Browser only. */
  toCanvas(): HTMLCanvasElement {
    const c = makeCanvas(this.w, this.h);
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(this.w, this.h);
    img.data.set(this.data);
    ctx.putImageData(img, 0, 0);
    return c;
  }

  /** Finishes the picture: a Sprite whose anchor is (ax, ay). Defaults to bottom-centre. */
  toSprite(ax = Math.floor(this.w / 2), ay = this.h): Sprite {
    return { canvas: this.toCanvas(), w: this.w, h: this.h, ax, ay };
  }
}

// ──────────────────────────── helpers ────────────────────────────

/** Deterministic integer hash → [0, 1). Used for "random" texture that never flickers. */
export function hash01(...n: number[]): number {
  let h = 2166136261;
  for (const v of n) {
    h ^= v | 0;
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
  }
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** 4×4 Bayer matrix (values 0–15): the classic ordered-dither pattern used to blend two colours. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Dither threshold in [0, 1) for pixel (x, y). */
export function bayer(x: number, y: number): number {
  return (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
}

/**
 * Memoises sprite factories: `cached(map, key, make)` returns the sprite
 * stored under `key`, creating it the first time.
 */
export function cached<T>(store: Map<string, T>, key: string, make: () => T): T {
  let v = store.get(key);
  if (v === undefined) {
    v = make();
    store.set(key, v);
  }
  return v;
}

/** Safe positive modulo (frame and variant numbers may be any integer). */
export function mod(n: number, m: number): number {
  return ((Math.floor(n) % m) + m) % m;
}

// ──────────────────────────── drawing ────────────────────────────

export interface DrawOpts {
  /** Mirror left ↔ right around the anchor. */
  flipX?: boolean;
  /** 0–1 opacity. */
  alpha?: number;
  /** Integer scale keeps pixels crisp. */
  scale?: number;
  /** Radians, rotates around the anchor (weapons rotate around their grip). */
  rotation?: number;
}

/** Draws `sprite` so that its anchor lands on (x, y). Fast path when no options are used. */
export function drawSprite(ctx: CanvasRenderingContext2D, sprite: Sprite, x: number, y: number, opts?: DrawOpts): void {
  if (!opts || (!opts.flipX && !opts.rotation && (opts.scale ?? 1) === 1 && (opts.alpha ?? 1) === 1)) {
    ctx.drawImage(sprite.canvas, Math.round(x - sprite.ax), Math.round(y - sprite.ay));
    return;
  }
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  ctx.translate(Math.round(x), Math.round(y));
  if (opts.rotation) ctx.rotate(opts.rotation);
  const s = opts.scale ?? 1;
  ctx.scale(opts.flipX ? -s : s, s);
  ctx.drawImage(sprite.canvas, -sprite.ax, -sprite.ay);
  ctx.restore();
}

const flashCache = new WeakMap<Sprite, Sprite>();

/** A solid-white silhouette of any sprite (the classic "I got hit" flash). Cached. */
export function flashSprite(sprite: Sprite, color = "#ffffff"): Sprite {
  const hit = color === "#ffffff" ? flashCache.get(sprite) : undefined;
  if (hit) return hit;
  const c = makeCanvas(sprite.w, sprite.h);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(sprite.canvas, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, sprite.w, sprite.h);
  const out = { ...sprite, canvas: c };
  if (color === "#ffffff") flashCache.set(sprite, out);
  return out;
}

const urlCache = new WeakMap<Sprite, Map<number, string>>();

/** PNG data URL of a sprite scaled up with crisp pixels, for <img src> or CSS in the HTML UI. Cached. */
export function spriteToDataUrl(sprite: Sprite, scale = 1): string {
  let byScale = urlCache.get(sprite);
  if (!byScale) urlCache.set(sprite, (byScale = new Map()));
  const hit = byScale.get(scale);
  if (hit) return hit;
  const c = makeCanvas(sprite.w * scale, sprite.h * scale);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite.canvas, 0, 0, sprite.w * scale, sprite.h * scale);
  const url = c.toDataURL("image/png");
  byScale.set(scale, url);
  return url;
}

/** Wraps an existing canvas as a sprite (used by the font and composite sprites). */
export function canvasSprite(canvas: HTMLCanvasElement, ax = Math.floor(canvas.width / 2), ay = canvas.height): Sprite {
  return { canvas, w: canvas.width, h: canvas.height, ax, ay };
}
