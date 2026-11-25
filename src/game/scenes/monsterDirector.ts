/**
 * THE SEAM FOR MONSTERS.
 *
 * A dungeon scene does not know anything about monsters. It owns one
 * `MonsterDirector` and calls it every step; the director spawns the
 * monsters from `dungeon.monsters`, runs their AI, hurts the hero
 * (`ctx.game.player.hurt(...)`), registers them in `ctx.hittables` so the
 * hero's attacks hit them, and records defeats (`recordFindingDefeated` in
 * defeat.ts). The dungeon scene only asks how many are left (to know when
 * the dungeon is cleared) and whether a boss bar should show.
 *
 * Today `createMonsterDirector` returns a no-op director so dungeons are
 * walkable without monsters. The monster module replaces the body of
 * `createMonsterDirector` with its own implementation.
 */
import type { HudState } from "../bridge";
import { getProgress, remainingFindings } from "@/lib/game";
import type { AnalyzedFile, Dungeon } from "@/lib/types";
import type { SceneContext } from "./context";
import type { Drawable, Light } from "./scene";

export interface MonsterDirector {
  /** One simulation step: AI, contact damage, deaths... */
  update(dt: number): void;
  /** Adds the monsters (and their telegraphs) to the y-sorted draw list. */
  drawables(out: Drawable[]): void;
  /** Lights monsters give off in the dark (glowing eyes, boss auras). */
  lights(out: Light[]): void;
  /** Monsters still alive; 0 means the dungeon is cleared. */
  remaining(): number;
  /** Boss bar for the HUD, or null when no boss is fighting. */
  boss(): HudState["boss"];
  /** The hero fainted and is about to respawn at the entrance (calm monsters down, reset bosses...). */
  onPlayerFainted(): void;
  /** The scene is going away. */
  destroy(): void;
}

export type MonsterDirectorFactory = (ctx: SceneContext, dungeon: Dungeon, file: AnalyzedFile) => MonsterDirector;

/** Placeholder director: no monsters; "remaining" is whatever the save says is still undefeated. */
export function createEmptyDirector(ctx: SceneContext, _dungeon: Dungeon, file: AnalyzedFile): MonsterDirector {
  return {
    update: () => {},
    drawables: () => {},
    lights: () => {},
    remaining: () => remainingFindings(file, getProgress(ctx.save.get(), ctx.repoKey)).length,
    boss: () => null,
    onPlayerFainted: () => {},
    destroy: () => {},
  };
}

/** Called by the dungeon scene. The monster module swaps in its own factory here. */
export const createMonsterDirector: MonsterDirectorFactory = createEmptyDirector;
