"use client";

/**
 * The in-game screen: the canvas engine, the HTML HUD over it, and the
 * overlay (chest, bag, pause, …) that is open, if any.
 *
 *   ┌ main (whole window, dark) ───────────────────────┐
 *   │   ┌ stage: exactly the scaled canvas size ─────┐ │
 *   │   │ <canvas>   (engine draws at VIEW_W×VIEW_H)  │ │
 *   │   │ <Hud>      (absolutely positioned on top)   │ │
 *   │   │ <OverlayHost>                               │ │
 *   │   └─────────────────────────────────────────────┘ │
 *   └───────────────────────────────────────────────────┘
 *
 * The engine pauses itself before emitting a "pausing" event; whenever the
 * UI opens an overlay on its own (HUD button, shortcut key) it pauses the
 * game first. Closing an overlay always resumes it.
 */
import { useEffect, useEffectEvent, useMemo, useRef, useState, type CSSProperties } from "react";
import { createGame } from "@/game";
import { INITIAL_HUD, VIEW_H, VIEW_W, repoKey as makeRepoKey, type GameEvent, type GameHandle, type HudState } from "@/game/bridge";
import { OverlayHost } from "@/components/overlays/OverlayHost";
import type { OverlayContext, OverlayRequest } from "@/components/overlays/types";
import { Hud } from "@/components/hud/Hud";
import { createFeed } from "@/components/hud/feed";
import { getProgress, repoHealth } from "@/lib/game";
import { useStore } from "@/lib/game/useStore";
import { generateDungeon } from "@/lib/worldgen";
import type { RepoAnalysis, SaveData, Store } from "@/lib/types";
import { useMusic } from "./audioHooks";
import type { LoadedWorld } from "./flow";
import { announceEvent, overlayForEvent } from "./gameEvents";
import type { AppServices } from "./services";
import { useGameScale } from "./useGameScale";
import { useMilestones } from "./useMilestones";

declare global {
  interface Window {
    /** Development only: handles for scripted screenshots and debugging in the console. */
    __app?: {
      save: Store<SaveData>;
      hud: Store<HudState>;
      game: GameHandle | null;
      open: (request: OverlayRequest) => void;
      /** The world being played, e.g. to look up finding ids in a script. */
      analysis: RepoAnalysis;
    };
  }
}

interface Props {
  loaded: LoadedWorld;
  services: AppServices;
  onExit: () => void;
}

/** Typing in a text box (e.g. the hero name in the wardrobe) must never trigger shortcuts. */
function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

/** I or B → bag, C → codex (Esc / Tab are handled by the engine, which emits "menu"). */
function shortcutRequest(key: string): OverlayRequest | null {
  const lower = key.toLowerCase();
  if (lower === "i" || lower === "b") return { kind: "bag" };
  if (lower === "c") return { kind: "codex" };
  return null;
}

export function GameScreen({ loaded, services, onExit }: Props) {
  const { analysis, world } = loaded;
  const { save, audio, hud } = services;
  const key = makeRepoKey(analysis);

  const screenRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameHandle | null>(null);
  const scale = useGameScale(screenRef);
  const [overlay, setOverlay] = useState<OverlayRequest | null>(null);
  const [feed] = useState(createFeed);

  const progress = useStore(save, (s) => getProgress(s, key));
  const health = useMemo(() => repoHealth(analysis, progress), [analysis, progress]);
  useMilestones(save, key, health, feed, audio);

  // ── Music follows the action ──
  const scene = useStore(hud, (h) => h.scene);
  const bossAlive = useStore(hud, (h) => h.boss !== null);
  const track = overlay?.kind === "victory" ? "victory" : bossAlive ? "boss" : scene === "dungeon" ? "dungeon" : "overworld";
  useMusic(audio, track);

  /** Opens an overlay from the UI side (HUD button / shortcut): pause the game first. */
  const openOverlay = (request: OverlayRequest) => {
    gameRef.current?.pause();
    audio.sfx("uiSelect");
    setOverlay(request);
  };

  const onGameEvent = useEffectEvent((event: GameEvent) => {
    const request = overlayForEvent(event);
    if (request) setOverlay(request);
    else announceEvent(event, feed, audio);
  });

  // ── Create the engine once per world; destroy it when leaving ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    hud.set(INITIAL_HUD); // no stale boss bar or prompt from a previous world
    const filesByPath = new Map(analysis.files.map((file) => [file.path, file]));
    const game = createGame({
      canvas,
      analysis,
      world,
      makeDungeon: (path) => {
        const file = filesByPath.get(path);
        if (!file) throw new Error(`Lintlands: no analysed file at ${path}`);
        return generateDungeon(file, world.seed);
      },
      save,
      hud,
      audio,
      emit: (event) => onGameEvent(event),
    });
    gameRef.current = game;
    game.start();
    // React's development mode mounts twice; destroying here makes the second mount start fresh.
    return () => {
      game.destroy();
      if (gameRef.current === game) gameRef.current = null;
    };
  }, [analysis, world, save, hud, audio]);

  // ── Keyboard shortcuts (only while no overlay is open) ──
  const onShortcutKey = useEffectEvent((event: KeyboardEvent) => {
    if (overlay || event.repeat || event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;
    const request = shortcutRequest(event.key);
    if (!request) return;
    event.preventDefault();
    openOverlay(request);
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => onShortcutKey(event);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── What overlays get to work with ──
  const overlayCtx = useMemo<OverlayContext>(
    () => ({
      analysis,
      repoKey: key,
      save,
      audio,
      open: (request) => setOverlay(request),
      close: () => {
        setOverlay(null);
        gameRef.current?.resume();
      },
      // Leaving unmounts this screen, and the engine effect's cleanup destroys the game.
      exitToTitle: onExit,
    }),
    [analysis, key, save, audio, onExit],
  );

  // ── Development handles for scripted screenshots ──
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    window.__app = {
      save,
      hud,
      get game() {
        return gameRef.current;
      },
      open: (request) => {
        gameRef.current?.pause();
        setOverlay(request);
      },
      analysis,
    };
    return () => {
      delete window.__app;
    };
  }, [save, hud, analysis]);

  const stageStyle = { width: VIEW_W * scale, height: VIEW_H * scale, "--s": scale } as CSSProperties;

  return (
    <main ref={screenRef} className="flex h-full w-full items-center justify-center overflow-hidden bg-[#0d0a18]">
      <div className="relative overflow-hidden" style={stageStyle}>
        <canvas ref={canvasRef} className="block" style={{ width: VIEW_W * scale, height: VIEW_H * scale }} />
        <Hud
          hud={hud}
          save={save}
          feed={feed}
          health={health}
          scale={scale}
          interactive={overlay === null}
          onOpen={openOverlay}
        />
        <OverlayHost request={overlay} ctx={overlayCtx} />
      </div>
    </main>
  );
}
