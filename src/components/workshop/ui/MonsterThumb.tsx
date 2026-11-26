"use client";

/**
 * A monster shrunk to fit a small square (explorer rows, list rows). The
 * overlays' MonsterIcon only ever scales up by whole numbers, so a 32 px boss
 * would overflow an 18 px row; this one scales the sprite down to fit
 * instead, keeping the pixels crisp.
 */
import { monsterFrame, spriteUrl } from "@/components/overlays/parts/sprites";
import { MONSTERS } from "@/lib/game/catalog";
import type { MonsterLook } from "@/lib/game/monsterLooks";
import type { MonsterKind } from "@/lib/types";

/** `look` is the finding's variant (lookOf); the species' classic look when missing. */
export function MonsterThumb({ kind, size, look }: { kind: MonsterKind; size: number; look?: MonsterLook }) {
  const sprite = monsterFrame(kind, 0, look);
  return (
    <span
      role="img"
      aria-label={MONSTERS[kind].name}
      className="ws-thumb"
      style={{ width: size, height: size, backgroundImage: sprite ? `url(${spriteUrl(sprite)})` : undefined }}
    />
  );
}
