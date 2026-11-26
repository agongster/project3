"use client";

/**
 * Bottom-right mouse shortcuts: Bag (I), Codex (C), Workshop (F), Menu (Esc).
 * All four look the same: the Workshop is one more room of the game, not
 * the main event.
 *
 * They never take keyboard focus: a focused button would be "clicked" again
 * by the Space bar, which is also the attack key. Pointing at the Workshop
 * button starts downloading the editor, so it opens without a wait.
 */
import type { MouseEvent } from "react";
import { preloadWorkshop } from "@/components/workshop";
import type { OverlayRequest } from "@/components/overlays/types";
import { ap, HUD_SMALL_FONT_SIZE } from "./units";

interface Props {
  onOpen: (request: OverlayRequest) => void;
  onWorkshop: () => void;
}

const BAG = { label: "Bag", hint: "I", request: { kind: "bag" } } as const;
const CODEX = { label: "Codex", hint: "C", request: { kind: "codex" } } as const;
const MENU = { label: "Menu", hint: "Esc", request: { kind: "pause" } } as const;

/** The Workshop's key, shown on its button (GameScreen's shortcut handler listens for it). */
const WORKSHOP_HINT = "F";

/** Stops the mouse-down from moving focus onto the button. */
function keepFocusOnGame(event: MouseEvent) {
  event.preventDefault();
}

function HudButton({ label, hint, onClick, onPointerEnter }: { label: string; hint: string; onClick: () => void; onPointerEnter?: () => void }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      onMouseDown={keepFocusOnGame}
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      className="px-btn cream small"
      style={{ fontSize: HUD_SMALL_FONT_SIZE, margin: ap(1) }}
      title={`${label} (${hint})`}
    >
      {label}
      <span className="text-ink-soft">{hint}</span>
    </button>
  );
}

export function HudButtons({ onOpen, onWorkshop }: Props) {
  return (
    <div className="pointer-events-auto absolute flex" style={{ right: ap(3), bottom: ap(3), gap: ap(1) }}>
      {[BAG, CODEX].map((button) => (
        <HudButton key={button.label} label={button.label} hint={button.hint} onClick={() => onOpen(button.request)} />
      ))}
      <HudButton label="Workshop" hint={WORKSHOP_HINT} onClick={onWorkshop} onPointerEnter={preloadWorkshop} />
      <HudButton label={MENU.label} hint={MENU.hint} onClick={() => onOpen(MENU.request)} />
    </div>
  );
}
