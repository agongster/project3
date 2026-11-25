/**
 * Lintlands' own pixel font: building labels ("utils/parse_config.py"),
 * damage numbers, HUD counters.
 *
 *   drawText(ctx, "-3", x, y, { color: "#ff5a6e", align: "center" });
 *
 * Metrics: capitals are 7 px tall, lower case 5 px, descenders 2 px more;
 * widths are proportional (an "i" is 1 px, an "m" 5 px) with 1 px between
 * letters. (x, y) is the TOP of the capitals; `align` decides whether x is
 * the left edge, the centre or the right edge. "\n" starts a new line.
 *
 * Speed: the glyphs (fontGlyphs.ts) are painted ONCE per colour into a
 * strip canvas (a "glyph atlas"), and the outline ONCE per outline colour
 * into a second strip. Drawing a label is then just two `drawImage` copies
 * per letter (outlines first, so they never cover a neighbouring letter).
 */
import { INK } from "./color";
import { Pix } from "./engine";
import { GLYPHS, MISSING_GLYPH } from "./fontGlyphs";

/** Height of capital letters and digits, in px. */
export const FONT_CAP_HEIGHT = 7;
/** Distance between the tops of two lines of text, in px (at scale 1). */
export const FONT_LINE_HEIGHT = 11;
/** Empty columns between two letters. */
const SPACING = 1;
/** Rows in a glyph cell: 7 cap-height rows + 2 descender rows. */
const CELL_H = 9;
/** Atlas cells are padded by 1 px on every side to make room for the outline. */
const PAD = 1;

interface Glyph {
  /** Width in px (without padding). */
  w: number;
  /** Exactly CELL_H rows of "#"/"." */
  rows: string[];
  /** Left edge of this glyph's padded cell inside the atlas strips. */
  sx: number;
}

// ───────────────────────── glyph table (pure data) ─────────────────────────

/** Turns "top:row/row/..." into a full-height list of rows. */
function parseGlyph(def: string): string[] {
  const colon = def.indexOf(":");
  const top = colon > 0 ? Number(def.slice(0, colon)) : 0;
  const body = (colon > 0 ? def.slice(colon + 1) : def).split("/");
  const w = Math.max(...body.map((r) => r.length));
  const blank = ".".repeat(w);
  return Array.from({ length: CELL_H }, (_, y) => (body[y - top] ?? blank).padEnd(w, "."));
}

let table: { byChar: Map<string, Glyph>; missing: Glyph; stripW: number } | null = null;

/** Parses every glyph and lays them out side by side (done once, works on the server too). */
function glyphTable() {
  if (table) return table;
  const byChar = new Map<string, Glyph>();
  let sx = 0;
  const add = (def: string): Glyph => {
    const rows = parseGlyph(def);
    const g = { w: rows[0].length, rows, sx };
    sx += g.w + PAD * 2;
    return g;
  };
  for (const [ch, def] of Object.entries(GLYPHS)) byChar.set(ch, add(def));
  const missing = add(MISSING_GLYPH);
  table = { byChar, missing, stripW: sx };
  return table;
}

function glyph(ch: string): Glyph {
  const t = glyphTable();
  return t.byChar.get(ch) ?? t.missing;
}

// ───────────────────────────── atlases ─────────────────────────────

const fillAtlases = new Map<string, HTMLCanvasElement>();
const outlineAtlases = new Map<string, HTMLCanvasElement>();

/** Every glyph painted in one colour, in a single strip canvas. */
function fillAtlas(color: string): HTMLCanvasElement {
  let c = fillAtlases.get(color);
  if (!c) {
    const t = glyphTable();
    const p = new Pix(t.stripW, CELL_H + PAD * 2);
    for (const g of [...t.byChar.values(), t.missing]) {
      g.rows.forEach((row, y) => {
        for (let x = 0; x < g.w; x++) if (row[x] === "#") p.set(g.sx + PAD + x, PAD + y, color);
      });
    }
    c = p.toCanvas();
    fillAtlases.set(color, c);
  }
  return c;
}

/** Just the 1 px outlines (8 neighbours, so diagonals are covered too) of every glyph. */
function outlineAtlas(color: string): HTMLCanvasElement {
  let c = outlineAtlases.get(color);
  if (!c) {
    const t = glyphTable();
    const p = new Pix(t.stripW, CELL_H + PAD * 2);
    for (const g of [...t.byChar.values(), t.missing]) {
      const ink = (x: number, y: number) => g.rows[y]?.[x] === "#";
      for (let y = -1; y <= CELL_H; y++) {
        for (let x = -1; x <= g.w; x++) {
          if (ink(x, y)) continue;
          let near = false;
          for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (ink(x + dx, y + dy)) near = true;
          if (near) p.set(g.sx + PAD + x, PAD + y, color);
        }
      }
    }
    c = p.toCanvas();
    outlineAtlases.set(color, c);
  }
  return c;
}

// ───────────────────────────── public API ─────────────────────────────

function lineWidth(line: string): number {
  let w = 0;
  for (const ch of line) w += glyph(ch).w + SPACING;
  return Math.max(0, w - SPACING);
}

/** Width in px of `text` (the widest line), without the outline. */
export function measureText(text: string, scale = 1): number {
  return Math.max(0, ...text.split("\n").map(lineWidth)) * Math.max(1, Math.round(scale));
}

export interface TextOpts {
  /** Letter colour (default white). */
  color?: string;
  /** Outline colour (default the game's ink); null for no outline. */
  outline?: string | null;
  /** What `x` means: the left edge (default), the centre or the right edge. */
  align?: "left" | "center" | "right";
  /** Whole-number zoom (default 1). */
  scale?: number;
  /** 0–1 opacity. */
  alpha?: number;
}

/** Draws `text` with its top-left (or top-centre / top-right, see `align`) at (x, y). */
export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, opts: TextOpts = {}): void {
  const scale = Math.max(1, Math.round(opts.scale ?? 1));
  const outline = opts.outline === undefined ? INK : opts.outline;
  const fill = fillAtlas(opts.color ?? "#ffffff");
  const line = outline ? outlineAtlas(outline) : null;
  const cellH = (CELL_H + PAD * 2) * scale;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (opts.alpha !== undefined) ctx.globalAlpha *= Math.max(0, Math.min(1, opts.alpha));
  text.split("\n").forEach((row, i) => {
    const w = lineWidth(row) * scale;
    let left = Math.round(x);
    if (opts.align === "center") left = Math.round(x - w / 2);
    else if (opts.align === "right") left = Math.round(x - w);
    const top = Math.round(y) + i * FONT_LINE_HEIGHT * scale - PAD * scale;
    // pass 1: outlines; pass 2: the letters on top
    for (const atlas of line ? [line, fill] : [fill]) {
      let cx = left - PAD * scale;
      for (const ch of row) {
        const g = glyph(ch);
        const cw = g.w + PAD * 2;
        if (ch !== " ") ctx.drawImage(atlas, g.sx, 0, cw, CELL_H + PAD * 2, cx, top, cw * scale, cellH);
        cx += (g.w + SPACING) * scale;
      }
    }
  });
  ctx.restore();
}
