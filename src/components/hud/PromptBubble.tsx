"use client";

/** Bottom-centre "press E to …" speech bubble, shown while the engine offers an interaction. */
import type { HudState } from "@/game/bridge";
import { KeyCap } from "@/components/ui/kit";
import { useStore } from "@/lib/game/useStore";
import type { Store } from "@/lib/types";
import { HUD_FX } from "./fx";
import { ap } from "./units";

const PROMPT_BOTTOM_ART_PX = 26;
const PROMPT_MAX_WIDTH_ART_PX = 200;

export function PromptBubble({ hud }: { hud: Store<HudState> }) {
  const prompt = useStore(hud, (h) => h.prompt);
  if (!prompt) return null;

  return (
    // Sits above the bottom row of HUD panels and buttons, below the hero.
    <div className={`absolute left-1/2 ${HUD_FX.promptBob}`} style={{ bottom: ap(PROMPT_BOTTOM_ART_PX), maxWidth: ap(PROMPT_MAX_WIDTH_ART_PX) }}>
      {/* `key` replays the pop-in whenever the prompt text changes. */}
      <div
        key={prompt}
        className="anim-pop relative flex items-center whitespace-nowrap bg-cream font-bold text-ink"
        style={{ padding: `${ap(2)} ${ap(4)} ${ap(2)} ${ap(2)}`, gap: ap(2), boxShadow: BUBBLE_SHADOW }}
      >
        <KeyCap>E</KeyCap>
        <span className="truncate">{prompt}</span>
        {/* The little tail pointing down at the hero. */}
        <span className="absolute left-1/2 -translate-x-1/2 bg-cream" style={{ bottom: ap(-3), width: ap(4), height: ap(3), boxShadow: TAIL_SHADOW }} />
      </div>
    </div>
  );
}

const BUBBLE_SHADOW =
  "0 calc(var(--s) * -1px) 0 0 #2b1b3d, 0 calc(var(--s) * 1px) 0 0 #2b1b3d, calc(var(--s) * -1px) 0 0 0 #2b1b3d, calc(var(--s) * 1px) 0 0 0 #2b1b3d, 0 calc(var(--s) * 3px) 0 0 rgb(0 0 0 / 0.3)";
const TAIL_SHADOW = "calc(var(--s) * -1px) 0 0 0 #2b1b3d, calc(var(--s) * 1px) 0 0 0 #2b1b3d, 0 calc(var(--s) * 1px) 0 0 #2b1b3d";
