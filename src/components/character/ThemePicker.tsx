"use client";

/**
 * Six scenery cards, each with a little painted preview of that theme.
 * Picking one restyles the world (and the menus' backdrop) immediately.
 * Used on the title screen, in the hero creator and in the wardrobe.
 */
import { useEffect, useRef, type KeyboardEvent } from "react";
import type { AudioApi } from "@/game/bridge";
import { cx } from "@/components/ui/kit";
import { THEMES } from "@/lib/game/catalog";
import type { ThemeId } from "@/lib/types";
import { drawScenery, sceneryHeightPx, sceneryWidthPx, type Scenery } from "./scenery";

/** A 4×2-tile postcard: a tree, a flower, a bush and a lamp on a strip of meadow. */
const PREVIEW_SCENE: Scenery = {
  rows: ["gggg", "gmmg"],
  buildings: [],
  props: [
    { kind: "tree", x: 0, y: 1 },
    { kind: "flower", x: 1, y: 1, variant: 1 },
    { kind: "bush", x: 2, y: 1 },
    { kind: "lamp", x: 3, y: 1 },
  ],
  wrap: false,
};

/** Space around the preview inside a card (p-1 on both sides). */
const CARD_PADDING_PX = 8;

/** A frozen moment of the lamp/water animations, so every card is drawn just once. */
const PREVIEW_TIME_MS = 0;

function ThemePreview({ theme, scale }: { theme: ThemeId; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const w = sceneryWidthPx(PREVIEW_SCENE);
  const h = sceneryHeightPx(PREVIEW_SCENE);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    drawScenery(ctx, theme, PREVIEW_SCENE, { x: 0, y: 0, w, h, timeMs: PREVIEW_TIME_MS });
  }, [theme, w, h]);

  return <canvas ref={ref} width={w} height={h} className="block" style={{ width: w * scale, height: h * scale }} aria-hidden />;
}

interface Props {
  value: ThemeId;
  onChange: (theme: ThemeId) => void;
  audio: AudioApi;
  /** Zoom of the little previews (1 = compact, 2 = roomy). */
  previewScale?: number;
  /** How many cards per row. */
  columns?: 2 | 3 | 6;
  className?: string;
}

/** Each column is exactly one card wide, so cards never stretch wider than their preview. */
const GRID_COLUMNS = { 2: "grid-cols-[repeat(2,max-content)]", 3: "grid-cols-[repeat(3,max-content)]", 6: "grid-cols-[repeat(6,max-content)]" } as const;

export function ThemePicker({ value, onChange, audio, previewScale = 2, columns = 3, className }: Props) {
  const choose = (theme: ThemeId) => {
    if (theme !== value) audio.sfx("uiSelect");
    onChange(theme);
  };

  // Arrow keys move the selection, like any radio group.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const index = THEMES.findIndex((t) => t.id === value);
    const next = THEMES[(index + step + THEMES.length) % THEMES.length];
    audio.sfx("uiMove");
    onChange(next.id);
    // Keep keyboard focus on the newly selected card.
    const card = event.currentTarget.querySelector<HTMLButtonElement>(`[data-theme="${next.id}"]`);
    card?.focus();
  };

  return (
    <div role="radiogroup" aria-label="Scenery" className={cx("grid gap-2.5", GRID_COLUMNS[columns], className)} onKeyDown={onKeyDown}>
      {THEMES.map((theme) => {
        const selected = theme.id === value;
        return (
          <button
            key={theme.id}
            type="button"
            role="radio"
            aria-checked={selected}
            data-theme={theme.id}
            tabIndex={selected ? 0 : -1}
            title={theme.blurb}
            onClick={() => choose(theme.id)}
            style={{ width: sceneryWidthPx(PREVIEW_SCENE) * previewScale + CARD_PADDING_PX, boxShadow: selected ? CARD_SHADOW_SELECTED : CARD_SHADOW }}
            className={cx(
              "group relative flex flex-col items-center gap-1 bg-cream p-1 pb-2 text-ink outline-none transition-transform duration-75",
              "hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-gold",
            )}
          >
            <ThemePreview theme={theme.id} scale={previewScale} />
            {/* Small cards wrap the name onto two lines instead of cutting it off. */}
            <span className={cx("px-1 text-center font-bold leading-tight", previewScale > 1 ? "text-sm" : "text-xs")}>{theme.name}</span>
            {selected && (
              <span className="anim-pop absolute -right-2 -top-2 bg-gold px-1 text-xs font-bold text-ink" style={{ boxShadow: BADGE_SHADOW }}>
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Pixel "notched" borders, same recipe as the kit's panels: ink normally, gold when chosen. */
const CARD_SHADOW = "0 -3px 0 0 #2b1b3d, 0 3px 0 0 #2b1b3d, -3px 0 0 0 #2b1b3d, 3px 0 0 0 #2b1b3d, 0 6px 0 0 rgb(0 0 0 / 0.25)";
const CARD_SHADOW_SELECTED =
  "0 -3px 0 0 #2b1b3d, 0 3px 0 0 #2b1b3d, -3px 0 0 0 #2b1b3d, 3px 0 0 0 #2b1b3d, 0 -6px 0 0 #ffc93c, 0 6px 0 0 #ffc93c, -6px 0 0 0 #ffc93c, 6px 0 0 0 #ffc93c";
const BADGE_SHADOW = "0 -2px 0 0 #2b1b3d, 0 2px 0 0 #2b1b3d, -2px 0 0 0 #2b1b3d, 2px 0 0 0 #2b1b3d";
