"use client";

/**
 * One row of the look editor: a label, ◀ ▶ arrows that cycle through a list
 * of options, and in the middle either the option's name or a strip of
 * colour swatches (for skin / hair / outfit colours).
 */
import type { ReactNode } from "react";
import { cx, PixelButton } from "@/components/ui/kit";

interface RowProps {
  label: string;
  /** Called with -1 (◀) or +1 (▶). */
  onStep: (delta: -1 | 1) => void;
  children: ReactNode;
}

export function OptionRow({ label, onStep, children }: RowProps) {
  return (
    <div className="grid grid-cols-[6rem_auto_1fr_auto] items-center gap-x-1">
      <span className="text-[15px] font-bold leading-tight text-ink-soft">{label}</span>
      <PixelButton tone="cream" small aria-label={`Previous ${label}`} onClick={() => onStep(-1)}>
        ◀
      </PixelButton>
      <div className="flex min-w-0 justify-center">{children}</div>
      <PixelButton tone="cream" small aria-label={`Next ${label}`} onClick={() => onStep(1)}>
        ▶
      </PixelButton>
    </div>
  );
}

/** The current option's name, e.g. "Ponytail" (2 / 8). */
export function OptionName({ name, index, count }: { name: string; index: number; count: number }) {
  return (
    <span className="truncate text-center font-bold">
      {name}
      <span className="ml-2 text-[13px] font-semibold text-ink-soft">
        {index + 1}/{count}
      </span>
    </span>
  );
}

interface SwatchProps {
  label: string;
  colors: readonly string[];
  value: number;
  onPick: (index: number) => void;
}

/** Clickable colour squares; the chosen one gets a thick ink frame and pops up. */
export function Swatches({ label, colors, value, onPick }: SwatchProps) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap justify-center gap-1 py-1">
      {colors.map((color, index) => {
        const selected = index === value;
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${label} ${index + 1}`}
            onClick={() => onPick(index)}
            className={cx("h-4 w-4 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-grape", selected && "-translate-y-0.5")}
            style={{ background: color, boxShadow: selected ? SELECTED_SHADOW : SWATCH_SHADOW }}
          />
        );
      })}
    </div>
  );
}

const SWATCH_SHADOW = "inset 0 0 0 2px rgb(43 27 61 / 0.55)";
const SELECTED_SHADOW = "inset 0 0 0 2px #fff4d9, 0 0 0 3px #2b1b3d, 0 4px 0 0 #2b1b3d";
