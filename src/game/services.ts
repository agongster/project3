/**
 * Game-wide services: the things that live as long as the game itself and
 * are shared by every scene (the save, audio, input, the hero...).
 *
 * `createEngine` (index.ts) builds one `GameServices` object and hands it to
 * each scene through its SceneContext (`ctx.game`).
 */
import type { AudioApi, GameEvent, GameOptions } from "./bridge";
import type { Input } from "./engine/input";
import type { HudWriter } from "./hud";
import type { Player } from "./entities/player";
import type { Pet } from "./entities/pet";
import type { Trail } from "./entities/trail";
import type { Combo } from "./combat/combo";
import type { PlayerStats } from "@/lib/game";
import type { RepoAnalysis, SaveData, Store, ThemeId } from "@/lib/types";

/** Things remembered for this browser session only (not saved). */
export interface SessionMemory {
  /** Overworld bush tiles already broken (index = y * width + x). */
  brokenBushes: Set<number>;
  /** True once the victory event fired (or the repo was already complete at start). */
  victoryShown: boolean;
}

export interface GameServices {
  readonly options: GameOptions;
  readonly save: Store<SaveData>;
  readonly audio: AudioApi;
  readonly hud: HudWriter;
  readonly input: Input;
  readonly analysis: RepoAnalysis;
  readonly repoKey: string;
  readonly player: Player;
  readonly pet: Pet;
  readonly trail: Trail;
  readonly combo: Combo;
  readonly session: SessionMemory;
  /** Player power folded from level + equipment (recomputed when the save changes). */
  stats(): PlayerStats;
  /** The current scenery theme (follows the save live). */
  theme(): ThemeId;
  /** Sends an event that does NOT pause the game (toasts, squashed...). */
  emit(event: GameEvent): void;
  /** Pauses the game, then sends the event (chest, dialog, menu...). The UI resumes us. */
  emitPausing(event: GameEvent): void;
  /** Iris into the dungeon of a file. */
  enterDungeon(path: string): void;
  /** Iris back to the overworld, in front of the dungeon's building. */
  leaveDungeon(): void;
  /** Fades the screen out, runs `onCovered` (e.g. a respawn), and fades back in. */
  fade(onCovered: () => void): void;
}
