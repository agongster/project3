"use client";

/**
 * The wardrobe: change the hero's look, hat and the scenery theme while
 * playing. Every change is written to the save at once, so the hero and the
 * world behind the overlay restyle live; "Done" just closes.
 *
 * The overlay lives inside the game area (as small as 800×450 on a laptop),
 * so it is laid out in two compact columns with no separate header row, and
 * there the option panel scrolls on its own so the buttons stay in view.
 */
import { ROOMY_SCREEN, useMediaQuery } from "@/components/app/useMediaQuery";
import { HeroStage } from "@/components/character/HeroStage";
import { LookEditor } from "@/components/character/LookEditor";
import { ThemePicker } from "@/components/character/ThemePicker";
import { Modal, PixelButton } from "@/components/ui/kit";
import { equipItem, setLook, setTheme, unequip } from "@/lib/game";
import { useStore } from "@/lib/game/useStore";
import type { OverlayProps } from "./types";

/**
 * Windows where the game (and so this overlay) is drawn at its smallest
 * whole zoom, 800×450 (see useGameScale): too little room for the presets.
 */
const SMALL_GAME_AREA = "(max-width: 1239px), (max-height: 719px)";

export default function WardrobeOverlay({ ctx }: OverlayProps<"wardrobe">) {
  const { save, audio } = ctx;
  const look = useStore(save, (s) => s.look);
  const hatId = useStore(save, (s) => s.equipped.hat);
  const owned = useStore(save, (s) => s.owned);
  const theme = useStore(save, (s) => s.theme);
  const roomy = useMediaQuery(ROOMY_SCREEN);
  const small = useMediaQuery(SMALL_GAME_AREA);

  const done = () => {
    audio.sfx("uiBack");
    ctx.close();
  };

  return (
    <Modal label="Wardrobe" onClose={done} className="flex w-[min(1000px,100%)] flex-col overflow-y-auto p-4">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-[auto_1fr] sm:grid-rows-[minmax(0,1fr)]">
        <div className="flex flex-col items-center gap-2 self-start">
          <h2 className="self-start font-title text-pixel-sm leading-relaxed">Wardrobe</h2>
          <HeroStage look={look} hatId={hatId} theme={theme} audio={audio} scale={roomy ? 3 : 2} showTurnButtons={false} />
          <div className="w-full">
            <h3 className="mb-2 font-bold text-ink-soft">Scenery</h3>
            <ThemePicker value={theme} onChange={(id) => save.set((s) => setTheme(s, id))} audio={audio} previewScale={1} columns={3} className="justify-center" />
          </div>
        </div>
        <LookEditor
          look={look}
          hatId={hatId}
          ownedHatIds={owned}
          audio={audio}
          compact
          showPresets={!small}
          onLookChange={(patch) => save.set((s) => setLook(s, patch))}
          onHatChange={(id) => save.set((s) => (id ? equipItem(s, id) : unequip(s, "hat")))}
          footer={
            <PixelButton tone="gold" onClick={done}>
              Done ✓
            </PixelButton>
          }
        />
      </div>
    </Modal>
  );
}
