/**
 * Fur markings: plain, spotted, striped or patched (LOOK_MARKINGS in
 * src/lib/game/monsterLooks.ts), painted on top of a finished monster.
 *
 * It only repaints pixels that are exactly the species' BODY tone (the "b"
 * letter of its palette), so the outline, eyes, mouths, wings and sticky
 * notes are never touched, and a marking always uses the family's own
 * shade or highlight, so it matches whatever colours the monster wears.
 * Patterns depend only on the pixel position, never on Math.random(), so
 * the same monster always gets exactly the same spots.
 */
import type { Palette, Pix } from "./engine";

/** LOOK_MARKINGS indices. */
const SPOTTED = 1;
const STRIPED = 2;
const PATCHED = 3;
/** Spots are 2×2 blocks on a diagonal lattice of blocks: one every SPOT_STEP blocks, in every other block row. */
const SPOT_BLOCK = 2;
const SPOT_STEP = 3;
/** A stripe every STRIPE_GAP rows. */
const STRIPE_GAP = 3;
/** The patch: an ellipse at this spot of the body's bounding box, this big (shares of width / height). */
const PATCH_CENTRE = { x: 0.4, y: 0.62 };
const PATCH_RADIUS = { x: 0.26, y: 0.2 };

/** True when pixel (x, y) is part of the marking's pattern; `box` is the bounding box of the body pixels. */
function inPattern(marking: number, x: number, y: number, box: { x0: number; y0: number; x1: number; y1: number }): boolean {
  switch (marking) {
    case SPOTTED: {
      const bx = Math.floor(x / SPOT_BLOCK);
      const by = Math.floor(y / SPOT_BLOCK);
      return by % 2 === 0 && (bx + by) % SPOT_STEP === 0;
    }
    case STRIPED:
      return (y - box.y0) % STRIPE_GAP === 1;
    case PATCHED: {
      const w = box.x1 - box.x0 + 1;
      const h = box.y1 - box.y0 + 1;
      const nx = (x - (box.x0 + w * PATCH_CENTRE.x)) / (w * PATCH_RADIUS.x);
      const ny = (y - (box.y0 + h * PATCH_CENTRE.y)) / (h * PATCH_RADIUS.y);
      return nx * nx + ny * ny <= 1;
    }
    default:
      return false;
  }
}

/**
 * Paints marking number `marking` over the body-tone pixels of `p`: spots and
 * stripes in the palette's shade ("s"), a patch in its highlight ("h").
 * Marking 0 (plain) or a palette without a body tone changes nothing.
 */
export function markBody(p: Pix, marking: number, pal: Palette): Pix {
  const body = pal.b?.toLowerCase();
  if (marking === 0 || !body) return p;
  const bodyPixels: [number, number][] = [];
  const box = { x0: p.w, y0: p.h, x1: -1, y1: -1 };
  p.forEach((x, y) => {
    if (p.hexAt(x, y) !== body) return;
    bodyPixels.push([x, y]);
    box.x0 = Math.min(box.x0, x);
    box.y0 = Math.min(box.y0, y);
    box.x1 = Math.max(box.x1, x);
    box.y1 = Math.max(box.y1, y);
  });
  const color = marking === PATCHED ? pal.h : pal.s;
  for (const [x, y] of bodyPixels) if (inPattern(marking, x, y, box)) p.set(x, y, color);
  return p;
}
