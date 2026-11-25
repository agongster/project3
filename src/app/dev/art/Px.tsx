"use client";
/**
 * Tiny gallery helpers: a pixel canvas that draws once (or animates), and a
 * labelled sprite tile. The gallery only renders in the browser (sprites
 * need a <canvas>), see page.tsx.
 */
import { useEffect, useRef } from "react";
import { drawSprite, type Sprite } from "@/game/art";

export function Px({
  w,
  h,
  scale,
  draw,
  animate = false,
  bg,
}: {
  w: number;
  h: number;
  scale: number;
  draw: (ctx: CanvasRenderingContext2D, tick: number) => void;
  animate?: boolean;
  bg?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  });
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    let raf = 0;
    let last = -1;
    const frame = (t: number) => {
      const tick = Math.floor(t / 160);
      if (tick !== last) {
        last = tick;
        ctx.clearRect(0, 0, w, h);
        if (bg) {
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, w, h);
        }
        drawRef.current(ctx, tick);
      }
      if (animate) raf = requestAnimationFrame(frame);
    };
    frame(0);
    return () => cancelAnimationFrame(raf);
  }, [w, h, animate, bg]);
  return <canvas ref={ref} width={w} height={h} style={{ width: w * scale, height: h * scale, imageRendering: "pixelated", display: "block" }} />;
}

/**
 * One sprite, or several frames side by side, with a caption. With
 * `animate`, the frames play in place instead.
 */
export function Tile({ label, sprites, scale, animate, pad = 2, bg }: { label?: string; sprites: () => Sprite[]; scale: number; animate?: boolean; pad?: number; bg?: string }) {
  const list = sprites();
  const shown = animate ? [list[0]] : list;
  const w = shown.reduce((s, sp) => s + sp.w + pad, pad);
  const maxBelow = Math.max(...list.map((sp) => sp.h - sp.ay));
  const maxAbove = Math.max(...list.map((sp) => sp.ay));
  const h = maxAbove + maxBelow + pad * 2;
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", margin: 4, verticalAlign: "top" }}>
      <Px
        w={animate ? Math.max(...list.map((sp) => sp.w)) + pad * 2 : w}
        h={h}
        scale={scale}
        animate={animate}
        bg={bg}
        draw={(ctx, tick) => {
          let x = pad;
          const frames = sprites();
          for (const sp of animate ? [frames[tick % frames.length]] : frames) {
            drawSprite(ctx, sp, x + sp.ax, pad + maxAbove);
            x += sp.w + pad;
          }
        }}
      />
      {label && <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2, maxWidth: Math.max(90, w * scale), textAlign: "center", lineHeight: 1.2 }}>{label}</div>}
    </div>
  );
}
