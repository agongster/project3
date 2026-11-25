"use client";

/**
 * Bottom-right mouse shortcuts: Bag (I), Codex (C), Menu (Esc).
 *
 * They never take keyboard focus: a focused button would be "clicked" again
 * by the Space bar, which is also the attack key.
 */
import type { MouseEvent } from "react";
import type { OverlayRequest } from "@/components/overlays/types";
import { ap } from "./units";

interface Props {
  onOpen: (request: OverlayRequest) => void;
}

const BUTTONS: readonly { label: string; hint: string; request: OverlayRequest }[] = [
  { label: "Bag", hint: "I", request: { kind: "bag" } },
  { label: "Codex", hint: "C", request: { kind: "codex" } },
  { label: "Menu", hint: "Esc", request: { kind: "pause" } },
];

/** Stops the mouse-down from moving focus onto the button. */
function keepFocusOnGame(event: MouseEvent) {
  event.preventDefault();
}

export function HudButtons({ onOpen }: Props) {
  return (
    <div className="pointer-events-auto absolute flex" style={{ right: ap(3), bottom: ap(3), gap: ap(1) }}>
      {BUTTONS.map((button) => (
        <button
          key={button.label}
          type="button"
          tabIndex={-1}
          onMouseDown={keepFocusOnGame}
          onClick={() => onOpen(button.request)}
          className="px-btn cream small"
          style={{ fontSize: "0.85em", margin: ap(1) }}
          title={`${button.label} (${button.hint})`}
        >
          {button.label}
          <span className="text-ink-soft" style={{ fontSize: "0.8em" }}>
            {button.hint}
          </span>
        </button>
      ))}
    </div>
  );
}
