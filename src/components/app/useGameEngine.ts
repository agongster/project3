/**
 * Creates the canvas engine once per world and destroys it when the game
 * screen goes away.
 *
 * The engine is NOT recreated when the code is edited: it starts from the
 * workspace's analysis as it is at that moment and then hears about every
 * new one through `game.updateAnalysis` (a subscription to the workspace's
 * live analysis store). Dungeons are built from whatever file the engine
 * hands over, so a dungeon entered after an edit shows the new findings.
 */
import { useEffect, useEffectEvent, useRef, type RefObject } from "react";
import { createEngine } from "@/game";
import type { GameDebug } from "@/game/debug";
import { INITIAL_HUD, type GameEvent, type GameHandle } from "@/game/bridge";
import { generateDungeon } from "@/lib/worldgen";
import type { LoadedWorld } from "./flow";
import type { AppServices } from "./services";

interface EngineOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  loaded: LoadedWorld;
  services: AppServices;
  onEvent: (event: GameEvent) => void;
}

export function useGameEngine({ canvasRef, loaded, services, onEvent }: EngineOptions) {
  const gameRef = useRef<GameHandle | null>(null);
  const debugRef = useRef<GameDebug | null>(null);
  const emit = useEffectEvent(onEvent);
  const { workspace, world } = loaded;
  const { save, hud, audio } = services;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    hud.set(INITIAL_HUD); // no stale boss bar or prompt from a previous world
    const { handle: game, debug } = createEngine({
      canvas,
      analysis: workspace.analysis.get(),
      world,
      makeDungeon: (file) => generateDungeon(file, world.seed),
      save,
      hud,
      audio,
      emit: (event) => emit(event),
    });
    gameRef.current = game;
    debugRef.current = debug;
    game.start();
    const unsubscribe = workspace.analysis.subscribe(() => game.updateAnalysis(workspace.analysis.get()));
    // React's development mode mounts twice; destroying here makes the second mount start fresh.
    return () => {
      unsubscribe();
      game.destroy();
      if (gameRef.current === game) {
        gameRef.current = null;
        debugRef.current = null;
      }
    };
  }, [canvasRef, workspace, world, save, hud, audio]);

  return { gameRef, debugRef };
}
