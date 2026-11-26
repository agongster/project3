"use client";

/**
 * The in-game screen: the canvas engine, the HTML HUD over it, the overlay
 * (chest, bag, pause, …) that is open, if any, and the Workshop (the code
 * editor) when the player opens it.
 *
 *   ┌ main (whole window, dark) ───────────────────────┐
 *   │   ┌ stage: exactly the scaled canvas size ─────┐ │
 *   │   │ <canvas>   (engine draws at VIEW_W×VIEW_H)  │ │
 *   │   │ <Hud>      (absolutely positioned on top)   │ │
 *   │   │ <OverlayHost>                               │ │
 *   │   └─────────────────────────────────────────────┘ │
 *   │ <WorkshopLayer>  (the whole window, when open)    │
 *   └───────────────────────────────────────────────────┘
 *
 * The engine pauses itself before emitting a "pausing" event; whenever the
 * UI opens an overlay or the Workshop on its own (HUD button, shortcut key)
 * it pauses the game first. Closing an overlay or the Workshop resumes it.
 *
 * The world follows the code: the screen reads the workspace's LIVE
 * analysis (HUD health, overlays), and the engine hears about every new one
 * (useGameEngine). Forges are applied in one place (useWorkshop → forgeFlow).
 */
import { useEffect, useEffectEvent, useMemo, useRef, useState, type CSSProperties } from "react";
import type { GameDebug } from "@/game/debug";
import { VIEW_H, VIEW_W, repoKey as makeRepoKey, type GameEvent, type GameHandle, type HudState, type WorkshopTarget } from "@/game/bridge";
import { OverlayHost } from "@/components/overlays/OverlayHost";
import type { OverlayContext, OverlayRequest } from "@/components/overlays/types";
import { Hud } from "@/components/hud/Hud";
import { createFeed } from "@/components/hud/feed";
import { createStore, getProgress, repoHealth, type QuestNewsItem } from "@/lib/game";
import { useStore } from "@/lib/game/useStore";
import type { RepoAnalysis, SaveData, Store } from "@/lib/types";
import type { Workspace } from "@/lib/workspace";
import { useMusic } from "./audioHooks";
import type { LoadedWorld } from "./flow";
import { announceEvent, overlayForEvent, workshopForEvent } from "./gameEvents";
import type { AppServices } from "./services";
import { useBountyPayouts, createBountyBoard } from "./useBountyPayouts";
import { useGameEngine } from "./useGameEngine";
import { useGameScale } from "./useGameScale";
import { useMilestones } from "./useMilestones";
import { useQuestSettling } from "./useQuestSettling";
import { useWorkshop } from "./useWorkshop";
import { WorkshopDoor } from "./WorkshopDoor";
import { WorkshopLayer } from "./WorkshopLayer";

declare global {
  interface Window {
    /** Development only: handles for scripted screenshots and debugging in the console. */
    __app?: {
      save: Store<SaveData>;
      hud: Store<HudState>;
      game: GameHandle | null;
      /** Teleport, monster positions and other play-test helpers (see src/game/debug.ts). */
      debug: GameDebug | null;
      open: (request: OverlayRequest) => void;
      /** The world being played as the code is NOW, e.g. to look up finding ids in a script. */
      analysis: RepoAnalysis;
      /** The repo's files and the player's edits (forge, revert, changes…). */
      workspace: Workspace;
      /** Opens the Workshop (at the hero's code when no target is given). */
      openWorkshop: (target?: WorkshopTarget) => void;
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

/** The key that opens the Workshop (free in the engine's bindings, see src/game/engine/input.ts). */
export const WORKSHOP_KEY = "F";

/** What a shortcut key opens: I or B → bag, C → codex, F → the Workshop (Esc / Tab are the engine's "menu"). */
export function shortcutFor(key: string): OverlayRequest | "workshop" | null {
  const lower = key.toLowerCase();
  if (lower === "i" || lower === "b") return { kind: "bag" };
  if (lower === "c") return { kind: "codex" };
  if (lower === WORKSHOP_KEY.toLowerCase()) return "workshop";
  return null;
}

export function GameScreen({ loaded, services, onExit }: Props) {
  const { workspace } = loaded;
  const { save, audio, hud } = services;
  const key = makeRepoKey(loaded.analysis);
  const analysis = useStore(workspace.analysis, (a) => a);

  const screenRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scale = useGameScale(screenRef);
  const [overlay, setOverlay] = useState<OverlayRequest | null>(null);
  const [feed] = useState(createFeed);
  const [bountyBoard] = useState(() => createBountyBoard(loaded.analysis, new Set(workspace.changes().map((change) => change.path))));
  const [newsStore] = useState(() => createStore<readonly QuestNewsItem[]>([]));
  const bounties = useStore(bountyBoard, (list) => list);

  const progress = useStore(save, (s) => getProgress(s, key));
  const health = useMemo(() => repoHealth(analysis, progress), [analysis, progress]);
  useMilestones(save, key, health, feed, audio);
  useBountyPayouts(save, key, bountyBoard, feed, audio);
  useQuestSettling(save, key, analysis, feed, audio);

  const { gameRef, debugRef } = useGameEngine({ canvasRef, loaded, services, onEvent: handleGameEvent });
  const workshop = useWorkshop({ gameRef, workspace, services, repoKey: key, feed, bounties: bountyBoard, news: newsStore });

  // ── Music follows the action (and calms down in the Workshop) ──
  const scene = useStore(hud, (h) => h.scene);
  const bossAlive = useStore(hud, (h) => h.boss !== null);
  const inWorkshop = workshop.visit !== null && workshop.visit.phase !== "leaving";
  const track = inWorkshop ? "title" : overlay?.kind === "victory" ? "victory" : bossAlive ? "boss" : scene === "dungeon" ? "dungeon" : "overworld";
  useMusic(audio, track);

  /** Opens an overlay from the UI side (HUD button / shortcut): pause the game first. */
  const openOverlay = (request: OverlayRequest) => {
    gameRef.current?.pause();
    audio.sfx("uiSelect");
    setOverlay(request);
  };

  /** Opens the Workshop at `target`, or at the code where the hero is. Any open overlay gives way. */
  const openWorkshop = (target?: WorkshopTarget) => {
    const where = target ?? gameRef.current?.workshopTarget() ?? { path: null };
    setOverlay(null);
    workshop.open(where);
  };

  /** Every engine event: the Workshop, an overlay, or a toast (useGameEngine always calls the latest one). */
  function handleGameEvent(event: GameEvent) {
    const workshopTarget = workshopForEvent(event);
    if (workshopTarget) return openWorkshop(workshopTarget);
    const request = overlayForEvent(event);
    if (request) setOverlay(request);
    else announceEvent(event, feed, audio);
  }

  // ── Keyboard shortcuts (only while nothing covers the game) ──
  const onShortcutKey = useEffectEvent((event: KeyboardEvent) => {
    if (overlay || workshop.visit || event.repeat || event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;
    const shortcut = shortcutFor(event.key);
    if (!shortcut) return;
    event.preventDefault();
    if (shortcut === "workshop") openWorkshop();
    else openOverlay(shortcut);
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => onShortcutKey(event);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── What overlays get to work with ──
  const overlayCtx: OverlayContext = {
    analysis,
    repoKey: key,
    save,
    audio,
    bounties,
    open: (request) => setOverlay(request),
    close: () => {
      setOverlay(null);
      gameRef.current?.resume();
    },
    resolveFinisher: (findingId, correct) => gameRef.current?.resolveFinisher(findingId, correct),
    spareFinisher: (findingId) => gameRef.current?.spareFinisher(findingId),
    openWorkshop,
    // Leaving unmounts this screen, and the engine effect's cleanup destroys the game.
    exitToTitle: onExit,
  };

  // ── Development handles for scripted screenshots ──
  const openFromScript = useEffectEvent((target?: WorkshopTarget) => openWorkshop(target));
  const overlayFromScript = useEffectEvent((request: OverlayRequest) => {
    gameRef.current?.pause();
    setOverlay(request);
  });
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    window.__app = {
      save,
      hud,
      get game() {
        return gameRef.current;
      },
      get debug() {
        return debugRef.current;
      },
      open: (request) => overlayFromScript(request),
      get analysis() {
        return workspace.analysis.get();
      },
      workspace,
      openWorkshop: (target) => openFromScript(target),
    };
    return () => {
      delete window.__app;
    };
  }, [save, hud, workspace, gameRef, debugRef]);

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
          interactive={overlay === null && workshop.visit === null}
          onOpen={openOverlay}
          onWorkshop={() => openWorkshop()}
        />
        <OverlayHost request={overlay} ctx={overlayCtx} />
      </div>
      {workshop.target && (
        <WorkshopLayer
          workspace={workspace}
          save={save}
          repoKey={key}
          audio={audio}
          target={workshop.target}
          news={newsStore}
          onForged={workshop.onForged}
          onClose={workshop.close}
        />
      )}
      {workshop.visit?.phase === "entering" && <WorkshopDoor way="in" onDone={workshop.entered} />}
      {workshop.visit?.phase === "leaving" && <WorkshopDoor way="out" onDone={workshop.left} />}
    </main>
  );
}
