"use client";

/**
 * A wrapping row of clickable swatches that behaves like radio buttons:
 * Tab enters it on the chosen option, the arrow keys (and Home / End) pick
 * the previous / next option, and every pick applies at once.
 *
 * Two looks: "chip" (a plain colour square) and "tile" (a small framed
 * picture, e.g. the hero wearing that option).
 */
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { cx } from "@/components/ui/kit";

/** Arrow keys move one option back or forward (wrapping around). */
const STEP_KEYS: Record<string, -1 | 1> = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };

/** Where a key press moves the choice, or null when it is not a navigation key. */
export function nextPosition(key: string, current: number, count: number): number | null {
  if (count <= 0) return null;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  const step = STEP_KEYS[key];
  return step === undefined ? null : (current + step + count) % count;
}

interface Props {
  /** Accessible name of the whole group, e.g. "Hair style". */
  label: string;
  /** Accessible name of each option, in display order. */
  names: readonly string[];
  /** Position (in `names`) of the chosen option; -1 when none is. */
  selected: number;
  onPick: (position: number) => void;
  /** What the button at `position` shows. */
  renderSwatch: (position: number) => ReactNode;
  variant: "chip" | "tile";
  /** Chip colours, by position (chips only). */
  colors?: readonly string[];
}

export function SwatchGrid({ label, names, selected, onPick, renderSwatch, variant, colors }: Props) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = nextPosition(event.key, Math.max(0, selected), names.length);
    if (next === null) return;
    event.preventDefault();
    onPick(next);
    const button = event.currentTarget.children.item(next);
    if (button instanceof HTMLElement) button.focus();
  };
  const tabStop = selected >= 0 ? selected : 0;

  return (
    <div role="radiogroup" aria-label={label} className={cx("flex flex-wrap gap-1", variant === "chip" && "py-1")} onKeyDown={onKeyDown}>
      {names.map((name, position) => {
        const chosen = position === selected;
        return (
          <button
            key={position}
            type="button"
            role="radio"
            aria-checked={chosen}
            aria-label={name}
            title={name}
            tabIndex={position === tabStop ? 0 : -1}
            onClick={() => onPick(position)}
            className={cx(
              "outline-none transition-transform duration-75 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-grape",
              variant === "chip" ? "h-5 w-5" : "grid place-items-center p-0.5",
              chosen ? "-translate-y-0.5" : "hover:-translate-y-px",
            )}
            style={swatchStyle(variant, chosen, colors?.[position])}
          >
            {renderSwatch(position)}
          </button>
        );
      })}
    </div>
  );
}

const INK_EDGE = "inset 0 0 0 2px rgb(43 27 61 / 0.45)";
const CHOSEN_EDGE = "inset 0 0 0 2px #fff4d9, 0 0 0 3px #2b1b3d, 0 4px 0 0 #2b1b3d";
const TILE_BG = "rgb(240 220 174 / 0.75)";
const TILE_CHOSEN_BG = "#ffe08a";

function swatchStyle(variant: "chip" | "tile", chosen: boolean, color: string | undefined): CSSProperties {
  const background = variant === "chip" ? color : chosen ? TILE_CHOSEN_BG : TILE_BG;
  return { background, boxShadow: chosen ? CHOSEN_EDGE : INK_EDGE };
}
