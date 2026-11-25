/**
 * Public entry point of the canvas game engine: `createGame(options)`.
 *
 * It wires everything together:
 *   - the game-wide services (save, audio, input, HUD, the hero, pet, trail)
 *   - the scenes: one overworld for the whole game, plus a dungeon scene
 *     while the hero is inside a cursed file
 *   - the loop (fixed 60 Hz updates, one render per frame) and the
 *     transitions between scenes
 *   - the GameHandle the React UI uses (start / pause / resume / destroy / warp)
 *
 * The engine follows the save store live: a new look, hat, pet, trail,
 * weapon or scenery theme shows up immediately, even while paused.
 */
import { renderCharacter } from "@/game/art";
import { playerStats, type PlayerStats } from "@/lib/game";
import { repoKey as makeRepoKey, VIEW_H, VIEW_W, type GameEvent, type GameHandle, type GameOptions } from "./bridge";
import { Combo } from "./combat/combo";
import { createLoop } from "./engine/loop";
import { createInput } from "./engine/input";
import { Transition } from "./engine/transition";
import { Pet } from "./entities/pet";
import { Player } from "./entities/player";
import { Trail } from "./entities/trail";
import { HudWriter } from "./hud";
import { createDebug, type GameDebug } from "./debug";
import { DungeonScene } from "./scenes/dungeon";
import { OverworldScene } from "./scenes/overworld";
import { allDungeonsCleared } from "./scenes/progressView";
import type { Scene } from "./scenes/scene";
import type { GameServices } from "./services";
import type { SaveData } from "@/lib/types";

export type { GameDebug } from "./debug";

/** Only equipped items the player owns count (a hand-edited save can't sneak a pet in). */
const ownedOrNull = (save: SaveData, id: string | null) => (id && save.owned.includes(id) ? id : null);

export function createGame(options: GameOptions): GameHandle {
  return createEngine(options).handle;
}

/** createGame plus debug helpers (used by the /dev/engine page and screenshot scripts). */
export function createEngine(options: GameOptions): { handle: GameHandle; debug: GameDebug } {
  const { canvas, save, audio } = options;
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  const g = canvas.getContext("2d")!;
  g.imageSmoothingEnabled = false;

  const input = createInput(canvas);
  const transition = new Transition();
  let stats: PlayerStats = playerStats(save.get());
  const player = new Player(renderCharacter(save.get().look, save.get().equipped.hat));
  player.hp = player.maxHp = stats.maxHp;
  const pet = new Pet();
  const trail = new Trail();
  const repoKey = makeRepoKey(options.analysis);

  let dungeon: DungeonScene | null = null;
  let paused = false;

  /** The hero's position on screen (the iris closes on it). */
  const heroOnScreen = () => scene.ctx.camera.toScreen(player.x, player.y - 10);

  function switchScene(next: Scene, arrive: () => void): void {
    if (dungeon && next !== dungeon) {
      dungeon.destroy();
      dungeon = null;
    }
    scene = next;
    arrive();
    scene.enter();
    const p = heroOnScreen();
    transition.setCenter(p.x, p.y);
  }

  const services: GameServices = {
    options,
    save,
    audio,
    hud: new HudWriter(options.hud),
    input,
    analysis: options.analysis,
    repoKey,
    player,
    pet,
    trail,
    combo: new Combo(),
    session: { brokenBushes: new Set(), victoryShown: allDungeonsCleared(save.get(), repoKey, options.analysis) },
    stats: () => stats,
    theme: () => save.get().theme,
    emit: (event: GameEvent) => options.emit(event),
    emitPausing(event: GameEvent) {
      handle.pause();
      options.emit(event);
    },
    enterDungeon(path: string) {
      if (transition.active) return;
      const from = heroOnScreen();
      audio.sfx("door");
      transition.start("iris", from.x, from.y, () => {
        try {
          const next = new DungeonScene(services, path);
          switchScene(next, () => {});
          dungeon = next;
        } catch (error) {
          console.error("Lintlands: could not build the dungeon", error);
          options.emit({ type: "toast", text: "This door is stuck… try another one!", tone: "warn" });
        }
      });
    },
    leaveDungeon() {
      if (transition.active || !dungeon) return;
      const from = heroOnScreen();
      const path = dungeon.path;
      audio.sfx("door");
      transition.start("iris", from.x, from.y, () => switchScene(overworld, () => overworld.arriveFrom(path)));
    },
    fade(onCovered: () => void) {
      const from = heroOnScreen();
      transition.start("fade", from.x, from.y, onCovered, 0.6);
    },
  };

  /** Follows the save: stats, look, pet, trail, theme and volumes. */
  let lastTheme = save.get().theme;
  function applySave(): void {
    const s = save.get();
    stats = playerStats(s);
    player.setLook(renderCharacter(s.look, ownedOrNull(s, s.equipped.hat)));
    pet.setPet(ownedOrNull(s, s.equipped.pet));
    trail.setTrail(ownedOrNull(s, s.equipped.trail));
    audio.setVolumes(s.settings.sfx, s.settings.music);
    if (s.theme !== lastTheme) {
      lastTheme = s.theme;
      audio.setTheme(s.theme);
    }
  }
  applySave();
  const unsubscribeSave = save.subscribe(applySave);

  const overworld = new OverworldScene(services);
  let scene: Scene = overworld;
  overworld.arriveFrom(null);
  overworld.enter();

  function update(dt: number): void {
    transition.update(dt);
    // Behind a closing curtain the world holds still; it wakes up as the iris opens.
    if (!transition.covering) scene.update(dt);
    input.endStep();
  }

  function render(): void {
    // Re-applied every frame: some browsers reset it when the canvas is touched from outside.
    g.imageSmoothingEnabled = false;
    scene.render(g);
    transition.draw(g, VIEW_W, VIEW_H);
  }

  const loop = createLoop(update, render);

  const handle: GameHandle = {
    start() {
      audio.setTheme(save.get().theme);
      loop.start();
    },
    pause() {
      if (paused) return;
      paused = true;
      loop.setPaused(true);
      input.setEnabled(false);
    },
    resume() {
      if (!paused) return;
      paused = false;
      loop.setPaused(false);
      input.setEnabled(true);
      scene.onResume();
    },
    destroy() {
      loop.stop();
      input.destroy();
      unsubscribeSave();
      dungeon?.destroy();
      overworld.destroy();
    },
    warp(path: string | null) {
      if (path === null) {
        services.leaveDungeon();
        return;
      }
      // Only files with findings have a dungeon.
      const file = options.analysis.files.find((f) => f.path === path);
      if (scene === overworld && file && file.findings.length > 0) services.enterDungeon(path);
      else options.emit({ type: "toast", text: `No dungeon to warp to for "${path}".`, tone: "warn" });
    },
  };

  const debug = createDebug(services, () => scene);
  return { handle, debug };
}
