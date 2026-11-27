/**
 * THE SEAM FOR MONSTERS.
 *
 * A dungeon scene does not know anything about monsters. It owns one
 * `MonsterDirector` and calls it every step; the director spawns the
 * monsters from `dungeon.monsters`, runs their AI, hurts the hero
 * (`ctx.game.player.hurt(...)`), registers them in `ctx.hittables` so the
 * hero's attacks hit them, and records defeats (`recordFindingDefeated` in
 * defeat.ts). The dungeon scene only asks how many are left (to know when
 * the dungeon is cleared), whether a boss bar should show, how fast time
 * should run (a defeated boss goes down in slow motion), and which dazed
 * monsters the hero may finish with a fix; it passes the finisher's answer
 * back.
 *
 * The implementation lives in `src/game/entities/monsters/` (director.ts).
 */
import type { HudState } from "../bridge";
import { Director } from "../entities/monsters/director";
import type { AnalyzedFile, Dungeon, Finding } from "@/lib/types";
import type { SceneContext } from "./context";
import type { Interactable } from "./interactions";
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
  /** Game speed multiplier: 1 normally, lower while a boss (or a critical fix) goes down in slow motion. */
  timeScale(): number;
  /** "Finish it with a fix!" spots, one per dazed monster (shown like doors and chests). */
  interactables(): Interactable[];
  /** The finisher overlay's answer for a dazed monster (see GameHandle.resolveFinisher). */
  resolveFinisher(findingId: string, correct: boolean): void;
  /** "Fix it for real" in the finisher: the dazed monster gets back up (see GameHandle.spareFinisher). */
  spareFinisher(findingId: string): void;
  /** Each monster still standing: its finding's id and line (to open the Workshop there), and where it is. */
  living(): { id: string; x: number; y: number; line: number }[];
  /**
   * The bugs with these finding ids were fixed in the code: their monsters
   * leave the fight and dissolve as "rewritten". Returns how many findings that was.
   */
  rewrite(fixedIds: ReadonlySet<string>): number;
  /**
   * The code was edited and some bugs moved to another line (old id → the
   * finding now): their monsters, which fight on, now stand for the finding
   * under its new id and line.
   */
  follow(renamed: ReadonlyMap<string, Finding>): void;
  /** Records at once every defeat still in flight (dazed or squashing), before the code's finding ids change. */
  settleNow(): void;
  /** Runs only the "rewritten" effects (while the dungeon holds still to re-form). */
  updateEffects(dt: number): void;
  /** True while a "rewritten" effect is still on screen. */
  rewriting(): boolean;
  /** The hero fainted and is about to respawn at the entrance (calm monsters down, reset bosses...). */
  onPlayerFainted(): void;
  /** The scene is going away. */
  destroy(): void;
}

export type MonsterDirectorFactory = (ctx: SceneContext, dungeon: Dungeon, file: AnalyzedFile) => MonsterDirector;

/** Called by the dungeon scene. */
export const createMonsterDirector: MonsterDirectorFactory = (ctx, dungeon, file) => new Director(ctx, dungeon, file);
