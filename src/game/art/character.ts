/**
 * The layered character generator (the hero and every villager).
 *
 *   renderCharacter(look, hatId) → a sheet of 4 directions × 3 frames
 *   characterSwatch(look, hatId, facing, crop) → one small still picture (creator swatches)
 *
 * A character is assembled like paper dolls, back to front:
 *
 *   back item (behind) → hair (back) → legs → outfit → head
 *   → eyes, mouth, skin detail, facial hair, eyewear → hair (front) → back item (over) → hat
 *
 * (From the side the back item's behind-layer goes after the back hair, so
 * long hair never hides a cape or wings; from the front hair falls in front.)
 *
 * Each layer is a string grid from the characterParts/Face/Hair/Outfits/
 * Back/Hats files; colours come from the player's choices (characterPalette.ts).
 * When the picture is complete, a coloured outline is traced around it: each
 * outline pixel is a dark version of the colour it touches ("selective
 * outlining"), so blonde hair gets a brown outline instead of a black one.
 *
 * Frame size: 20 × 32 px, anchor (10, 32) = between the feet. The figure
 * itself is ~16 × 20; the empty space above the head is room for hats.
 */
import { BACK_ITEMS, EYE_STYLES, EYEWEAR, FACE_DETAILS, FACIAL_HAIR, HAIR_STYLES, HATS, MOUTHS } from "@/lib/game/catalog";
import type { CharacterLook } from "@/lib/types";
import { INK, mix, shade } from "./color";
import { cached, mod, Pix, type Palette, type Sprite } from "./engine";
import { BACK_ART } from "./characterBack";
import { EYE_ART, EYEWEAR_ART, FACE_DETAIL_ART, FACIAL_HAIR_ART, MOUTH_ART } from "./characterFace";
import { HAIR, HAIR_VOLUME } from "./characterHair";
import { HAT_ART, type HatArt } from "./characterHats";
import { OUTFIT_PARTS } from "./characterOutfits";
import { lookPalette, outfitName, pick, wornPalette } from "./characterPalette";
import { BOB, HEAD, LEGS, type Part, type View } from "./characterParts";

export type Facing = "down" | "up" | "left" | "right";
export const FACINGS: Facing[] = ["down", "up", "left", "right"];

/** Frame size of every character sprite. */
export const CHAR_W = 20;
export const CHAR_H = 32;
/** Where the 16-px body grid sits inside the frame. */
const OX = 2;
const OY = 12;

/**
 * Walking: play steps in this order (stand = 0, stepA = 1, stepB = 2),
 * advancing roughly every 120–150 ms. Standing still = step 0.
 */
export const WALK_CYCLE = [1, 0, 2, 0];

/** Free rows a lifted hat keeps above it inside the frame (the walking bounce and the outline). */
const HAT_HEADROOM = 2;

/** At most this many sheets stay cached (the oldest unused one is dropped first). */
export const MAX_CACHED_SHEETS = 96;
/** At most this many creator swatches stay cached. */
export const MAX_CACHED_SWATCHES = 480;

export interface CharacterSheet {
  look: CharacterLook;
  hat: string | null;
  /** One frame: `step` 0 = stand, 1 = step A, 2 = step B (taken modulo 3). */
  frame(dir: Facing, step: number): Sprite;
}

type LookField = Exclude<keyof CharacterLook, "name">;

/** Every look field that changes the picture. A Record, so forgetting a new field is a type error. */
const PICTURE_FIELDS: Record<LookField, true> = {
  skin: true,
  hairStyle: true,
  hairColor: true,
  outfit: true,
  outfitColor: true,
  outfitColor2: true,
  eyes: true,
  eyeColor: true,
  mouth: true,
  faceDetail: true,
  eyewear: true,
  facialHair: true,
  backItem: true,
};
export const LOOK_FIELDS = Object.keys(PICTURE_FIELDS) as LookField[];

/** Cache key of a look + hat: every picture field (never the name: it is not drawn into the sprite). */
export function lookKey(look: CharacterLook, hatId: string | null): string {
  return `${LOOK_FIELDS.map((field) => look[field]).join(",")}|${hatId ?? "-"}`;
}

const outlineCache = new Map<string, string>();
/** Outline colour for a pixel of colour `c`: a deep, slightly purple version of it. */
function selout(c: string): string {
  return cached(outlineCache, c, () => mix(shade(c, 0.4), INK, 0.55));
}

/** The face, seen from the front or the side. */
function drawFace(put: (part: Part | undefined, palette?: Palette) => void, look: CharacterLook, view: "down" | "side"): void {
  put(EYE_ART[view][pick(EYE_STYLES, look.eyes)]);
  put(MOUTH_ART[view][pick(MOUTHS, look.mouth)]);
  put(FACE_DETAIL_ART[view][pick(FACE_DETAILS, look.faceDetail)]);
  put(FACIAL_HAIR_ART[view][pick(FACIAL_HAIR, look.facialHair)]);
  const eyewear = EYEWEAR_ART[pick(EYEWEAR, look.eyewear)];
  if (eyewear) put(eyewear[view], eyewear.pal);
}

/** How far a hat that perches on the hair rises on a voluminous style, as far as the frame has room. */
function hatLift(hat: HatArt, part: Part, hairStyle: string): number {
  if (!hat.perch) return 0;
  return Math.max(0, Math.min(HAIR_VOLUME[hairStyle] ?? 0, OY + part.y - HAT_HEADROOM));
}

/** Traces the coloured outline around everything painted. */
function addOutline(p: Pix): void {
  const edge: [number, number, string][] = [];
  for (let y = 0; y < CHAR_H; y++) {
    for (let x = 0; x < CHAR_W; x++) {
      if (p.has(x, y)) continue;
      // prefer the colour below/above (keeps hair outlines hair-coloured)
      const n = p.hexAt(x, y + 1) ?? p.hexAt(x, y - 1) ?? p.hexAt(x + 1, y) ?? p.hexAt(x - 1, y);
      if (n && n.length === 7) edge.push([x, y, selout(n)]);
    }
  }
  for (const [x, y, c] of edge) p.set(x, y, c);
}

/**
 * Draws one frame facing down, up or left (right = mirrored left) into a
 * pixel buffer. Pure: no canvas, so tests and scripts can call it too.
 */
export function composeCharacter(look: CharacterLook, hatId: string | null, view: View, step: number): Pix {
  const p = new Pix(CHAR_W, CHAR_H);
  const pal = lookPalette(look);
  const bob = BOB[mod(step, 3)];
  const stamp = (target: Pix, part: Part | null | undefined, palette: Palette = pal, dy = bob) => {
    if (part) target.stamp(part.rows, palette, OX + (part.x ?? 0), OY + part.y + dy);
  };
  const put = (part: Part | null | undefined, palette: Palette = pal) => stamp(p, part, palette);
  const hairStyle = pick(HAIR_STYLES, look.hairStyle);
  const hair = HAIR[hairStyle] ?? HAIR.Short;
  const back = BACK_ART[pick(BACK_ITEMS, look.backItem)];
  const backPal = back ? wornPalette(back.pal, pal) : pal;
  const hat = hatId ? HAT_ART[hatId] : undefined;

  // Seen from the front, long hair falls in front of a cape or wings; from the side it
  // would hide them, so there the item goes over the back hair instead.
  const itemOverHair = view !== "down";
  if (!itemOverHair) put(back?.[view].back, backPal);
  put(hair[view].back);
  if (itemOverHair) put(back?.[view].back, backPal);
  stamp(p, LEGS[view][mod(step, 3)], pal, 0);
  put(OUTFIT_PARTS[outfitName(look)]?.[view] ?? OUTFIT_PARTS.Tee[view]);
  put(HEAD);
  if (view !== "up") drawFace(put, look, view);
  // hair goes on its own layer so a hat can trim whatever would poke through it
  const hairLayer = new Pix(CHAR_W, CHAR_H);
  stamp(hairLayer, hair[view].front);
  if (hat?.clip !== undefined) {
    for (let y = 0; y < OY + hat.clip + bob; y++) for (let x = 0; x < CHAR_W; x++) hairLayer.erase(x, y);
  }
  p.paste(hairLayer, 0, 0);
  // straps across the chest, or the whole item seen from behind: over long hair, so a cape never vanishes under it
  put(back?.[view].front, backPal);
  if (hat) {
    const part = hat[view] ?? hat.down;
    stamp(p, part, wornPalette(hat.pal, pal), bob - hatLift(hat, part, hairStyle));
  }
  addOutline(p);
  return p;
}

/** The frame for a facing: "right" is the mirrored side view. */
function composeFacing(look: CharacterLook, hatId: string | null, dir: Facing, step: number): Pix {
  const view: View = dir === "down" ? "down" : dir === "up" ? "up" : "side";
  const pix = composeCharacter(look, hatId, view, step);
  return dir === "right" ? pix.flippedX() : pix;
}

/**
 * `cached` with a size limit: a hit moves the entry to the back of the Map's
 * insertion order, and when the Map grows past `max` the front (the least
 * recently used entry) is dropped.
 */
export function cachedBounded<T>(store: Map<string, T>, key: string, max: number, make: () => T): T {
  const hit = store.get(key);
  if (hit !== undefined) {
    store.delete(key);
    store.set(key, hit);
    return hit;
  }
  const made = make();
  store.set(key, made);
  while (store.size > max) store.delete(store.keys().next().value!);
  return made;
}

const sheets = new Map<string, CharacterSheet>();

/** Builds (or returns the cached) sprite sheet for a look + hat. Frames are drawn on first use. */
export function renderCharacter(look: CharacterLook, hatId: string | null): CharacterSheet {
  const hat = hatId && HAT_ART[hatId] ? hatId : null;
  return cachedBounded(sheets, lookKey(look, hat), MAX_CACHED_SHEETS, () => {
    const frames = new Map<string, Sprite>();
    return {
      look,
      hat,
      frame(dir, step) {
        const s = mod(step, 3);
        return cached(frames, `${dir}${s}`, () => composeFacing(look, hat, dir, s).toSprite(CHAR_W / 2, CHAR_H));
      },
    };
  });
}

/** Swatches leave out the frame's outermost columns, which only the widest wings ever touch. */
const SWATCH_SIDE_MARGIN = 1;

/** Parts of the frame a creator swatch can show, as frame rows [top, bottom). */
export const SWATCH_CROPS = {
  /** Eyes, mouth, skin details, eyewear. */
  face: [OY + 2, OY + 13],
  /** Hair and hats. */
  head: [OY - 6, OY + 14],
  /** Outfits and back items: the whole figure, without the room for tall hats. */
  body: [OY - 4, CHAR_H],
} as const;
export type SwatchCrop = keyof typeof SWATCH_CROPS;

const swatches = new Map<string, Sprite>();

/**
 * One still, standing picture of a look, cropped to the part a creator
 * swatch is about. Cached apart from the sheets, so a grid of swatches
 * never renders whole sheets and costs nothing after the first paint.
 */
export function characterSwatch(look: CharacterLook, hatId: string | null, facing: Facing, crop: SwatchCrop): Sprite {
  const hat = hatId && HAT_ART[hatId] ? hatId : null;
  return cachedBounded(swatches, `${lookKey(look, hat)}|${facing}|${crop}`, MAX_CACHED_SWATCHES, () => {
    const full = composeFacing(look, hat, facing, 0);
    const [top, bottom] = SWATCH_CROPS[crop];
    const part = new Pix(CHAR_W - 2 * SWATCH_SIDE_MARGIN, bottom - top);
    part.paste(full, -SWATCH_SIDE_MARGIN, -top);
    return part.toSprite(CHAR_W / 2, part.h);
  });
}

/** Hat ids the generator can draw (every hat in the catalog). */
export const HAT_IDS: string[] = HATS.map((h) => h.id).filter((id) => id in HAT_ART);
