/**
 * Hand-picked heroes for the creator's "Quick start" row. Written with
 * option NAMES (not list indices) so they read like a description and keep
 * working if the lists grow; `presetLook` turns them into a real look.
 */
import {
  BACK_ITEMS,
  EYE_COLORS,
  EYE_STYLES,
  EYEWEAR,
  FACE_DETAILS,
  FACIAL_HAIR,
  HAIR_COLORS,
  HAIR_STYLES,
  MOUTHS,
  OUTFIT_COLORS,
  OUTFITS,
  SKIN_TONES,
} from "@/lib/game/catalog";
import type { CharacterLook } from "@/lib/types";

/** A preset in words. Fields left out keep their plain first option ("None", "Smile", "Classic"...). */
export interface PresetSpec {
  title: string;
  skin: string;
  hairStyle: string;
  hairColor: string;
  outfit: string;
  outfitColor: string;
  /** The second outfit colour, or "Classic" when left out. */
  outfitColor2?: string;
  eyes: string;
  eyeColor?: string;
  mouth?: string;
  faceDetail?: string;
  eyewear?: string;
  facialHair?: string;
  backItem?: string;
}

export const PRESETS: readonly PresetSpec[] = [
  { title: "Adventurer", skin: "Sand", hairStyle: "Short", hairColor: "Chestnut", outfit: "Tunic", outfitColor: "Leaf", eyes: "Sparkle", eyeColor: "Brown", backItem: "Backpack" },
  { title: "Scholar", skin: "Porcelain", hairStyle: "Bob", hairColor: "Black", outfit: "Sweater", outfitColor: "Wine", outfitColor2: "Oat", eyes: "Dot", faceDetail: "Freckles", eyewear: "Round specs" },
  { title: "Knight", skin: "Umber", hairStyle: "Undercut", hairColor: "Black", outfit: "Armor", outfitColor: "Navy", eyes: "Fierce", eyeColor: "Brown", backItem: "Cape" },
  { title: "Gardener", skin: "Caramel", hairStyle: "Puffs", hairColor: "Espresso", outfit: "Overalls", outfitColor: "Leaf", eyes: "Happy", mouth: "Grin", faceDetail: "Blush" },
  { title: "Star mage", skin: "Ebony", hairStyle: "Long", hairColor: "Snow", outfit: "Robe", outfitColor: "Grape", outfitColor2: "Ice", eyes: "Lashes", eyeColor: "Violet", backItem: "Wings" },
  { title: "Skater", skin: "Bronze", hairStyle: "Mohawk", hairColor: "Teal", outfit: "Sporty", outfitColor: "Tomato", eyes: "Wink", mouth: "Tongue", eyewear: "Shades", faceDetail: "Bandage" },
  { title: "Baker", skin: "Cocoa", hairStyle: "Hijab", hairColor: "Berry", outfit: "Apron", outfitColor: "Peony", eyes: "Sparkle", eyeColor: "Hazel", faceDetail: "Blush" },
  { title: "Ranger", skin: "Peach", hairStyle: "Braids", hairColor: "Ginger", outfit: "Cloak", outfitColor: "Forest", eyes: "Wide", eyeColor: "Green", faceDetail: "Freckles", backItem: "Quiver" },
  { title: "Sage", skin: "Olive", hairStyle: "Bald", hairColor: "Grey", outfit: "Kimono", outfitColor: "Navy", outfitColor2: "Sunflower", eyes: "Sleepy", facialHair: "Beard", eyewear: "Monocle" },
];

/** The index of the option called `name` (colour lists hold objects with a name). Throws on a typo. */
export function optionIndex(list: readonly (string | { name: string })[], name: string): number {
  const index = list.findIndex((option) => (typeof option === "string" ? option : option.name) === name);
  if (index < 0) throw new Error(`Unknown option "${name}"`);
  return index;
}

/** A preset as a look (keeping the player's name). */
export function presetLook(preset: PresetSpec, name: string): CharacterLook {
  return {
    name,
    skin: optionIndex(SKIN_TONES, preset.skin),
    hairStyle: optionIndex(HAIR_STYLES, preset.hairStyle),
    hairColor: optionIndex(HAIR_COLORS, preset.hairColor),
    outfit: optionIndex(OUTFITS, preset.outfit),
    outfitColor: optionIndex(OUTFIT_COLORS, preset.outfitColor),
    outfitColor2: preset.outfitColor2 ? optionIndex(OUTFIT_COLORS, preset.outfitColor2) + 1 : 0,
    eyes: optionIndex(EYE_STYLES, preset.eyes),
    eyeColor: preset.eyeColor ? optionIndex(EYE_COLORS, preset.eyeColor) : 0,
    mouth: preset.mouth ? optionIndex(MOUTHS, preset.mouth) : 0,
    faceDetail: preset.faceDetail ? optionIndex(FACE_DETAILS, preset.faceDetail) : 0,
    eyewear: preset.eyewear ? optionIndex(EYEWEAR, preset.eyewear) : 0,
    facialHair: preset.facialHair ? optionIndex(FACIAL_HAIR, preset.facialHair) : 0,
    backItem: preset.backItem ? optionIndex(BACK_ITEMS, preset.backItem) : 0,
  };
}
