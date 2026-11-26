/**
 * All the colours of one look, keyed by the grid characters of the parts
 * (see the key list in characterParts.ts).
 *
 * The player picks only base colours (skin, hair, eyes, two outfit
 * colours); every shade and highlight is DERIVED from them (color.ts), so
 * any combination gets proper shading. Besides the one-letter grid keys the
 * palette holds a few named colours ("hair", "accent", ...) that the small
 * palettes of hats and back items borrow with "@name". The "accent" is the
 * second colour the player chose, or a warm red on "Classic" (for capes).
 */
import { EYE_COLORS, HAIR_COLORS, OUTFIT_COLORS, OUTFITS, SKIN_TONES } from "@/lib/game/catalog";
import type { CharacterLook } from "@/lib/types";
import { INK, light, luminance, mix, shade } from "./color";
import { mod, type Palette } from "./engine";
import { DEFAULT_GOLD, DEFAULT_PANTS, OUTFIT_STYLES, type OutfitStyle } from "./characterOutfits";

/** Clamp-safe option lookup (a look may hold any integer; old saves may hold out-of-range ones). */
export const pick = <T,>(list: readonly T[], i: number): T => list[mod(i, list.length)];

/** Cloth brighter than this counts as "very light" (white): its shading and details adapt. */
const LIGHT_CLOTH = 0.8;

/** Capes on "Classic" (no second colour chosen): a warm red that goes with every outfit. */
const CLASSIC_ACCENT = "#c8434e";

/** The shirt colours outfits use when the second colour does not choose the shirt. */
const SHIRT = { normal: ["#f7f1e6", "#d8cdd4"], onLight: ["#9cc4ee", "#7aa4d4"] } as const;

export function outfitName(look: CharacterLook): string {
  return pick(OUTFITS, look.outfit);
}

export function outfitStyle(look: CharacterLook): OutfitStyle {
  return OUTFIT_STYLES[outfitName(look)] ?? OUTFIT_STYLES.Tee;
}

/** A base colour with its derived shade and highlight, the way outfits are shaded. */
function clothRamp(base: string): { base: string; shade: string; light: string } {
  const veryLight = luminance(base) > LIGHT_CLOTH;
  return { base, shade: shade(base, veryLight ? 0.09 : 0.12), light: light(base, veryLight ? 0.02 : 0.1) };
}

/**
 * The second colour the hero actually wears: the chosen one, or on
 * "Classic" the colour the outfit's design pairs with its main colour.
 */
export function secondColor(look: CharacterLook): string {
  if (look.outfitColor2 > 0) return pick(OUTFIT_COLORS, look.outfitColor2 - 1).hex;
  const style = outfitStyle(look);
  if (style.classic) return style.classic;
  const cloth = pick(OUTFIT_COLORS, look.outfitColor).hex;
  const veryLight = luminance(cloth) > LIGHT_CLOTH;
  switch (style.second) {
    case "pants":
      return style.pants ?? DEFAULT_PANTS;
    case "shirt":
      return veryLight ? SHIRT.onLight[0] : SHIRT.normal[0];
    case "trim":
      return cloth;
    case "gold":
      return (style.gold ?? DEFAULT_GOLD)[veryLight ? 1 : 0];
  }
}

/** Shirt, trousers, gold and trim colours: the outfit's defaults, then the second colour on top. */
function outfitColors(look: CharacterLook, skin: string): Palette {
  const style = outfitStyle(look);
  const cloth = clothRamp(pick(OUTFIT_COLORS, look.outfitColor).hex);
  const veryLight = luminance(cloth.base) > LIGHT_CLOTH;
  const shirt = veryLight ? SHIRT.onLight : SHIRT.normal;
  const second = secondColor(look);
  const secondRamp = clothRamp(second);
  const accent = clothRamp(look.outfitColor2 > 0 ? second : CLASSIC_ACCENT);
  const pants =
    style.second === "pants" ? second
    : style.legs === "outfit" ? cloth.base
    : style.legs === "skin" ? skin
    : style.legs === "robe" ? shade(cloth.base, 0.12)
    : (style.pants ?? DEFAULT_PANTS);
  // On "Classic" the shirt keeps its exact old shade; a chosen shirt colour gets a derived one.
  const shirtShade = style.second === "shirt" && look.outfitColor2 > 0 ? shade(second, 0.1) : shirt[1];
  return {
    c: cloth.base,
    C: cloth.shade,
    h: cloth.light,
    u: style.second === "trim" ? secondRamp.base : cloth.base,
    U: style.second === "trim" ? secondRamp.shade : cloth.shade,
    v: style.second === "trim" ? secondRamp.light : cloth.light,
    w: style.second === "shirt" ? second : shirt[0],
    W: shirtShade,
    p: pants,
    P: shade(pants, 0.1),
    b: style.shoe,
    B: shade(style.shoe, 0.12),
    g: style.second === "gold" ? second : (style.gold ?? DEFAULT_GOLD)[veryLight ? 1 : 0],
    outfit: cloth.base,
    outfitShade: cloth.shade,
    second,
    secondShade: secondRamp.shade,
    secondLight: secondRamp.light,
    accent: accent.base,
    accentShade: accent.shade,
    accentLight: accent.light,
  };
}

/** Every colour of a look: grid keys plus the named colours worn extras can borrow. */
export function lookPalette(look: CharacterLook): Palette {
  const skin = pick(SKIN_TONES, look.skin).hex;
  const hair = pick(HAIR_COLORS, look.hairColor).hex;
  const hairShade = shade(hair, 0.12);
  const hairLight = light(hair, luminance(hair) > 0.75 ? 0.06 : 0.12);
  return {
    s: skin,
    S: shade(skin, 0.08),
    t: light(skin, 0.05),
    o: mix(shade(skin, 0.5), INK, 0.72),
    e: INK,
    i: pick(EYE_COLORS, look.eyeColor).hex,
    E: "#ffffff",
    m: mix(skin, "#b8304f", 0.5),
    M: mix(shade(skin, 0.4), "#5a1430", 0.6),
    T: "#ff7a8e",
    n: mix(skin, "#ff5f86", 0.45),
    f: shade(skin, 0.17),
    d: mix(shade(skin, 0.45), INK, 0.45),
    j: mix(light(skin, 0.06), "#c8485e", 0.55),
    q: "#e5484d",
    l: "#fffaf0",
    L: "#c99a64",
    k: "#3a3048",
    r: hair,
    R: hairShade,
    y: hairLight,
    x: mix(skin, shade(hair, 0.15), 0.42),
    ...outfitColors(look, skin),
    skin,
    hair,
    hairShade,
    hairLight,
  };
}

/** A worn extra's own palette with every "@name" replaced by the look's colour of that name. */
export function wornPalette(own: Record<string, string>, look: Palette): Palette {
  const out: Palette = {};
  for (const [key, value] of Object.entries(own)) out[key] = value.startsWith("@") ? look[value.slice(1)] : value;
  return out;
}
