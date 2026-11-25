"use client";

/**
 * The HTML heads-up display laid over the game canvas.
 *
 *   ┌───────────────────────────────────────────────┐
 *   │ hearts/coins/level   location     [minimap]   │   the minimap is drawn by
 *   │ repo health          boss bar       toasts    │   the engine; keep it free
 *   │                                     toasts    │
 *   │               (banners, upper middle)         │
 *   │                                               │
 *   │ weapon + dash        "E  Open chest"   buttons│
 *   │ combo                                         │
 *   └───────────────────────────────────────────────┘
 *
 * The whole layer ignores the mouse (pointer-events: none) except its
 * buttons, so clicks reach the canvas. Every size is in art pixels (see
 * units.ts), so the HUD scales with the game.
 */
import type { HudState } from "@/game/bridge";
import type { OverlayRequest } from "@/components/overlays/types";
import type { RepoHealth } from "@/lib/game";
import type { SaveData, Store } from "@/lib/types";
import { BannerView } from "./BannerView";
import type { Feed } from "./feed";
import { HudButtons } from "./HudButtons";
import { LocationPill } from "./LocationPill";
import { PromptBubble } from "./PromptBubble";
import { StatusPanel } from "./StatusPanel";
import { ToastStack } from "./ToastStack";
import { HUD_FONT_SIZE } from "./units";
import { WeaponPanel } from "./WeaponPanel";

interface Props {
  hud: Store<HudState>;
  save: Store<SaveData>;
  feed: Feed;
  health: RepoHealth;
  /** The game's integer zoom (also available to CSS as `--s`). */
  scale: number;
  /** False while an overlay is open: the buttons hide so they can't be clicked through it. */
  interactive: boolean;
  onOpen: (request: OverlayRequest) => void;
}

export function Hud({ hud, save, feed, health, scale, interactive, onOpen }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 select-none leading-tight text-cream" style={{ fontSize: HUD_FONT_SIZE }}>
      <StatusPanel hud={hud} save={save} health={health} />
      <LocationPill hud={hud} />
      <ToastStack feed={feed} scale={scale} />
      <BannerView feed={feed} />
      <WeaponPanel hud={hud} save={save} />
      <PromptBubble hud={hud} />
      {interactive && <HudButtons onOpen={onOpen} />}
    </div>
  );
}
