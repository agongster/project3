"use client";

/**
 * A monster sprite fitted into a square box. Monsters come in 16, 24 and
 * 32 px sizes; this picks the largest whole-number zoom that fits `box`, so
 * a dust bunny and a boss can sit side by side in the same list.
 */
import { MONSTERS } from "@/lib/game/catalog";
import type { MonsterKind } from "@/lib/types";
import { cx } from "@/components/ui/kit";
import { PixelSprite } from "./PixelSprite";
import { monsterFrame } from "./sprites";

interface MonsterIconProps {
  kind: MonsterKind;
  /** Box size in screen pixels. */
  box: number;
  /** Animation frame (counts up forever; wraps per monster). */
  frame?: number;
  dim?: boolean;
  className?: string;
}

export function MonsterIcon({ kind, box, frame = 0, dim, className }: MonsterIconProps) {
  const scale = Math.max(1, Math.floor(box / MONSTERS[kind].size));
  return (
    <span className={cx("inline-flex shrink-0 items-end justify-center", dim && "opacity-35 grayscale", className)} style={{ width: box, height: box }}>
      <PixelSprite sprite={monsterFrame(kind, frame)} scale={scale} label={MONSTERS[kind].name} />
    </span>
  );
}
