"use client";

/**
 * A stand-in for the game screen on /dev/ui: the same integer-scaled stage
 * as GameScreen, but the "game" is a still picture of the title village with
 * a fake minimap in the corner, so HUD and overlays can be judged in place.
 */
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { VIEW_H, VIEW_W } from "@/game/bridge";
import { drawScenery } from "@/components/character/scenery";
import { TITLE_SCENE } from "@/components/screens/title/backdropScene";
import { useGameScale } from "@/components/app/useGameScale";
import type { ThemeId } from "@/lib/types";

/** Where the engine puts its minimap (top-right, ~70×52 art px). */
const MINIMAP = { w: 70, h: 52, margin: 4 };
/** Which slice of the village to show behind the HUD. */
const BACKDROP_OFFSET = { x: 120, y: 60 };

function drawBackdrop(canvas: HTMLCanvasElement, theme: ThemeId, dark: boolean): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  drawScenery(ctx, theme, TITLE_SCENE, { ...BACKDROP_OFFSET, w: VIEW_W, h: VIEW_H, timeMs: 0 });
  if (dark) {
    // Roughly how a dungeon reads: very dark, so the HUD must stay readable on it too.
    ctx.fillStyle = "rgb(19 14 31 / 0.82)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  ctx.fillStyle = "rgb(27 22 48 / 0.7)";
  ctx.fillRect(VIEW_W - MINIMAP.w - MINIMAP.margin, MINIMAP.margin, MINIMAP.w, MINIMAP.h);
  ctx.fillStyle = "#fff4d9";
  ctx.font = "8px monospace";
  ctx.fillText("minimap", VIEW_W - MINIMAP.w + 10, MINIMAP.margin + 28);
}

interface Props {
  theme: ThemeId;
  dark?: boolean;
  /** Pixels kept free under the stage for dev controls. */
  reserveBottom?: number;
  /** Gets the stage's integer zoom, which the HUD needs as a number. */
  children: (scale: number) => ReactNode;
}

export function DevStage({ theme, dark = false, reserveBottom = 0, children }: Props) {
  const areaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scale = useGameScale(areaRef);

  useEffect(() => {
    if (canvasRef.current) drawBackdrop(canvasRef.current, theme, dark);
  }, [theme, dark]);

  const stageStyle = { width: VIEW_W * scale, height: VIEW_H * scale, "--s": scale } as CSSProperties;

  return (
    <div ref={areaRef} className="flex w-full items-center justify-center overflow-hidden bg-[#0d0a18]" style={{ height: `calc(100% - ${reserveBottom}px)` }}>
      <div className="relative overflow-hidden" style={stageStyle}>
        <canvas ref={canvasRef} width={VIEW_W} height={VIEW_H} className="block" style={{ width: VIEW_W * scale, height: VIEW_H * scale }} />
        {children(scale)}
      </div>
    </div>
  );
}
