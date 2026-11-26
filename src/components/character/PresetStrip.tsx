"use client";

/** "Quick start": a row of hand-picked heroes; clicking one dresses the hero like it. */
import type { CharacterLook } from "@/lib/types";
import { HeroSwatch } from "./HeroSwatch";
import { PRESETS, presetLook } from "./lookPresets";

interface Props {
  /** The player's name (presets keep it). */
  name: string;
  onPick: (look: CharacterLook) => void;
  /** Smaller portraits without captions, for tight spaces. */
  compact?: boolean;
}

/** Portrait zoom: head-and-shoulders crops. */
const PORTRAIT_SCALE = 2;

export function PresetStrip({ name, onPick, compact = false }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="font-label text-xs text-ink-soft">Quick start</h3>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => {
          const look = presetLook(preset, name);
          return (
            <button
              key={preset.title}
              type="button"
              title={preset.title}
              aria-label={`Quick start: ${preset.title}`}
              onClick={() => onPick(look)}
              className="flex flex-col items-center gap-0.5 p-0.5 outline-none hover:-translate-y-px focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-grape"
              style={PORTRAIT_STYLE}
            >
              <HeroSwatch look={look} hatId={null} crop="head" scale={PORTRAIT_SCALE} />
              {!compact && <span className="px-0.5 text-xs font-bold leading-none">{preset.title}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const PORTRAIT_STYLE = { background: "rgb(240 220 174 / 0.75)", boxShadow: "inset 0 0 0 2px rgb(43 27 61 / 0.45)" };
