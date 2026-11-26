"use client";

/**
 * Overlay test page (/dev/overlays): opens any reward / information overlay
 * on a stand-in for the game, with the demo kingdom and a mid-game save that
 * lives only in memory (your real save is untouched).
 *
 * Like the real game screen, overlays live inside a "stage" exactly the size
 * of the scaled canvas (VIEW_W × VIEW_H × a whole-number scale), so what you
 * see here is the room an overlay really gets (800 × 450 at scale 2).
 *
 *   /dev/overlays?open=chest-s        open one overlay straight away
 *   /dev/overlays?open=gacha&seed=7   …with Math.random replaced by a seeded
 *                                     generator, so a reveal is repeatable
 *   /dev/overlays?scale=3             force the stage scale (default: biggest that fits)
 *
 * Shortcut names are listed in `demoRequests` (demoData.ts). For scripts,
 * `window.__openOverlay(name)` does the same and `window.__save()` returns
 * the current save.
 */
import { useEffect, useState } from "react";
import { OverlayHost } from "@/components/overlays/OverlayHost";
import type { OverlayContext, OverlayRequest } from "@/components/overlays/types";
import { createAudio } from "@/game/audio";
import type { AudioApi } from "@/game/bridge";
import { VIEW_H, VIEW_W, repoKey } from "@/game/bridge";
import { analyzeDemo } from "@/lib/analysis/demo";
import { createStore } from "@/lib/game";
import { chooseBounties } from "@/lib/game/bounties";
import { mulberry32 } from "@/lib/rng";
import type { RepoAnalysis, SaveData, Store } from "@/lib/types";
import { allClearedSave, demoRequests, demoSave, withGradeCFile, withManyFindings } from "./demoData";

declare global {
  interface Window {
    __openOverlay?: (name: string) => void;
    __save?: () => SaveData;
  }
}

/** Coins for `gacha-broke`: not enough for a single wish. */
const BROKE_COINS = 12;

/** Room kept for the shortcut buttons above the stage. */
const NAV_HEIGHT = 80;

/** The biggest whole-number scale at which the game fits under the buttons (same rule as the game screen). */
function fittingScale(): number {
  return Math.max(1, Math.floor(Math.min(window.innerWidth / VIEW_W, (window.innerHeight - NAV_HEIGHT) / VIEW_H)));
}

// One audio engine for the page, created on first use (never during server rendering).
let audioEngine: AudioApi | null = null;
function getAudio(): AudioApi {
  if (!audioEngine) audioEngine = createAudio();
  return audioEngine;
}
/** Forwards to the real engine, creating it lazily, so `ctx.audio` can exist before the browser is ready. */
const lazyAudio: AudioApi = {
  unlock: () => getAudio().unlock(),
  sfx: (name, opts) => getAudio().sfx(name, opts),
  music: (track) => getAudio().music(track),
  setTheme: (theme) => getAudio().setTheme(theme),
  setVolumes: (sfx, music) => getAudio().setVolumes(sfx, music),
};

interface Demo {
  analysis: RepoAnalysis;
  /** The same analysis with one clean file downgraded to C (for `chest-c`). */
  gradeC: RepoAnalysis;
  /** ≈ 550 findings (for `codex-big`). */
  big: RepoAnalysis;
  key: string;
  store: Store<SaveData>;
  requests: Record<string, OverlayRequest>;
  /** Stage zoom, like the game canvas's. */
  scale: number;
}

interface ActiveOverlay {
  /** The shortcut name (decides e.g. which analysis variant the overlay sees). */
  name: string;
  request: OverlayRequest;
}

/** Looks up a shortcut and prepares the save it needs (victory = everything defeated, gacha-broke = almost no coins). */
function prepareOverlay(demo: Demo, name: string): ActiveOverlay | null {
  const request = demo.requests[name];
  if (!request) return null;
  if (name === "victory") demo.store.set((save) => allClearedSave(save, demo.analysis, demo.key));
  if (name === "gacha-broke") demo.store.set((save) => ({ ...save, coins: BROKE_COINS }));
  return { name, request };
}

export default function OverlayDevPage() {
  const [demo, setDemo] = useState<Demo | null>(null);
  const [active, setActive] = useState<ActiveOverlay | null>(null);
  const [lastExit, setLastExit] = useState<string | null>(null);

  function openByName(current: Demo, name: string) {
    const next = prepareOverlay(current, name);
    if (next) setActive(next);
  }

  // Build the demo kingdom once, then honour ?open= and ?seed=.
  useEffect(() => {
    let alive = true;
    analyzeDemo(() => undefined).then((analysis) => {
      if (!alive) return;
      const key = repoKey(analysis);
      const params = new URLSearchParams(window.location.search);
      const loaded: Demo = {
        analysis,
        gradeC: withGradeCFile(analysis),
        big: withManyFindings(analysis),
        key,
        store: createStore(demoSave(analysis, key)),
        requests: demoRequests(analysis),
        scale: Number(params.get("scale")) || fittingScale(),
      };
      setDemo(loaded);
      const seed = params.get("seed");
      if (seed !== null) Math.random = mulberry32(Number(seed));
      const open = params.get("open");
      const first = open ? prepareOverlay(loaded, open) : null;
      if (first) setActive(first);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Browsers only allow sound after a click or key press.
  useEffect(() => {
    const unlock = () => lazyAudio.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    if (!demo) return;
    window.__openOverlay = (name) => openByName(demo, name);
    window.__save = () => demo.store.get();
  });

  if (!demo) {
    return <main className="flex h-screen items-center justify-center bg-night text-cream">Building the demo kingdom…</main>;
  }

  const ctx: OverlayContext = {
    analysis: active?.name === "chest-c" ? demo.gradeC : active?.name === "codex-big" ? demo.big : demo.analysis,
    repoKey: demo.key,
    save: demo.store,
    audio: lazyAudio,
    open: (request) => setActive({ name: request.kind, request }),
    close: () => setActive(null),
    resolveFinisher: (_findingId, correct) => setLastExit(`resolveFinisher(${correct}) was called`),
    spareFinisher: () => setLastExit("spareFinisher() was called"),
    openWorkshop: (target) => setLastExit(`openWorkshop(${target?.path ?? "here"}:${target?.line ?? ""}) was called`),
    bounties: chooseBounties(demo.analysis),
    exitToTitle: () => {
      setActive(null);
      setLastExit("exitToTitle() was called");
    },
  };

  return (
    <main className="flex h-screen w-screen flex-col items-center overflow-hidden bg-night text-cream">
      <nav className="flex w-full flex-wrap gap-1 p-1" style={{ minHeight: NAV_HEIGHT }}>
        {Object.keys(demo.requests).map((name) => (
          <button key={name} className="px-btn cream small" onClick={() => openByName(demo, name)}>
            {name}
          </button>
        ))}
        <button className="px-btn berry small" onClick={() => demo.store.set(demoSave(demo.analysis, demo.key))}>
          reset save
        </button>
        {lastExit && <p className="self-center text-sm text-gold">{lastExit}</p>}
      </nav>
      {/* The stage: same size and clipping as the real game screen's. */}
      <div className="relative shrink-0 overflow-hidden" style={{ width: VIEW_W * demo.scale, height: VIEW_H * demo.scale }}>
        <FakeGame />
        <OverlayHost request={active?.request ?? null} ctx={ctx} />
      </div>
    </main>
  );
}

/** A green checkerboard where the game canvas would be, so overlays are judged against something game-like. */
function FakeGame() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0"
      style={{
        backgroundColor: "#3b5c34",
        backgroundImage:
          "linear-gradient(45deg, #34532e 25%, transparent 25%, transparent 75%, #34532e 75%), linear-gradient(45deg, #34532e 25%, transparent 25%, transparent 75%, #34532e 75%)",
        backgroundSize: "32px 32px",
        backgroundPosition: "0 0, 16px 16px",
      }}
    />
  );
}
