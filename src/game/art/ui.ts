/**
 * UI & effect sprites: hearts, coins, chests, prompts, badges, combat
 * effects, ambient particles, trail bits and glows.
 *
 *   drawSprite(ctx, uiSprite("coin", frame), pickup.x, pickup.y);
 *
 * ANCHORS
 *  - Things that SIT somewhere (hearts, coins, chests, key caps, badges,
 *    speech bubbles, gems, stars, the bobbing arrow) are anchored at their
 *    BOTTOM-CENTRE, like monsters and props.
 *  - Effects and particles (shadows, slash, sparks, poof, ring, sparkle,
 *    dust, miasma, weather, trail bits, glows) are anchored at their CENTRE.
 *
 * `frame` is any integer; it wraps modulo UI_FRAMES[name].
 * The drawings live in uiHud.ts (HUD & pickups) and uiFx.ts (effects).
 */
import type { Rarity } from "@/lib/types";
import { RARITY_INFO } from "@/lib/game/catalog";
import { cached, mod, type Pix, type Sprite } from "./engine";
import { ambient, dust, hitSpark, miasma, poof, radialGlow, ring, shadow, slash, sparkle, trailBit } from "./uiFx";
import { badge, chest, coin, coinBig, heart, keyCap, zzz } from "./uiHud";

export type UiSpriteName =
  // HUD & pickups (bottom-centre anchor)
  | "heartFull"
  | "heartHalf"
  | "heartEmpty"
  | "heartPickup"
  | "coin"
  | "coinBig"
  | "chestClosed"
  | "chestOpening"
  | "chestOpen"
  | "keyE"
  | "keySpace"
  | "skull"
  | "alert"
  | "question"
  | "zzz"
  | "star"
  | "arrowDown"
  | "checkmark"
  | "xpGem"
  // effects & particles (centre anchor)
  | "chestGlow"
  | "shadowSmall"
  | "shadowMedium"
  | "shadowLarge"
  | "sparkle"
  | "dust"
  | "slash"
  | "hitSpark"
  | "poof"
  | "ring"
  | "miasma"
  | "petal"
  | "leaf"
  | "snowflake"
  | "bubble"
  | "firefly"
  | "pollen"
  | "note"
  | "bit0"
  | "bit1"
  | "heartTiny";

/** Animation frames per sprite. */
export const UI_FRAMES: Record<UiSpriteName, number> = {
  heartFull: 1,
  heartHalf: 1,
  heartEmpty: 1,
  heartPickup: 2,
  coin: 4,
  coinBig: 1,
  chestClosed: 1,
  chestOpening: 1,
  chestOpen: 1,
  keyE: 1,
  keySpace: 1,
  skull: 1,
  alert: 1,
  question: 1,
  zzz: 1,
  star: 1,
  arrowDown: 2,
  checkmark: 1,
  xpGem: 2,
  chestGlow: 1,
  shadowSmall: 1,
  shadowMedium: 1,
  shadowLarge: 1,
  sparkle: 3,
  dust: 3,
  slash: 3,
  hitSpark: 2,
  poof: 4,
  ring: 3,
  miasma: 2,
  petal: 4,
  leaf: 4,
  snowflake: 2,
  bubble: 2,
  firefly: 2,
  pollen: 2,
  note: 1,
  bit0: 1,
  bit1: 1,
  heartTiny: 1,
};

/** Every sprite name, in a stable order (handy for galleries and tests). */
export const UI_SPRITE_NAMES = Object.keys(UI_FRAMES) as UiSpriteName[];

/** Paints one frame; returns the picture and whether it is centre-anchored. */
function paint(name: UiSpriteName, f: number): [Pix, "bottom" | "centre"] {
  switch (name) {
    case "heartFull":
      return [heart("full"), "bottom"];
    case "heartHalf":
      return [heart("half"), "bottom"];
    case "heartEmpty":
      return [heart("empty"), "bottom"];
    case "heartPickup":
      return [heart("pickup"), "bottom"];
    case "coin":
      return [coin(f), "bottom"];
    case "coinBig":
      return [coinBig(), "bottom"];
    case "chestClosed":
      return [chest("closed"), "bottom"];
    case "chestOpening":
      return [chest("opening"), "bottom"];
    case "chestOpen":
      return [chest("open"), "bottom"];
    case "keyE":
      return [keyCap("E"), "bottom"];
    case "keySpace":
      return [keyCap("Space"), "bottom"];
    case "zzz":
      return [zzz(), "bottom"];
    case "skull":
    case "alert":
    case "question":
    case "star":
    case "arrowDown":
    case "checkmark":
    case "xpGem":
      return [badge(name, f), "bottom"];
    case "chestGlow":
      return [radialGlow(30, 22, "#ffe680", 0.9), "centre"];
    case "shadowSmall":
      return [shadow(4, 1.5), "centre"];
    case "shadowMedium":
      return [shadow(6.5, 2), "centre"];
    case "shadowLarge":
      return [shadow(11, 3.5), "centre"];
    case "sparkle":
      return [sparkle(f), "centre"];
    case "dust":
      return [dust(f), "centre"];
    case "slash":
      return [slash(f), "centre"];
    case "hitSpark":
      return [hitSpark(f), "centre"];
    case "poof":
      return [poof(f), "centre"];
    case "ring":
      return [ring(f), "centre"];
    case "miasma":
      return [miasma(f), "centre"];
    case "petal":
    case "leaf":
    case "snowflake":
    case "bubble":
    case "firefly":
    case "pollen":
      return [ambient(name, f), "centre"];
    case "note":
    case "bit0":
    case "bit1":
      return [trailBit(name), "centre"];
    case "heartTiny":
      return [heart("tiny"), "centre"];
  }
}

const store = new Map<string, Sprite>();

/** A UI / effect sprite frame. Cached, so it is cheap to call every frame. */
export function uiSprite(name: UiSpriteName, frame = 0): Sprite {
  const f = mod(frame, UI_FRAMES[name] ?? 1);
  return cached(store, `${name}:${f}`, () => {
    const [p, anchor] = paint(name, f);
    // the bobbing arrow's second frame sits 1 px lower
    const bob = name === "arrowDown" && f === 1 ? -1 : 0;
    const bounce = name === "heartPickup" && f === 1 ? -1 : 0;
    return anchor === "bottom" ? p.toSprite(Math.floor(p.w / 2), p.h + bob + bounce) : p.toSprite(Math.floor(p.w / 2), Math.floor(p.h / 2));
  });
}

/** A 24×24 soft radial glow in a rarity's colour (draw it behind an item icon). Anchor: centre. */
export function rarityGlow(rarity: Rarity): Sprite {
  return cached(store, `glow:${rarity}`, () => radialGlow(24, 24, RARITY_INFO[rarity]?.color ?? "#ffffff", rarity === "legendary" ? 1.15 : 1).toSprite(12, 12));
}
