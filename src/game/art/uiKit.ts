/**
 * Small helpers shared by the "characters & loot" art files (monsters,
 * items, weapons, pets, UI sprites). They sit on top of engine.ts:
 *
 *   const pic = outlined(GRID, PAL);          // grid → picture + 1 px ink outline
 *   const p = placeBottom(pic, 16, 16);       // stand it on the floor of a 16×16 canvas
 *   return p.toSprite();                      // anchor defaults to bottom-centre
 *
 * Grids in these files are drawn WITHOUT their outer outline: `outlined()`
 * adds it automatically, so the grids stay short and easy to edit. Only
 * inner lines (eyes, mouths, seams) are written into the grids with `k`.
 */
import { INK } from "./color";
import { Pix, type Palette } from "./engine";

/** Shared palette entries every grid in these files may use. */
export const BASE_PAL: Palette = {
  k: INK, // ink: inner lines, pupils
  w: "#ffffff", // pure white: eye shine, sparkles
};

/**
 * A string grid turned into a picture, with a 1 px outline around it
 * (4-neighbour = soft & round). Characters listed in `after` are painted
 * AFTER the outline, so they stay 1 px thin (antennae, whiskers, sparkles).
 */
export function outlined(rows: readonly string[], pal: Palette, opts: { line?: string | null; diagonals?: boolean; pad?: number; after?: string } = {}): Pix {
  const pad = opts.pad ?? 1;
  const after = opts.after ?? "";
  const full = { ...BASE_PAL, ...pal };
  const w = Math.max(...rows.map((r) => r.length));
  const p = new Pix(w + pad * 2, rows.length + pad * 2);
  const body = after ? rows.map((r) => r.replace(new RegExp(`[${after}]`, "g"), ".")) : rows;
  p.stamp(body, full, pad, pad);
  if (opts.line !== null) p.outline(opts.line ?? INK, { diagonals: opts.diagonals });
  if (after) {
    const late = rows.map((r) => r.replace(new RegExp(`[^${after}]`, "g"), "."));
    p.stamp(late, full, pad, pad);
  }
  return trim(p);
}

/** Crops away fully transparent borders. */
export function trim(p: Pix): Pix {
  let x0 = p.w;
  let y0 = p.h;
  let x1 = -1;
  let y1 = -1;
  p.forEach((x, y) => {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  });
  if (x1 < 0) return new Pix(1, 1);
  const out = new Pix(x1 - x0 + 1, y1 - y0 + 1);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = (y * p.w + x) * 4;
    const o = ((y - y0) * out.w + (x - x0)) * 4;
    out.data.set(p.data.subarray(i, i + 4), o);
  }
  return out;
}

/**
 * Pastes `src` into a new w×h canvas, horizontally centred and standing on the
 * bottom edge. `lift` raises it (hover / hop), `dx` nudges it sideways.
 */
export function placeBottom(src: Pix, w: number, h: number, lift = 0, dx = 0): Pix {
  const p = new Pix(w, h);
  p.paste(src, Math.floor((w - src.w) / 2) + dx, h - src.h - lift);
  return p;
}

/** Pastes `src` into the middle of a new w×h canvas (rounding towards the top-left). */
export function placeCenter(src: Pix, w: number, h: number, dx = 0, dy = 0): Pix {
  const p = new Pix(w, h);
  p.paste(src, Math.floor((w - src.w) / 2) + dx, Math.floor((h - src.h) / 2) + dy);
  return p;
}

/** A copy of the grid with row `index` removed: the cheapest "squash" animation frame there is. */
export function squashRows(rows: readonly string[], index: number): string[] {
  return rows.filter((_, i) => i !== index);
}

/** Overwrites part of a grid with another (smaller) grid at column x, row y. "." in the patch keeps the original. */
export function patchRows(rows: readonly string[], patch: readonly string[], x: number, y: number): string[] {
  const out = [...rows];
  patch.forEach((prow, j) => {
    const r = out[y + j] ?? "";
    const chars = r.padEnd(x + prow.length, ".").split("");
    for (let i = 0; i < prow.length; i++) if (prow[i] !== ".") chars[x + i] = prow[i];
    out[y + j] = chars.join("");
  });
  return out;
}
