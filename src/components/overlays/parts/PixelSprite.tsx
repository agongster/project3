"use client";

/**
 * Shows one pixel-art sprite as a crisp, scaled-up image.
 *
 * Unlike the kit's `SpriteView` (one <canvas> per sprite), this uses the
 * sprite's cached PNG data URL as a CSS background. That is much cheaper
 * when a list shows hundreds of the same few icons (the codex) and makes
 * frame-by-frame animation a simple prop change.
 */
import type { CSSProperties } from "react";
import { cx } from "@/components/ui/kit";
import { spriteUrl } from "./sprites";
import type { Sprite } from "./sprites";

interface PixelSpriteProps {
  sprite: Sprite | null;
  /** Each art pixel becomes scale × scale screen pixels. */
  scale?: number;
  /** Accessible description; omit for purely decorative sprites. */
  label?: string;
  /** Draw as a dark shape (an item not found yet). */
  silhouette?: boolean;
  flipX?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** How a "not found yet" item looks: a flat dark shape that still hints at its outline. */
const SILHOUETTE_FILTER = "brightness(0) opacity(0.45)";

export function PixelSprite({ sprite, scale = 3, label, silhouette, flipX, className, style }: PixelSpriteProps) {
  if (!sprite) return null;
  const url = spriteUrl(sprite);
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cx("pixelated inline-block shrink-0 bg-no-repeat", className)}
      style={{
        width: sprite.w * scale,
        height: sprite.h * scale,
        backgroundImage: url ? `url(${url})` : undefined,
        backgroundSize: "100% 100%",
        filter: silhouette ? SILHOUETTE_FILTER : undefined,
        transform: flipX ? "scaleX(-1)" : undefined,
        ...style,
      }}
    />
  );
}
