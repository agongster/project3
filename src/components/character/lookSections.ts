/**
 * How the hero creator is organised: five sections (the tabs), each with a
 * few option groups, and the ordered choices of every group. Plain data and
 * small pure functions, so the React components stay thin and this is
 * unit tested (tests/character/lookSections.test.ts).
 */
import { randomLook, secondColor, SURPRISE_ODDS, type Facing, type SwatchCrop } from "@/game/art";
import {
  BACK_ITEMS,
  COVERING_HAIR_STYLES,
  EYE_COLORS,
  EYE_STYLE_ORDER,
  EYE_STYLES,
  EYEWEAR,
  FACE_DETAILS,
  FACIAL_HAIR,
  HAIR_COLOR_ORDER,
  HAIR_COLORS,
  HAIR_STYLE_ORDER,
  HAIR_STYLES,
  MOUTHS,
  OUTFIT_COLOR_ORDER,
  OUTFIT_COLORS,
  OUTFIT_ORDER,
  OUTFITS,
  SKIN_TONE_ORDER,
  SKIN_TONES,
  type ColorOption,
} from "@/lib/game/catalog";
import type { CharacterLook } from "@/lib/types";

/** A look field that holds an option index (every field but the name). */
export type LookField = Exclude<keyof CharacterLook, "name">;

export type SectionId = "body" | "hair" | "face" | "outfit" | "extras";

/** One choice of a group: the value stored in the look, its name, and for colour groups its colour. */
export interface Choice {
  value: number;
  name: string;
  color?: string;
}

export interface GroupSpec {
  field: LookField;
  label: string;
  /** "chip" = plain colour squares; otherwise live previews of the hero, cropped to this part. */
  swatch: "chip" | SwatchCrop;
  /** Which way the hero faces in its previews (default: towards the player). */
  facing?: Facing;
}

export interface SectionSpec {
  id: SectionId;
  label: string;
  groups: readonly GroupSpec[];
  /** The hat picker lives in this section too (hats are items, not look fields). */
  hats?: boolean;
}

export const SECTIONS: readonly SectionSpec[] = [
  {
    id: "body",
    label: "Body",
    groups: [
      { field: "skin", label: "Skin tone", swatch: "chip" },
      { field: "faceDetail", label: "Skin details", swatch: "face" },
    ],
  },
  {
    id: "hair",
    label: "Hair",
    groups: [
      { field: "hairStyle", label: "Hair style", swatch: "head" },
      { field: "hairColor", label: "Hair colour", swatch: "chip" },
      { field: "facialHair", label: "Facial hair", swatch: "face" },
    ],
  },
  {
    id: "face",
    label: "Face",
    groups: [
      { field: "eyes", label: "Eyes", swatch: "face" },
      { field: "eyeColor", label: "Eye colour", swatch: "chip" },
      { field: "mouth", label: "Mouth", swatch: "face" },
    ],
  },
  {
    id: "outfit",
    label: "Outfit",
    groups: [
      { field: "outfit", label: "Outfit", swatch: "body" },
      { field: "outfitColor", label: "Main colour", swatch: "chip" },
      { field: "outfitColor2", label: "Second colour", swatch: "chip" },
    ],
  },
  {
    id: "extras",
    label: "Extras",
    groups: [
      { field: "eyewear", label: "Eyewear", swatch: "face" },
      { field: "backItem", label: "On your back", swatch: "body", facing: "left" },
    ],
    hats: true,
  },
];

export function getSection(id: SectionId): SectionSpec {
  return SECTIONS.find((section) => section.id === id) ?? SECTIONS[0];
}

/** Every index of `list`, in the display order when there is one. */
function ordered(length: number, order?: readonly number[]): readonly number[] {
  return order ?? Array.from({ length }, (_, index) => index);
}

function named(names: readonly string[], order?: readonly number[]): Choice[] {
  return ordered(names.length, order).map((value) => ({ value, name: names[value] }));
}

function colored(colors: readonly ColorOption[], order?: readonly number[]): Choice[] {
  return ordered(colors.length, order).map((value) => ({ value, name: colors[value].name, color: colors[value].hex }));
}

/**
 * The choices of a group in the order the creator shows them. The second
 * outfit colour starts with "Classic", shown in the colour it gives the
 * current outfit (so it depends on the look).
 */
export function choicesFor(field: LookField, look: CharacterLook): Choice[] {
  switch (field) {
    case "skin":
      return colored(SKIN_TONES, SKIN_TONE_ORDER);
    case "hairStyle":
      return named(HAIR_STYLES, HAIR_STYLE_ORDER);
    case "hairColor":
      return colored(HAIR_COLORS, HAIR_COLOR_ORDER);
    case "outfit":
      return named(OUTFITS, OUTFIT_ORDER);
    case "outfitColor":
      return colored(OUTFIT_COLORS, OUTFIT_COLOR_ORDER);
    case "outfitColor2": {
      const classic: Choice = { value: 0, name: "Classic", color: secondColor({ ...look, outfitColor2: 0 }) };
      return [classic, ...colored(OUTFIT_COLORS, OUTFIT_COLOR_ORDER).map((choice) => ({ ...choice, value: choice.value + 1 }))];
    }
    case "eyes":
      return named(EYE_STYLES, EYE_STYLE_ORDER);
    case "eyeColor":
      return colored(EYE_COLORS);
    case "mouth":
      return named(MOUTHS);
    case "faceDetail":
      return named(FACE_DETAILS);
    case "eyewear":
      return named(EYEWEAR);
    case "facialHair":
      return named(FACIAL_HAIR);
    case "backItem":
      return named(BACK_ITEMS);
  }
}

/** A group's heading; the hair colour is the scarf's colour when the "hair" is a head covering. */
export function groupLabel(group: GroupSpec, look: CharacterLook): string {
  const covered = COVERING_HAIR_STYLES.includes(HAIR_STYLES[look.hairStyle] ?? "");
  return group.field === "hairColor" && covered ? "Scarf colour" : group.label;
}

/** The look fields a section edits. */
export function sectionFields(id: SectionId): LookField[] {
  return getSection(id).groups.map((group) => group.field);
}

/** A random new value for every field of one section ("Shuffle" button). Other fields are left alone. */
export function shuffleSection(id: SectionId, seed: number): Partial<CharacterLook> {
  const random = randomLook(seed, SURPRISE_ODDS);
  const patch: Partial<CharacterLook> = {};
  for (const field of sectionFields(id)) patch[field] = random[field];
  return patch;
}

/** A whole random look ("Surprise me"); the player keeps their name. */
export function surpriseLook(look: CharacterLook, seed: number): CharacterLook {
  return { ...randomLook(seed, SURPRISE_ODDS), name: look.name };
}
