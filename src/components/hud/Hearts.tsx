"use client";

/**
 * The player's hearts. HP is counted in half-hearts, so 7 / 10 shows three
 * full hearts, one half heart and one empty heart. The row shakes when the
 * player is hurt and bounces when healed.
 */
import { useState } from "react";
import { uiSprite } from "@/game/art/ui";
import type { HudState } from "@/game/bridge";
import { useStore } from "@/lib/game/useStore";
import type { Store } from "@/lib/types";
import { ArtSprite } from "./ArtSprite";
import { HUD_FX } from "./fx";
import { ap } from "./units";

/** Half-hearts per heart container. */
const HALVES_PER_HEART = 2;

type HeartState = "heartFull" | "heartHalf" | "heartEmpty";

/** What each heart container shows for `hp` half-hearts out of `maxHp`. */
export function heartStates(hp: number, maxHp: number): HeartState[] {
  const containers = Math.ceil(maxHp / HALVES_PER_HEART);
  return Array.from({ length: containers }, (_, i) => {
    const filled = hp - i * HALVES_PER_HEART;
    if (filled >= HALVES_PER_HEART) return "heartFull";
    if (filled === 1) return "heartHalf";
    return "heartEmpty";
  });
}

export function Hearts({ hud }: { hud: Store<HudState> }) {
  const hp = useStore(hud, (h) => h.hp);
  const maxHp = useStore(hud, (h) => h.maxHp);
  // Compare with the previous HP to pick the animation ("adjusting state while rendering", see React docs).
  const [previousHp, setPreviousHp] = useState(hp);
  const [change, setChange] = useState<{ kind: "hurt" | "heal"; count: number } | null>(null);
  if (hp !== previousHp) {
    setChange({ kind: hp < previousHp ? "hurt" : "heal", count: (change?.count ?? 0) + 1 });
    setPreviousHp(hp);
  }

  return (
    <div
      // A new key restarts the shake / bounce animation on every change.
      key={change?.count ?? 0}
      className={`flex flex-wrap ${change ? HUD_FX[change.kind] : ""}`}
      style={{ gap: ap(1), maxWidth: ap(90) }}
      role="img"
      aria-label={`${hp / HALVES_PER_HEART} of ${maxHp / HALVES_PER_HEART} hearts`}
    >
      {heartStates(hp, maxHp).map((state, i) => (
        <ArtSprite key={i} sprite={uiSprite(state)} />
      ))}
    </div>
  );
}
