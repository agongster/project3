"use client";

/**
 * The title screen's living backdrop: the village from backdropScene.ts,
 * panning slowly sideways in the player's chosen theme, with drifting
 * ambient motes on top.
 *
 * It is drawn at a low internal resolution and scaled up by a whole number
 * (crisp pixels, cheap to draw), capped at 30 fps, and it stops completely
 * while the tab is hidden. It only exists while the title screen is shown.
 */
import { useEffect, useRef } from "react";
import { THEME_COLORS } from "@/game/art";
import { drawScenery, sceneryHeightPx } from "@/components/character/scenery";
import type { ThemeId } from "@/lib/types";
import { createMotes, drawMotes, stepMotes, type Mote } from "./ambient";
import { TITLE_SCENE } from "./backdropScene";

/** 30 fps is plenty for a slow pan and halves the work of 60 fps. */
const FRAME_MS = 1000 / 30;
/** Pan speed in scene pixels per second (the 48-tile village loops every ~2 minutes). */
const PAN_PX_PER_SEC = 6;
/** Never let a long pause (tab switch) teleport the motes. */
const MAX_STEP_SEC = 0.1;

/** The pixel zoom that makes the village's height fill the window (at least 2×). */
function pickScale(cssHeight: number): number {
  return Math.max(2, Math.ceil(cssHeight / sceneryHeightPx(TITLE_SCENE)));
}

/**
 * Sizes the canvas to cover its parent at an integer zoom.
 * Returns the internal size, and whether it changed since the last frame.
 */
function fitCanvas(canvas: HTMLCanvasElement): { w: number; h: number; changed: boolean } {
  const parent = canvas.parentElement;
  const cssW = parent?.clientWidth ?? window.innerWidth;
  const cssH = parent?.clientHeight ?? window.innerHeight;
  const scale = pickScale(cssH);
  const w = Math.ceil(cssW / scale);
  const h = Math.ceil(cssH / scale);
  const changed = canvas.width !== w || canvas.height !== h;
  if (changed) {
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${w * scale}px`;
    canvas.style.height = `${h * scale}px`;
  }
  return { w, h, changed };
}

export function TitleBackdrop({ theme }: { theme: ThemeId }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let motes: Mote[] = [];
    let raf = 0;
    let lastFrame = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - lastFrame < FRAME_MS) return;
      const dt = Math.min(MAX_STEP_SEC, (now - lastFrame) / 1000);
      lastFrame = now;

      const { w, h, changed } = fitCanvas(canvas);
      if (changed || motes.length === 0) motes = createMotes(theme, w, h);

      ctx.fillStyle = THEME_COLORS[theme].backdrop;
      ctx.fillRect(0, 0, w, h);
      // Centre the village vertically; `now` keeps the pan continuous when the theme changes.
      const panX = reducedMotion ? 0 : (now / 1000) * PAN_PX_PER_SEC;
      const panY = Math.round((sceneryHeightPx(TITLE_SCENE) - h) / 2);
      drawScenery(ctx, theme, TITLE_SCENE, { x: Math.floor(panX), y: panY, w, h, timeMs: now });

      if (!reducedMotion) stepMotes(motes, dt, w, h);
      drawMotes(ctx, motes, theme, now / 1000);
    };

    const onVisibilityChange = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [theme]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-night" aria-hidden>
      <canvas ref={ref} className="absolute left-0 top-0" />
      {/* A soft dark vignette so the menu panels stand out from the bright village. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(27_22_48/0.15)_30%,rgb(27_22_48/0.6)_100%)]" />
    </div>
  );
}
