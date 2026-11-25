"use client";

/**
 * "x7 COMBO": punches up every time the combo grows, and fades out (still
 * showing the last number) when the combo runs out.
 */
import { useState } from "react";
import type { HudState } from "@/game/bridge";
import { useStore } from "@/lib/game/useStore";
import type { Store } from "@/lib/types";
import { HUD_FX } from "./fx";
import { ap, BOLD_OUTLINE } from "./units";

/** A single hit is not a combo yet. */
const MIN_COMBO = 2;

/** Hotter colours for bigger combos. */
function comboColor(combo: number): string {
  if (combo >= 20) return "var(--color-rose)";
  if (combo >= 10) return "#ffa94d";
  return "var(--color-gold)";
}

export function ComboCounter({ hud }: { hud: Store<HudState> }) {
  const combo = useStore(hud, (h) => h.combo);
  // Remember the last real combo so the fade-out can keep showing it after the engine resets to 0.
  const [shown, setShown] = useState(0);
  if (combo >= MIN_COMBO && combo !== shown) setShown(combo);

  if (shown < MIN_COMBO) return null;
  const active = combo >= MIN_COMBO;

  return (
    <div
      // A new key per number replays the punch; the "fading" key plays the fade-out once.
      key={active ? shown : "fading"}
      className={`font-title ${active ? HUD_FX.comboPop : HUD_FX.fadeOutSlow}`}
      style={{ color: comboColor(shown), fontSize: ap(7), textShadow: BOLD_OUTLINE, transform: "rotate(-3deg)", transformOrigin: "left bottom" }}
    >
      x{shown}
      <span style={{ fontSize: ap(4), marginLeft: ap(2) }}>COMBO</span>
    </div>
  );
}
