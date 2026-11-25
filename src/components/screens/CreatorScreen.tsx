"use client";

/**
 * The hero creator. The player edits a *draft* (so "Back" really cancels);
 * "Start adventure" writes it to the save and marks the hero as created.
 * The scenery choice is saved immediately, like everywhere else.
 */
import { useState } from "react";
import { HeroStage } from "@/components/character/HeroStage";
import { LookEditor } from "@/components/character/LookEditor";
import { ThemePicker } from "@/components/character/ThemePicker";
import { PixelButton, PixelPanel } from "@/components/ui/kit";
import { useMusic } from "@/components/app/audioHooks";
import { ROOMY_SCREEN, useMediaQuery } from "@/components/app/useMediaQuery";
import { targetLabel, type WorldTarget } from "@/components/app/flow";
import type { AppServices } from "@/components/app/services";
import { equipItem, markCreated, sanitizeLook, setLook, setTheme, unequip } from "@/lib/game";
import { useStore } from "@/lib/game/useStore";
import type { CharacterLook, SaveData } from "@/lib/types";

interface Props {
  services: AppServices;
  /** The world to load once the hero is ready (null when the player came via "Edit hero"). */
  next: WorldTarget | null;
  onDone: () => void;
  onBack: () => void;
}

interface Draft {
  look: CharacterLook;
  hatId: string | null;
}

/** Writes the finished draft into the save: look, hat, and "the hero exists now". */
function applyDraft(save: SaveData, draft: Draft): SaveData {
  const withLook = setLook(save, draft.look);
  const withHat = draft.hatId ? equipItem(withLook, draft.hatId) : unequip(withLook, "hat");
  return markCreated(withHat);
}

export function CreatorScreen({ services, next, onDone, onBack }: Props) {
  const { save, audio } = services;
  const [draft, setDraft] = useState<Draft>(() => ({ look: save.get().look, hatId: save.get().equipped.hat }));
  const owned = useStore(save, (s) => s.owned);
  const theme = useStore(save, (s) => s.theme);
  const firstTime = useStore(save, (s) => !s.created);
  // Big windows get the big hero and big theme cards; laptops get everything a size smaller.
  const roomy = useMediaQuery(ROOMY_SCREEN);

  useMusic(audio, "title");

  const confirm = () => {
    audio.sfx("uiSelect");
    save.set((s) => applyDraft(s, draft));
    onDone();
  };

  const back = () => {
    audio.sfx("uiBack");
    onBack();
  };

  return (
    <main className="flex h-full w-full flex-col items-center overflow-y-auto bg-night px-4 py-3">
      {/* my-auto centres the creator vertically on tall windows and lets it scroll on tiny ones. */}
      <div className="my-auto flex w-full max-w-[1040px] flex-col">
        <header className="flex w-full items-center gap-4">
          <PixelButton tone="cream" small onClick={back}>
            ◀ Back
          </PixelButton>
          <h1 className="font-title text-[18px] leading-loose text-gold">{firstTime ? "Create your hero" : "Edit your hero"}</h1>
          {next && <span className="ml-auto text-cream/70">Next stop: {targetLabel(next)}</span>}
        </header>

        <div className="grid w-full grid-cols-1 items-start gap-4 py-2 md:grid-cols-[auto_1fr]">
          <PixelPanel tone="wood" className="flex flex-col items-center gap-3 p-4">
            <HeroStage look={draft.look} hatId={draft.hatId} theme={theme} audio={audio} scale={roomy ? 4 : 3} />
            <div className="w-full">
              <h2 className="mb-3 font-bold text-cream">Scenery</h2>
              <ThemePicker value={theme} onChange={(id) => save.set((s) => setTheme(s, id))} audio={audio} previewScale={roomy ? 2 : 1} columns={3} className="justify-center" />
            </div>
          </PixelPanel>

          <PixelPanel className="flex flex-col gap-2 p-4">
            <LookEditor
              look={draft.look}
              hatId={draft.hatId}
              ownedHatIds={owned}
              audio={audio}
              onLookChange={(patch) => setDraft((d) => ({ ...d, look: sanitizeLook({ ...d.look, ...patch }, d.look) }))}
              onHatChange={(hatId) => setDraft((d) => ({ ...d, hatId }))}
              footer={
                <PixelButton tone="gold" className="text-[20px]" onClick={confirm}>
                  {next ? "Start adventure ▶" : "Save hero ✓"}
                </PixelButton>
              }
            />
          </PixelPanel>
        </div>
      </div>
    </main>
  );
}
