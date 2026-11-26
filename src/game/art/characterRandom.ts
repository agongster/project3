/**
 * Random looks: villagers (`randomLook(seed)`, the same seed is always the
 * same person) and the creator's "Surprise me" button.
 *
 * Pure chance makes clashing heroes, so a few house rules keep them
 * pleasant: mostly natural skin and hair colours, a second outfit colour
 * that is either the outfit's classic pairing or an easy neutral, and
 * extras (glasses, beards, capes...) sprinkled rather than piled on.
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
  type ColorOption,
} from "@/lib/game/catalog";
import { mulberry32 } from "@/lib/rng";
import type { CharacterLook } from "@/lib/types";

const NAME_START = ["Pip", "Mo", "Lu", "Bix", "Tam", "Wren", "Juno", "Kip", "Nell", "Odo", "Rue", "Sol", "Fen", "Ivy", "Bo", "Mika", "Ash", "Pru", "Zed", "Lark"];
const NAME_END = ["", "", "", "py", "ble", "lo", "na", "kin", "sy", "ra"];

/** Outfit colours that go with anything: the second colour is often one of these. */
const NEUTRALS = ["Cloud", "Oat", "Charcoal", "Navy", "Cocoa", "Slate", "Camel"];

/** How often each optional thing shows up (0–1). */
export interface LookOdds {
  /** A fantasy skin tone (moss, frost) instead of a natural one. */
  fantasySkin: number;
  /** A fantasy hair colour (pink, teal...) instead of a natural one. */
  fantasyHair: number;
  /** A chosen second outfit colour instead of the outfit's classic pairing. */
  secondColor: number;
  /** A coloured eye colour instead of the classic dark one. */
  eyeColor: number;
  /** Another mouth than the classic smile. */
  mouth: number;
  faceDetail: number;
  eyewear: number;
  facialHair: number;
  backItem: number;
}

/** Villagers: mostly everyday people, a few eccentrics. */
export const VILLAGER_ODDS: LookOdds = {
  fantasySkin: 0.03,
  fantasyHair: 0.2,
  secondColor: 0.5,
  eyeColor: 0.5,
  mouth: 0.4,
  faceDetail: 0.4,
  eyewear: 0.22,
  facialHair: 0.18,
  backItem: 0.2,
};

/** "Surprise me": a little more flair, since the player wants to see what is possible. */
export const SURPRISE_ODDS: LookOdds = {
  fantasySkin: 0.08,
  fantasyHair: 0.3,
  secondColor: 0.65,
  eyeColor: 0.65,
  mouth: 0.5,
  faceDetail: 0.5,
  eyewear: 0.35,
  facialHair: 0.2,
  backItem: 0.45,
};

type Rng = () => number;

const int = (rng: Rng, n: number): number => Math.floor(rng() * n);

/** An index into `list` among the entries that pass `keep`. */
function pickIndex<T>(rng: Rng, list: readonly T[], keep: (item: T) => boolean): number {
  const allowed = list.map((item, index) => (keep(item) ? index : -1)).filter((index) => index >= 0);
  return allowed[int(rng, allowed.length)];
}

/** A colour index: natural colours, or (with chance `fantasy`) the fantasy ones. */
function pickColor(rng: Rng, list: readonly ColorOption[], fantasy: number): number {
  const wantFantasy = rng() < fantasy;
  return pickIndex(rng, list, (color) => (color.fantasy ?? false) === wantFantasy);
}

/** 0 (the list's first, plain option) unless chance says otherwise, then any other option. */
function pickOptional(rng: Rng, count: number, chance: number): number {
  return rng() < chance ? 1 + int(rng, count - 1) : 0;
}

/** The second outfit colour: classic, a neutral, or any colour that is not the main one. */
function pickSecondColor(rng: Rng, main: number, chance: number): number {
  if (rng() >= chance) return 0;
  const neutral = rng() < 0.5;
  const index = pickIndex(rng, OUTFIT_COLORS, (color) => color.name !== OUTFIT_COLORS[main].name && NEUTRALS.includes(color.name) === neutral);
  return index + 1;
}

/** A villager's name. Drawn first from the seed, so names never change when looks gain options. */
function pickName(rng: Rng): string {
  return NAME_START[int(rng, NAME_START.length)] + NAME_END[int(rng, NAME_END.length)];
}

/**
 * A random (but repeatable) look: the same seed always gives the same
 * person. Hats are not part of a look; pick one separately if you want.
 */
export function randomLook(seed: number, odds: LookOdds = VILLAGER_ODDS): CharacterLook {
  const rng = mulberry32(seed * 7919 + 17);
  const name = pickName(rng);
  const outfitColor = int(rng, OUTFIT_COLORS.length);
  return {
    name,
    skin: pickColor(rng, SKIN_TONES, odds.fantasySkin),
    hairStyle: int(rng, HAIR_STYLES.length),
    hairColor: pickColor(rng, HAIR_COLORS, odds.fantasyHair),
    outfit: int(rng, OUTFITS.length),
    outfitColor,
    outfitColor2: pickSecondColor(rng, outfitColor, odds.secondColor),
    eyes: int(rng, EYE_STYLES.length),
    eyeColor: rng() < odds.eyeColor ? pickColor(rng, EYE_COLORS.slice(1), 0.15) + 1 : 0,
    mouth: pickOptional(rng, MOUTHS.length, odds.mouth),
    faceDetail: pickOptional(rng, FACE_DETAILS.length, odds.faceDetail),
    eyewear: pickOptional(rng, EYEWEAR.length, odds.eyewear),
    facialHair: pickOptional(rng, FACIAL_HAIR.length, odds.facialHair),
    backItem: pickOptional(rng, BACK_ITEMS.length, odds.backItem),
  };
}
