/**
 * Scenery themes: one palette per `ThemeId`.
 *
 * Every overworld sprite (ground, props, buildings) is drawn from the SAME
 * code for all six themes; only the colours below (plus a few theme-specific
 * shapes such as the tree type) change. That is why switching theme re-skins
 * the whole village at once.
 *
 * Foliage "tones" lists go from darkest to lightest; they are fed to the
 * lighting helper in `shapes.ts`.
 */
import type { ThemeId } from "@/lib/types";

export type TreeShape = "oak" | "cherry" | "blossom" | "maple" | "pine" | "frost" | "palm" | "bushyPalm" | "glow";
export type MushroomStyle = "toadstool" | "pinkcap" | "pumpkin" | "frost" | "shell" | "glowcap";
export type SprinkleStyle = "daisy" | "petal" | "leaf" | "sparkle" | "shell" | "glow";

export interface ThemePalette {
  id: ThemeId;
  grass: { base: string; dark: string; light: string; deep: string };
  /** Colours of grass tufts (usually darker grass; green beach-grass on the beach). */
  tuft: [string, string];
  /** Tiny decorations sprinkled on some grass tiles. */
  sprinkle: SprinkleStyle;
  sprinkles: string[];
  flowers: string[];
  flowerCenter: string;
  path: { base: string; dark: string; light: string; pebble: string };
  plaza: { base: string; light: string; dark: string; mortar: string };
  sand: { base: string; dark: string; light: string };
  water: { deep: string; base: string; light: string; shine: string; foam: string };
  /** Earth visible under the grass lip along a pond's far (north) shore. */
  bank: string;
  wood: string;
  stone: string;
  trunk: string;
  /** Main tree foliage, dark → light, plus its outline colour. */
  leaves: string[];
  leavesLine: string;
  leavesAlt: string[];
  leavesAltLine: string;
  /** Accent dots on trees/bushes (blossoms, berries, fruit, glow-fruit). */
  fruit: string[];
  trees: [TreeShape, TreeShape];
  mushroom: MushroomStyle;
  roofs: string[];
  walls: string[];
  /** Snow caps on roofs, fences, rocks... */
  snowy: boolean;
  /** Night: lamps and windows glow. */
  lit: boolean;
}

/** Colours the game engine needs around the sprites. */
export interface ThemeColors {
  /** Fill colour outside the map / behind everything. */
  backdrop: string;
  /** Colours for drifting ambient particles (pollen, petals, leaves, snow, bubbles, fireflies). */
  ambient: string[];
  /** Full-screen tint drawn over the world (night-time); alpha 0 for day themes. */
  overlay: string;
  overlayAlpha: number;
  /** Colour of light glows around lamps / windows. */
  glow: string;
}

export const PALETTES: Record<ThemeId, ThemePalette> = {
  meadow: {
    id: "meadow",
    grass: { base: "#86c95a", dark: "#6cb456", light: "#a4d866", deep: "#4f9a55" },
    tuft: ["#5aa856", "#a8dc6c"],
    sprinkle: "daisy",
    sprinkles: ["#fffaf0", "#ffd65c", "#9cc8ff"],
    flowers: ["#fffaf0", "#ffd65c", "#ff9eb5", "#a8c4ff"],
    flowerCenter: "#ffb347",
    path: { base: "#e6c690", dark: "#cba472", light: "#f3ddb0", pebble: "#b88d68" },
    plaza: { base: "#d6cabd", light: "#eee5d8", dark: "#b3a3a6", mortar: "#8f7f8e" },
    sand: { base: "#f1dca2", dark: "#dcc184", light: "#fbefc8" },
    water: { deep: "#3d7fd0", base: "#52a6e4", light: "#86d0f4", shine: "#f0fdff", foam: "#d8f4ff" },
    bank: "#8b6a51",
    wood: "#b47c50",
    stone: "#b9b1bf",
    trunk: "#8f5e43",
    leaves: ["#2f6b4c", "#3d8a4f", "#56a952", "#7cc657", "#addf6f"],
    leavesLine: "#22483d",
    leavesAlt: ["#224f4a", "#2d6b52", "#3d8a58", "#57a75f", "#86c86d"],
    leavesAltLine: "#183a39",
    fruit: ["#ff5d5d", "#ffd65c"],
    trees: ["oak", "pine"],
    mushroom: "toadstool",
    roofs: ["#e0634f", "#4f8fd6", "#f2a24a", "#3fa89a"],
    walls: ["#fff1d6", "#f7dfc4", "#efe0cc"],
    snowy: false,
    lit: false,
  },
  sakura: {
    id: "sakura",
    grass: { base: "#a9d892", dark: "#8fc590", light: "#c6e8a6", deep: "#72aa8a" },
    tuft: ["#7db68c", "#cdeaac"],
    sprinkle: "petal",
    sprinkles: ["#ffc2d4", "#ff9ebb", "#fff0f5"],
    flowers: ["#ff9ebb", "#ffc2d4", "#fff4f7", "#e88fd4"],
    flowerCenter: "#ffd36b",
    path: { base: "#f0d6c7", dark: "#d9b6a9", light: "#f9e9df", pebble: "#c99c95" },
    plaza: { base: "#eddcd8", light: "#faf1ee", dark: "#ceb6bd", mortar: "#ab8f9e" },
    sand: { base: "#f6e3bf", dark: "#e4c9a2", light: "#fff2da" },
    water: { deep: "#4a9cd6", base: "#6cbbe8", light: "#a2ddf3", shine: "#f6fdff", foam: "#e4f6ff" },
    bank: "#9b7469",
    wood: "#bb846c",
    stone: "#c6b9c6",
    trunk: "#7c5060",
    leaves: ["#b2507f", "#d8739f", "#f197bc", "#ffbed4", "#ffe5ee"],
    leavesLine: "#74305a",
    leavesAlt: ["#3b7658", "#4c9660", "#69b56a", "#92d17b", "#c3e99c"],
    leavesAltLine: "#2a5446",
    fruit: ["#ffb3cd", "#fff0f5"],
    trees: ["cherry", "blossom"],
    mushroom: "pinkcap",
    roofs: ["#ee7a9f", "#a183e0", "#5fbeb0", "#f29f7c"],
    walls: ["#fff5ef", "#fbe7ea", "#f3e4d6"],
    snowy: false,
    lit: false,
  },
  autumn: {
    id: "autumn",
    grass: { base: "#d0b45c", dark: "#b49a55", light: "#e2ca72", deep: "#8f7a52" },
    tuft: ["#a8904e", "#e8d282"],
    sprinkle: "leaf",
    sprinkles: ["#e8692e", "#d6452f", "#f4a63a"],
    flowers: ["#f4a63a", "#e8692e", "#fff0c8", "#c94f6d"],
    flowerCenter: "#6b3b2e",
    path: { base: "#bb875a", dark: "#9d6b4b", light: "#d3a376", pebble: "#7f583f" },
    plaza: { base: "#cbb4a1", light: "#e2cebc", dark: "#a8908a", mortar: "#82707b" },
    sand: { base: "#e9cf98", dark: "#d4b67e", light: "#f6e2b4" },
    water: { deep: "#2f7299", base: "#4891b5", light: "#7bbdd4", shine: "#eef9ff", foam: "#d0ebf3" },
    bank: "#7b5541",
    wood: "#a8693f",
    stone: "#b3a5a9",
    trunk: "#6e4636",
    leaves: ["#a3352f", "#cc5430", "#ea7a34", "#f7a542", "#ffd270"],
    leavesLine: "#64272b",
    leavesAlt: ["#7d2a3c", "#a63444", "#d04b48", "#ec7656", "#fba872"],
    leavesAltLine: "#4f1c30",
    fruit: ["#ffd270", "#fff0c8"],
    trees: ["maple", "maple"],
    mushroom: "pumpkin",
    roofs: ["#b8493a", "#8c5a3c", "#c9883a", "#5d7c4c"],
    walls: ["#f7e3c3", "#ecd3b2", "#f3ddca"],
    snowy: false,
    lit: false,
  },
  snow: {
    id: "snow",
    grass: { base: "#eaf1fa", dark: "#d2e0f1", light: "#ffffff", deep: "#b3c7e3" },
    tuft: ["#c2d4ec", "#ffffff"],
    sprinkle: "sparkle",
    sprinkles: ["#ffffff", "#bfe4ff", "#d9cfff"],
    flowers: ["#8fd0f0", "#c3b4f6", "#ffffff", "#ff9fb8"],
    flowerCenter: "#ffe08a",
    path: { base: "#c8d4e6", dark: "#acbbd3", light: "#dce5f1", pebble: "#93a3be" },
    plaza: { base: "#b9c3d5", light: "#d8e0eb", dark: "#98a3bb", mortar: "#79839e" },
    sand: { base: "#e6dccb", dark: "#cfc2ae", light: "#f3ece0" },
    water: { deep: "#5597cc", base: "#76bbe4", light: "#b0dff5", shine: "#ffffff", foam: "#f4fbff" },
    bank: "#8a94b0",
    wood: "#9c6b53",
    stone: "#a9b3c6",
    trunk: "#6f4b43",
    leaves: ["#234b52", "#2c665d", "#3b8268", "#559e74", "#80bd88"],
    leavesLine: "#173640",
    leavesAlt: ["#7b9cc4", "#a3bcdb", "#c5d6ec", "#e2ecf8", "#ffffff"],
    leavesAltLine: "#56709a",
    fruit: ["#e24b4b", "#ffffff"],
    trees: ["pine", "frost"],
    mushroom: "frost",
    roofs: ["#cf524f", "#4a7fc1", "#4e9d69", "#d08a3a"],
    walls: ["#f5e7d3", "#e5d3c3", "#f1e5ea"],
    snowy: true,
    lit: false,
  },
  beach: {
    id: "beach",
    grass: { base: "#f1dda8", dark: "#e2c991", light: "#faeecb", deep: "#cfb27c" },
    tuft: ["#7db866", "#b4dc7c"],
    sprinkle: "shell",
    sprinkles: ["#ffc6d0", "#ffffff", "#ff9b7a"],
    flowers: ["#ff8a7a", "#ffd166", "#ffffff", "#ff6fa8"],
    flowerCenter: "#ffe9a8",
    path: { base: "#e8cdb2", dark: "#d1ae94", light: "#f6e3cf", pebble: "#ffffff" },
    plaza: { base: "#e3a47e", light: "#f2c39b", dark: "#c3806a", mortar: "#a0675b" },
    sand: { base: "#f9eed0", dark: "#e9d6aa", light: "#fffaea" },
    water: { deep: "#1d97b0", base: "#31c2c2", light: "#7ce6d6", shine: "#f2fffb", foam: "#ffffff" },
    bank: "#caa27b",
    wood: "#c3925f",
    stone: "#d9c9b9",
    trunk: "#a87a52",
    leaves: ["#245e44", "#327e4c", "#48a056", "#6dc262", "#a4df7a"],
    leavesLine: "#1a4434",
    leavesAlt: ["#1d6656", "#2a8666", "#3ca772", "#61c482", "#9ce09a"],
    leavesAltLine: "#144a42",
    fruit: ["#8a5a3a", "#ff8a7a"],
    trees: ["palm", "bushyPalm"],
    mushroom: "shell",
    roofs: ["#36c2bb", "#f2896a", "#f1c84d", "#5a99e0"],
    walls: ["#ffffff", "#fff4dc", "#f2efe6"],
    snowy: false,
    lit: false,
  },
  night: {
    id: "night",
    grass: { base: "#3a4679", dark: "#30386b", light: "#47558c", deep: "#262c5c" },
    tuft: ["#2c3466", "#52619a"],
    sprinkle: "glow",
    sprinkles: ["#a8ffcf", "#ffe28a", "#c9b6ff"],
    flowers: ["#8af0ff", "#ffe28a", "#ff9ee0", "#b9a8ff"],
    flowerCenter: "#ffffff",
    path: { base: "#5d5c8f", dark: "#4b497b", light: "#6f6fa2", pebble: "#3f3d6b" },
    plaza: { base: "#6b6d9f", light: "#8385b6", dark: "#56578b", mortar: "#3e3c6b" },
    sand: { base: "#8a86ab", dark: "#76729a", light: "#9e9bbd" },
    water: { deep: "#1c2768", base: "#283a87", light: "#4560ab", shine: "#fff2b8", foam: "#7f9ad8" },
    bank: "#252551",
    wood: "#8a6575",
    stone: "#6f7198",
    trunk: "#4f3b5c",
    leaves: ["#1e2a57", "#263d6b", "#30547d", "#3f6e91", "#5a91a9"],
    leavesLine: "#121637",
    leavesAlt: ["#1a284f", "#21375d", "#2b4b6f", "#38607f", "#4f7f8e"],
    leavesAltLine: "#10152f",
    fruit: ["#ffe28a", "#a8ffcf"],
    trees: ["glow", "pine"],
    mushroom: "glowcap",
    roofs: ["#6b4d9e", "#3e7b8b", "#9a4162", "#4b5ba1"],
    walls: ["#b9aacb", "#a99aba", "#c3b3c4"],
    snowy: false,
    lit: true,
  },
};

export const THEME_COLORS: Record<ThemeId, ThemeColors> = {
  meadow: { backdrop: "#3f8550", ambient: ["#fff6b0", "#ffffff", "#e8ffb0"], overlay: "#000000", overlayAlpha: 0, glow: "#ffd36b" },
  sakura: { backdrop: "#689c80", ambient: ["#ffc2d4", "#ff9ebb", "#fff0f5"], overlay: "#000000", overlayAlpha: 0, glow: "#ffd36b" },
  autumn: { backdrop: "#7d6a4a", ambient: ["#e8692e", "#d6452f", "#f4a63a", "#ffd270"], overlay: "#ff9a3c", overlayAlpha: 0.06, glow: "#ffc061" },
  snow: { backdrop: "#9fb5d6", ambient: ["#ffffff", "#eaf4ff"], overlay: "#9fc4ff", overlayAlpha: 0.06, glow: "#ffd36b" },
  beach: { backdrop: "#1d97b0", ambient: ["#ffffff", "#c8f4ff", "#a6eee6"], overlay: "#000000", overlayAlpha: 0, glow: "#ffe08a" },
  night: { backdrop: "#141838", ambient: ["#d8ff8a", "#ffe28a", "#a8ffcf"], overlay: "#120c3a", overlayAlpha: 0.28, glow: "#ffcf6b" },
};

/**
 * The dungeon palette is shared by every theme: cozy-spooky purple-grey
 * stone warmed by torch light.
 */
export const DUNGEON = {
  floor: { base: "#5b5070", light: "#6d6284", dark: "#4a4060", mortar: "#372e4a" },
  floorAlt: { base: "#544a6c", light: "#675d80", dark: "#443b5b", mortar: "#322a45" },
  moss: ["#3f6a58", "#548a62", "#74a86c"],
  wallTop: { base: "#2d2640", light: "#3b3253", rim: "#776a93", rimDark: "#4f4568" },
  wallFace: { base: "#6a5a87", light: "#7f6f9c", dark: "#55476f", mortar: "#3b3150", shadow: "#2a2238" },
  void: "#130e1f",
  flame: ["#fff4c2", "#ffd36b", "#ff9a3c", "#e8553a"],
  glow: "#ffb04a",
  exit: ["#fff7cf", "#ffe08a", "#ffc061", "#b88a5a"],
  wood: "#9a6a4c",
  stone: "#8c84a2",
  /** Fill colour around a dungeon. */
  backdrop: "#130e1f",
  /** Ambient particle colours inside dungeons (dust motes). */
  ambient: ["#b9a8d8", "#ffd36b"],
};
