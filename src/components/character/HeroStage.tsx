"use client";

/**
 * A big hero preview standing on a little patch of themed ground, with
 * buttons to turn them around. Used by the hero creator and the wardrobe.
 */
import { useEffect, useRef, useState } from "react";
import type { Facing } from "@/game/art";
import type { AudioApi } from "@/game/bridge";
import { PixelButton } from "@/components/ui/kit";
import type { CharacterLook, ThemeId } from "@/lib/types";
import { CharacterPreview } from "./CharacterPreview";
import { drawScenery, sceneryHeightPx, sceneryWidthPx, type Scenery } from "./scenery";

/** A 6×4-tile garden with the hero standing in the middle of the meadow. */
const STAGE_SCENE: Scenery = {
  rows: ["gggggg", "gmmmmg", "gmmmmg", "gggggg"],
  buildings: [],
  props: [
    { kind: "flower", x: 0, y: 1, variant: 2 },
    { kind: "bush", x: 5, y: 1, variant: 1 },
    { kind: "flower", x: 5, y: 3, variant: 0 },
    { kind: "mushroom", x: 0, y: 3 },
  ],
  wrap: false,
};

/** How far above the patch's bottom edge the hero's feet stand, in art pixels. */
const FEET_ABOVE_BOTTOM_PX = 20;

/** Facing order when turning clockwise (as seen from above). */
const CLOCKWISE: readonly Facing[] = ["down", "left", "up", "right"];

function GroundPatch({ theme, scale }: { theme: ThemeId; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const w = sceneryWidthPx(STAGE_SCENE);
  const h = sceneryHeightPx(STAGE_SCENE);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    drawScenery(ctx, theme, STAGE_SCENE, { x: 0, y: 0, w, h, timeMs: 0 });
  }, [theme, w, h]);

  return <canvas ref={ref} width={w} height={h} className="block" style={{ width: w * scale, height: h * scale }} aria-hidden />;
}

interface Props {
  look: CharacterLook;
  hatId: string | null;
  theme: ThemeId;
  audio: AudioApi;
  /** Integer zoom for both the ground and the hero, so their pixels match. */
  scale?: number;
  /** The Turn / Spin buttons (hidden where space is tight; the hero then just spins). */
  showTurnButtons?: boolean;
}

export function HeroStage({ look, hatId, theme, audio, scale = 4, showTurnButtons = true }: Props) {
  // null = slowly spin on its own; a direction = the player turned the hero by hand.
  const [facing, setFacing] = useState<Facing | null>(null);

  const turn = (delta: -1 | 1) => {
    audio.sfx("uiMove");
    const current = CLOCKWISE.indexOf(facing ?? "down");
    setFacing(CLOCKWISE[(current + delta + CLOCKWISE.length) % CLOCKWISE.length]);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ boxShadow: STAGE_FRAME }}>
        <GroundPatch theme={theme} scale={scale} />
        {/* Feet a little below the patch's centre, so the hero stands in the meadow. */}
        <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: `${scale * FEET_ABOVE_BOTTOM_PX}px` }}>
          <CharacterPreview look={look} hatId={hatId} scale={scale} turning={facing === null} facing={facing ?? "down"} />
        </div>
      </div>
      {showTurnButtons && (
        <div className="flex items-center gap-1">
          <PixelButton tone="cream" small onClick={() => turn(-1)} aria-label="Turn left">
            ↺ Turn
          </PixelButton>
          <PixelButton
            tone={facing === null ? "sky" : "cream"}
            small
            onClick={() => {
              audio.sfx("uiSelect");
              setFacing(null);
            }}
          >
            Spin
          </PixelButton>
          <PixelButton tone="cream" small onClick={() => turn(1)} aria-label="Turn right">
            Turn ↻
          </PixelButton>
        </div>
      )}
    </div>
  );
}

const STAGE_FRAME = "0 -4px 0 0 #2b1b3d, 0 4px 0 0 #2b1b3d, -4px 0 0 0 #2b1b3d, 4px 0 0 0 #2b1b3d, 0 10px 0 0 rgb(0 0 0 / 0.3)";
