"use client";

/**
 * /dev/engine — runs the real engine on the built-in demo kingdom, without
 * the rest of the app, so the engine can be tested and screenshotted alone.
 *
 * Query parameters (all optional):
 *   ?theme=snow        start with a scenery theme
 *   ?warp=config.py    jump straight into that file's dungeon
 *   ?scale=3           integer zoom of the 400×225 canvas
 *
 * Pausing events (chest, dialog, menu...) are logged below the canvas and the
 * game resumes itself shortly after, so testing never gets stuck. A finisher
 * question is always answered with the right fix, to show the critical death.
 *
 * The page keeps its own throwaway save in memory, and like every /dev page
 * it only exists in development (see ../layout.tsx).
 *
 * `window.__lintlands` exposes the game and helpers for
 * scripted screenshots, e.g.
 *   __lintlands.teleport(...Object.values(__lintlands.nearest("well")))
 *   __lintlands.monsters()   // living monsters: kind, position, HP, telegraphing?
 */
import { useEffect, useRef, useState } from "react";
import { createAudio } from "@/game/audio";
import { INITIAL_HUD, repoKey, VIEW_H, VIEW_W, type GameEvent, type GameHandle, type HudState } from "@/game/bridge";
import { createEngine, type GameDebug } from "@/game";
import { analyzeDemo } from "@/lib/analysis/demo";
import { addCoins, createSaveStore, createStore, equipItem, grantItem, recordDefeat, setTheme } from "@/lib/game";
import { THEMES } from "@/lib/game/catalog";
import { generateDungeon, generateOverworld } from "@/lib/worldgen";
import type { SaveData, Store, ThemeId } from "@/lib/types";

/** Events after which the real UI would show an overlay (the engine paused itself). */
const PAUSING: ReadonlySet<GameEvent["type"]> = new Set(["chest", "gacha", "wardrobe", "board", "dialog", "workshop", "bugCard", "finisher", "menu", "victory"]);
const AUTO_RESUME_MS = 400;
const LOG_LENGTH = 10;

interface DevApi extends GameDebug {
  game: GameHandle;
  save: Store<SaveData>;
  hud: Store<HudState>;
  give(coins: number): void;
  /** Grants and equips an item (weapon, hat, pet, trail, charm). */
  equip(itemId: string): void;
  theme(theme: ThemeId): void;
  /** Marks every monster of a file as defeated (the dungeon then counts as cleared). */
  defeatAll(path: string): void;
}

declare global {
  interface Window {
    __lintlands?: DevApi;
  }
}

function describe(event: GameEvent): string {
  switch (event.type) {
    case "chest":
      return `chest (${event.source}) ${event.path}`;
    case "dialog":
      return `dialog ${event.speaker}: ${event.lines[0] ?? ""}`;
    case "toast":
      return `toast [${event.tone}] ${event.text}`;
    case "purified":
      return `purified ${event.path}`;
    case "finisher":
      return `finisher ${event.finding.code} (answered: right fix)`;
    case "workshop":
      return `workshop ${event.target.path ?? "(no file)"}${event.target.line ? `:${event.target.line}` : ""}`;
    default:
      return event.type;
  }
}

export default function EngineDevPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Analyzing the demo kingdom…");
  const [scale, setScale] = useState(3);
  const [log, setLog] = useState<string[]>([]);
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const params = new URLSearchParams(window.location.search);
    const abort = new AbortController();
    let game: GameHandle | null = null;
    let unsubscribeHud = () => {};

    // An in-memory save (null = no localStorage): experiments here never touch the player's real progress.
    const save = createSaveStore(null);
    const themeParam = params.get("theme");
    if (themeParam && THEMES.some((t) => t.id === themeParam)) save.set((s) => setTheme(s, themeParam as ThemeId));
    const hudStore = createStore<HudState>(INITIAL_HUD);
    const audio = createAudio();
    const unlock = () => audio.unlock();
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("pointerdown", unlock, { once: true });

    analyzeDemo((p) => setStatus(p.label), abort.signal)
      .then((analysis) => {
        if (abort.signal.aborted) return;
        const world = generateOverworld(analysis);
        const files = new Map(analysis.files.map((f) => [f.path, f]));
        const emit = (event: GameEvent) => {
          setLog((prev) => [describe(event), ...prev].slice(0, LOG_LENGTH));
          if (event.type === "finisher") game?.resolveFinisher(event.finding.id, true);
          if (PAUSING.has(event.type)) setTimeout(() => game?.resume(), AUTO_RESUME_MS);
        };
        const engine = createEngine({
          canvas,
          analysis,
          world,
          makeDungeon: (file) => generateDungeon(file, world.seed),
          save,
          hud: hudStore,
          audio,
          emit,
        });
        game = engine.handle;
        unsubscribeHud = hudStore.subscribe(() => setHud(hudStore.get()));
        window.__lintlands = {
          ...engine.debug,
          game: engine.handle,
          save,
          hud: hudStore,
          give: (coins) => save.set((s) => addCoins(s, coins)),
          equip: (id) => save.set((s) => equipItem(grantItem(s, id), id)),
          theme: (theme) => save.set((s) => setTheme(s, theme)),
          defeatAll: (path) => {
            const key = repoKey(analysis);
            for (const finding of files.get(path)?.findings ?? []) save.set((s) => recordDefeat(s, key, finding).save);
          },
        };
        setScale(Math.max(1, Math.min(6, Number(params.get("scale")) || 3)));
        setStatus("Running — WASD/arrows move, Space attack, Shift dash, E interact, M map, Esc menu.");
        game.start();
        const warp = params.get("warp");
        if (warp) game.warp(warp);
      })
      .catch((error: unknown) => {
        if (!abort.signal.aborted) setStatus(`Failed: ${error instanceof Error ? error.message : String(error)}`);
      });

    return () => {
      abort.abort();
      game?.destroy();
      unsubscribeHud();
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("pointerdown", unlock);
      delete window.__lintlands;
    };
  }, []);

  return (
    <main style={{ background: "#1d1a26", color: "#efe6ff", minHeight: "100vh", padding: 12, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
      <canvas ref={canvasRef} width={VIEW_W} height={VIEW_H} style={{ width: VIEW_W * scale, height: VIEW_H * scale, imageRendering: "pixelated", display: "block" }} />
      <p style={{ margin: "6px 0" }}>{status}</p>
      <p style={{ margin: "4px 0", color: "#ffd36b" }}>
        {hud.scene} · {hud.location} · hp {hud.hp}/{hud.maxHp} · combo {hud.combo} · dash {hud.dashReady.toFixed(2)}
        {hud.dungeon ? ` · bugs ${hud.dungeon.remaining}/${hud.dungeon.total}` : ""}
        {hud.boss ? ` · boss ${hud.boss.name} ${hud.boss.hp}/${hud.boss.maxHp}` : ""}
        {hud.prompt ? ` · [E] ${hud.prompt}` : ""}
      </p>
      <ol style={{ margin: 0, paddingLeft: 18, opacity: 0.8 }}>
        {log.map((line, i) => (
          <li key={`${i}-${line}`}>{line}</li>
        ))}
      </ol>
    </main>
  );
}
