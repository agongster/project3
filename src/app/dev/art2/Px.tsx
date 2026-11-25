"use client";
/**
 * Gallery helpers: a crisp pixel canvas (drawn once, or animated) and a
 * labelled row of sprites. Rendered only in the browser (sprites need <canvas>).
 */
import { useEffect, useRef } from "react";
import { drawSprite, type Sprite } from "@/game/art/engine";

export function Px({ w, h, scale, draw, animate = false, bg }: { w: number; h: number; scale: number; draw: (ctx: CanvasRenderingContext2D, tick: number) => void; animate?: boolean; bg?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  });
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    let raf = 0;
    let last = -1;
    const frame = (t: number) => {
      const tick = Math.floor(t / 180);
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
 * A row of sprites drawn at their anchors (all anchors on one baseline),
 * with a caption. `marks` draws a 1 px magenta dot on each anchor.
 */
export function Row({ label, sprites, scale, animate, pad = 2, bg, marks }: { label?: string; sprites: () => Sprite[]; scale: number; animate?: boolean; pad?: number; bg?: string; marks?: boolean }) {
  const list = sprites();
  const shown = animate ? [list[0]] : list;
  const w = animate ? Math.max(...list.map((s) => s.w)) + pad * 2 : shown.reduce((s, sp) => s + sp.w + pad, pad);
  const above = Math.max(...list.map((s) => s.ay));
  const below = Math.max(...list.map((s) => s.h - s.ay));
  const h = above + below + pad * 2;
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", margin: 4, verticalAlign: "top" }}>
      <Px
        w={w}
        h={h}
        scale={scale}
        animate={animate}
        bg={bg}
        draw={(ctx, tick) => {
          const frames = sprites();
          let x = pad;
          for (const sp of animate ? [frames[tick % frames.length]] : frames) {
            drawSprite(ctx, sp, x + sp.ax, pad + above);
            if (marks) {
              ctx.fillStyle = "#ff00ff";
              ctx.fillRect(x + sp.ax, pad + above, 1, 1);
            }
            x += sp.w + pad;
          }
        }}
      />
      {label && <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2, maxWidth: Math.max(96, w * scale), textAlign: "center", lineHeight: 1.2 }}>{label}</div>}
    </div>
  );
}
