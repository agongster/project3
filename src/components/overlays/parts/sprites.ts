/**
 * The overlays' single doorway into the art module.
 *
 * Every sprite an overlay shows is fetched through one of these functions.
 * They return null on the server (sprites are painted on <canvas>, which
 * only exists in the browser), so components can call them during render
 * without crashing server rendering. The art module caches every sprite, so
 * calling these on every render is cheap.
 */
import { WALK_CYCLE, getAtlas, renderCharacter, spriteToDataUrl } from "@/game/art";
import type { Facing, Sprite } from "@/game/art";
import { itemIcon } from "@/game/art/items";
import { MONSTER_FRAMES, monsterSprite } from "@/game/art/monsters";
import { PET_FRAMES, petSprite } from "@/game/art/pets";
import { uiSprite } from "@/game/art/ui";
import type { UiSpriteName } from "@/game/art/ui";
import type { CharacterLook, MonsterKind, ThemeId } from "@/lib/types";

export type { Facing, Sprite };

/** True in the browser, where sprites can be painted. */
function canPaint(): boolean {
  return typeof document !== "undefined";
}

/** A sprite's PNG data URL (cached by the art module), or "" on the server. */
export function spriteUrl(sprite: Sprite): string {
  return canPaint() ? spriteToDataUrl(sprite) : "";
}

// ───────────────────────────── Hero ─────────────────────────────

/** One frame of the hero. `walkStep` counts up forever; it is wrapped onto the walk cycle. */
export function heroSprite(look: CharacterLook, hatId: string | null, facing: Facing, walkStep: number): Sprite | null {
  if (!canPaint()) return null;
  const step = WALK_CYCLE[walkStep % WALK_CYCLE.length];
  return renderCharacter(look, hatId).frame(facing, step);
}

// ───────────────────────────── Monsters ─────────────────────────────

/** One frame of a monster (facing right). `frame` counts up forever; it wraps onto the monster's own frames. */
export function monsterFrame(kind: MonsterKind, frame = 0): Sprite | null {
  return canPaint() ? monsterSprite(kind, frame % MONSTER_FRAMES[kind]) : null;
}

// ───────────────────────────── UI icons ─────────────────────────────

/** A small UI sprite (coin, star, sparkle, chest, checkmark …). */
export function uiIcon(name: UiSpriteName, frame = 0): Sprite | null {
  return canPaint() ? uiSprite(name, frame) : null;
}

// ───────────────────────────── Items & pets ─────────────────────────────

/** An item's 16×16 icon. */
export function itemSprite(id: string): Sprite | null {
  return canPaint() ? itemIcon(id) : null;
}

/** One frame of a pet (facing right). `frame` counts up forever; it wraps onto the pet's frames. */
export function petFrame(id: string, frame: number): Sprite | null {
  return canPaint() ? petSprite(id, frame % PET_FRAMES) : null;
}

// ───────────────────────────── Props ─────────────────────────────

/** The Wishing Well, drawn in the player's scenery theme. `frame` animates the water. */
export function wellSprite(theme: ThemeId, frame: number): Sprite | null {
  return canPaint() ? getAtlas(theme).prop("well", 0, frame) : null;
}
