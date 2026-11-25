"use client";

/**
 * Draws a sprite sized in *art pixels* (see units.ts), so it zooms with the
 * game like the rest of the HUD: `zoom` 1 means one sprite pixel = one art
 * pixel = `--s` screen pixels. Use the kit's SpriteView outside the game.
 */
import { useEffect, useRef } from "react";
import type { SpriteLike } from "@/components/ui/kit";
import { ap } from "./units";

interface Props {
  sprite: SpriteLike;
  zoom?: number;
  flipX?: boolean;
  className?: string;
}

export function ArtSprite({ sprite, zoom = 1, flipX, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.width = sprite.w;
    canvas.height = sprite.h;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, sprite.w, sprite.h);
    ctx.drawImage(sprite.canvas, 0, 0);
  }, [sprite]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={`pixelated block ${className ?? ""}`}
      style={{ width: ap(sprite.w * zoom), height: ap(sprite.h * zoom), transform: flipX ? "scaleX(-1)" : undefined }}
    />
  );
}
