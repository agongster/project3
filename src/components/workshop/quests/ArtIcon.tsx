"use client";

/**
 * One of the game's sprites, named by plain data (an AchievementIcon), drawn
 * crisp inside a square box. The sprite is only looked up inside an effect:
 * the art module draws on canvases, which do not exist during server
 * rendering. Every icon used by the quest UI is defined in icons.ts.
 */
import { useEffect, useRef } from "react";
import { cx } from "@/components/ui/kit";
import type { Sprite } from "@/game/art/engine";
import { itemIcon } from "@/game/art/items";
import { monsterSprite } from "@/game/art/monsters";
import { uiSprite } from "@/game/art/ui";
import type { AchievementIcon } from "@/lib/game/achievements";

function spriteFor(icon: AchievementIcon): Sprite {
  switch (icon.type) {
    case "ui":
      return uiSprite(icon.name);
    case "monster":
      return monsterSprite(icon.kind, 0);
    case "item":
      return itemIcon(icon.id);
  }
}

interface ArtIconProps {
  icon: AchievementIcon;
  /** Width and height of the box in CSS pixels; the sprite is scaled by the largest whole number that fits. */
  box: number;
  /** Draw only the outline in shadow (an achievement not earned yet). */
  silhouette?: boolean;
  className?: string;
}

export function ArtIcon({ icon, box, silhouette, className }: ArtIconProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const sprite = spriteFor(icon);
    const scale = Math.max(1, Math.floor(box / Math.max(sprite.w, sprite.h)));
    canvas.width = sprite.w;
    canvas.height = sprite.h;
    canvas.style.width = `${sprite.w * scale}px`;
    canvas.style.height = `${sprite.h * scale}px`;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, sprite.w, sprite.h);
    ctx.drawImage(sprite.canvas, 0, 0);
  }, [icon, box]);

  return (
    <span className={cx("qst-icon", className)} style={{ width: box, height: box }} aria-hidden>
      <canvas ref={ref} className={cx("pixelated", silhouette && "qst-silhouette")} width={1} height={1} />
    </span>
  );
}
