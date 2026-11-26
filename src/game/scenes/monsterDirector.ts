/**
 * THE SEAM FOR MONSTERS.
 *
 * A dungeon scene does not know anything about monsters. It owns one
 * `MonsterDirector` and calls it every step; the director spawns the
 * monsters from `dungeon.monsters`, runs their AI, hurts the hero
 * (`ctx.game.player.hurt(...)`), registers them in `ctx.hittables` so the
 * hero's attacks hit them, and records defeats (`recordFindingDefeated` in
 * defeat.ts). The dungeon scene only asks how many are left (to know when
 * the dungeon is cleared), whether a boss bar should show, and how fast
 * time should run (a defeated boss goes down in slow motion).
 *
 * The implementation lives in `src/game/entities/monsters/` (director.ts).
 */
import type { HudState } from "../bridge";
import { Director } from "../entities/monsters/director";
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
  /** World-space things drawn above the darkness: name tags, "!" badges, the boss banner. */
  overlay(g: CanvasRenderingContext2D): void;
  /** Monsters not yet gone; 0 means the dungeon is cleared. */
  remaining(): number;
  /** Boss bar for the HUD, or null when no boss is fighting. */
  boss(): HudState["boss"];
  /** Game speed multiplier: 1 normally, lower while a boss goes down in slow motion. */
  timeScale(): number;
  /** The hero fainted and is about to respawn at the entrance (calm monsters down, reset bosses...). */
  onPlayerFainted(): void;
  /** The scene is going away. */
  destroy(): void;
}

export type MonsterDirectorFactory = (ctx: SceneContext, dungeon: Dungeon, file: AnalyzedFile) => MonsterDirector;

/** Called by the dungeon scene. */
export const createMonsterDirector: MonsterDirectorFactory = (ctx, dungeon, file) => new Director(ctx, dungeon, file);
