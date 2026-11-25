/**
 * The layered character generator (the hero and every villager).
 *
 *   renderCharacter(look, hatId) → a sheet of 4 directions × 3 frames
 *
 * A character is assembled like paper dolls, back to front:
 *
 *   hair (back) → legs → outfit → head → eyes, mouth, accessory → hair (front) → hat
 *
 * Each layer is a string grid from characterParts.ts; colours come from the
 * player's choices in `CharacterLook` (indices into the option lists in
 * catalog.ts). Shades and highlights are DERIVED from those base colours
 * (color.ts), so any skin / hair / outfit colour gets proper shading. When
 * the picture is complete, a coloured outline is traced around it: each
 * outline pixel is a dark version of the colour it touches ("selective
 * outlining"), so blonde hair gets a brown outline instead of a black one.
 *
 * Frame size: 20 × 32 px, anchor (10, 32) = between the feet. The figure
 * itself is ~16 × 20; the empty space above the head is room for hats.
 */
import { ACCESSORIES, EYE_STYLES, HAIR_COLORS, HAIR_STYLES, HATS, OUTFIT_COLORS, OUTFITS, SKIN_TONES } from "@/lib/game/catalog";
import { mulberry32 } from "@/lib/rng";
import type { CharacterLook } from "@/lib/types";
import { INK, light, luminance, mix, shade } from "./color";
import { cached, mod, Pix, type Palette, type Sprite } from "./engine";
import { ACCESSORY, BOB, FACE, HAIR, HAT_ART, HEAD, LEGS, MOUTH, OUTFIT_LEGS, OUTFIT_PARTS, type Part, type View } from "./characterParts";

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

export interface CharacterSheet {
  look: CharacterLook;
  hat: string | null;
  /** One frame: `step` 0 = stand, 1 = step A, 2 = step B (taken modulo 3). */
  frame(dir: Facing, step: number): Sprite;
}

/** Clamp-safe option lookup (old saves may hold out-of-range indices). */
const pick = <T,>(list: readonly T[], i: number): T => list[mod(i, list.length)];

const outlineCache = new Map<string, string>();
/** Outline colour for a pixel of colour `c`: a deep, slightly purple version of it. */
function selout(c: string): string {
  return cached(outlineCache, c, () => mix(shade(c, 0.4), INK, 0.55));
}

/** All the colours for one look, keyed by the grid characters. */
function lookPalette(look: CharacterLook): Palette {
  const skin = pick(SKIN_TONES, look.skin);
  const hair = pick(HAIR_COLORS, look.hairColor);
  const outfitName = pick(OUTFITS, look.outfit);
  const cloth = pick(OUTFIT_COLORS, look.outfitColor);
  const lightCloth = luminance(cloth) > 0.8;
  const legs = OUTFIT_LEGS[outfitName];
  const pants = legs === "outfit" ? cloth : legs === "skin" ? skin : legs === "robe" ? shade(cloth, 0.12) : outfitName === "Hoodie" ? "#3f4560" : "#4b5a8c";
  const shoe = outfitName === "Dress" ? "#c0405a" : outfitName === "Robe" ? "#4a3a5a" : "#6b4a3a";
  return {
    s: skin,
    S: shade(skin, 0.08),
    t: light(skin, 0.05),
    o: mix(shade(skin, 0.5), INK, 0.72),
    e: "#2b1d34",
    E: "#ffffff",
    m: mix(skin, "#b8304f", 0.5),
    n: mix(skin, "#ff5f86", 0.45),
    f: shade(skin, 0.17),
    k: "#3a3048",
    c: cloth,
    C: shade(cloth, lightCloth ? 0.09 : 0.12),
    h: light(cloth, lightCloth ? 0.02 : 0.1),
    w: lightCloth ? "#9cc4ee" : "#f7f1e6",
    W: lightCloth ? "#7aa4d4" : "#d8cdd4",
    p: pants,
    P: shade(pants, 0.1),
    b: shoe,
    B: shade(shoe, 0.12),
    g: outfitName === "Dress" ? (lightCloth ? "#ff8fab" : "#fff4f7") : "#ffd34d",
    r: hair,
    R: shade(hair, 0.12),
    y: light(hair, luminance(hair) > 0.75 ? 0.06 : 0.12),
  };
}

function hatPalette(hatId: string, pal: Palette): Palette {
  const art = HAT_ART[hatId];
  const out: Palette = {};
  for (const [k, v] of Object.entries(art.pal)) out[k] = v === "@hair" ? pal.r : v === "@hairShade" ? pal.R : v;
  return out;
}

/** Draws one frame facing down, up or left (right = mirrored left). */
function composeFrame(look: CharacterLook, hatId: string | null, view: View, step: number): Pix {
  const p = new Pix(CHAR_W, CHAR_H);
  const pal = lookPalette(look);
  const bob = BOB[step];
  const put = (target: Pix, part: Part | null | undefined, palette: Palette = pal, dy = bob) => {
    if (part) target.stamp(part.rows, palette, OX + (part.x ?? 0), OY + part.y + dy);
  };
  const outfitName = pick(OUTFITS, look.outfit);
  const hair = HAIR[pick(HAIR_STYLES, look.hairStyle)] ?? HAIR.Short;
  const hat = hatId ? HAT_ART[hatId] : undefined;

  put(p, hair[view].back);
  put(p, LEGS[view][step], pal, 0);
  put(p, OUTFIT_PARTS[outfitName]?.[view] ?? OUTFIT_PARTS.Tee[view]);
  put(p, HEAD);
  if (view !== "up") {
    put(p, FACE[view][pick(EYE_STYLES, look.eyes)]);
    put(p, MOUTH[view]);
    put(p, ACCESSORY[view][pick(ACCESSORIES, look.accessory)]);
  }
  // hair goes on its own layer so a hat can trim whatever would poke through it
  const hairLayer = new Pix(CHAR_W, CHAR_H);
  put(hairLayer, hair[view].front);
  if (hat?.clip !== undefined) {
    for (let y = 0; y < OY + hat.clip + bob; y++) for (let x = 0; x < CHAR_W; x++) hairLayer.erase(x, y);
  }
  p.paste(hairLayer, 0, 0);
  if (hat) put(p, hat[view] ?? hat.down, hatPalette(hatId!, pal));

  // coloured outline around the whole silhouette
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
  return p;
}

const sheets = new Map<string, CharacterSheet>();

/** Builds (or returns the cached) sprite sheet for a look + hat. */
export function renderCharacter(look: CharacterLook, hatId: string | null): CharacterSheet {
  const hat = hatId && HAT_ART[hatId] ? hatId : null;
  const key = [look.skin, look.hairStyle, look.hairColor, look.outfit, look.outfitColor, look.eyes, look.accessory, hat ?? "-"].join(",");
  return cached(sheets, key, () => {
    const frames = new Map<string, Sprite>();
    return {
      look,
      hat,
      frame(dir, step) {
        const s = mod(step, 3);
        const k = `${dir}${s}`;
        let sp = frames.get(k);
        if (!sp) {
          const view: View = dir === "down" ? "down" : dir === "up" ? "up" : "side";
          let pix = composeFrame(look, hat, view, s);
          if (dir === "right") pix = pix.flippedX();
          sp = pix.toSprite(CHAR_W / 2, CHAR_H);
          frames.set(k, sp);
        }
        return sp;
      },
    };
  });
}

const NAME_START = ["Pip", "Mo", "Lu", "Bix", "Tam", "Wren", "Juno", "Kip", "Nell", "Odo", "Rue", "Sol", "Fen", "Ivy", "Bo", "Mika", "Ash", "Pru", "Zed", "Lark"];
const NAME_END = ["", "", "", "py", "ble", "lo", "na", "kin", "sy", "ra"];

/**
 * A random (but repeatable) look for villagers: the same seed always gives
 * the same person. Hats are not part of a look; pick one separately if you
 * want villagers to wear them.
 */
export function randomLook(seed: number): CharacterLook {
  const rng = mulberry32(seed * 7919 + 17);
  const int = (n: number) => Math.floor(rng() * n);
  const name = NAME_START[int(NAME_START.length)] + NAME_END[int(NAME_END.length)];
  return {
    name,
    skin: int(SKIN_TONES.length),
    hairStyle: int(HAIR_STYLES.length),
    hairColor: rng() < 0.7 ? int(6) : int(HAIR_COLORS.length), // mostly natural colours
    outfit: int(OUTFITS.length),
    outfitColor: int(OUTFIT_COLORS.length),
    eyes: int(EYE_STYLES.length),
    accessory: rng() < 0.5 ? 0 : int(ACCESSORIES.length),
  };
}

/** Hat ids the generator can draw (every hat in the catalog). */
export const HAT_IDS: string[] = HATS.map((h) => h.id).filter((id) => id in HAT_ART);
