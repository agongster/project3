/**
 * One entry point for every `PropKind`: how many variants/frames it has and
 * which painter draws it. All prop sprites are anchored at the bottom-centre
 * of their base tile: draw them at (tx * 16 + 8, ty * 16 + 16).
 */
import type { PropKind } from "@/lib/types";
import { bonesArt, crateArt, crystalArt, plaqueArt, potArt, torchArt, webArt } from "./dungeonProps";
import { bushArt, flowerArt, mushroomArt, rockArt, stumpArt, treeArt, type PropArt } from "./nature";
import type { ThemePalette } from "./themes";
import { benchArt, boardArt, fenceArt, fountainArt, lampArt, lanternArt, signArt, wardrobeArt, wellArt } from "./village";

/** Distinct looks per prop (`variant` is taken modulo this). */
export const PROP_VARIANTS: Record<PropKind, number> = {
  tree: 3,
  treeAlt: 3,
  bush: 3,
  rock: 3,
  flower: 4,
  mushroom: 2,
  stump: 2,
  lamp: 1,
  fence: 3,
  bench: 1,
  lantern: 1,
  sign: 1,
  well: 1,
  wardrobe: 1,
  board: 1,
  fountain: 1,
  pot: 4,
  crate: 1,
  torch: 2,
  bones: 2,
  crystal: 3,
  web: 3,
  plaque: 1,
};

/** Animation frames per prop (`frame` is taken modulo this; advance about every 150–200 ms). */
export const PROP_FRAMES: Record<PropKind, number> = {
  tree: 1,
  treeAlt: 1,
  bush: 1,
  rock: 1,
  flower: 1,
  mushroom: 1,
  stump: 1,
  lamp: 4,
  fence: 1,
  bench: 1,
  lantern: 2,
  sign: 1,
  well: 4,
  wardrobe: 1,
  board: 1,
  fountain: 3,
  pot: 1,
  crate: 1,
  torch: 4,
  bones: 1,
  crystal: 3,
  web: 1,
  plaque: 1,
};

export function paintProp(pal: ThemePalette, kind: PropKind, v: number, frame: number): PropArt {
  switch (kind) {
    case "tree":
      return treeArt(pal, false, v);
    case "treeAlt":
      return treeArt(pal, true, v);
    case "bush":
      return bushArt(pal, v);
    case "rock":
      return rockArt(pal, v);
    case "flower":
      return flowerArt(pal, v);
    case "mushroom":
      return mushroomArt(pal, v);
    case "stump":
      return stumpArt(pal, v);
    case "lamp":
      return lampArt(pal, frame);
    case "fence":
      return fenceArt(pal, v);
    case "bench":
      return benchArt(pal);
    case "lantern":
      return lanternArt(pal, frame);
    case "sign":
      return signArt(pal);
    case "well":
      return wellArt(pal, frame);
    case "wardrobe":
      return wardrobeArt(pal);
    case "board":
      return boardArt(pal);
    case "fountain":
      return fountainArt(pal, frame);
    case "pot":
      return potArt(v);
    case "crate":
      return crateArt();
    case "torch":
      return torchArt(v, frame);
    case "bones":
      return bonesArt(v);
    case "crystal":
      return crystalArt(v, frame);
    case "web":
      return webArt(v);
    case "plaque":
      return plaqueArt();
  }
}

/**
 * Where light comes from on glowing props, relative to the sprite's anchor
 * (dx, dy in px, so the light centre is at (x + dx, y + dy)), with a radius and
 * colour. Use with `glowSprite()` (additive blending) at night and in dungeons.
 * `night: true` means only glow when the theme is dark.
 */
export const PROP_LIGHTS: Partial<Record<PropKind, { dx: number; dy: number; radius: number; color: string; night?: boolean }>> = {
  lamp: { dx: 0, dy: -19, radius: 28, color: "#ffcf6b", night: true },
  lantern: { dx: 2, dy: -12, radius: 20, color: "#ffb04a", night: true },
  well: { dx: 0, dy: -14, radius: 22, color: "#7ff0ff", night: true },
  torch: { dx: 0, dy: -19, radius: 34, color: "#ffb04a" },
  crystal: { dx: 0, dy: -8, radius: 22, color: "#c79bff" },
};
