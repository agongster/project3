"use client";

/**
 * Loading screen: analyses the repo and builds the world while the player
 * plays "Bug Catch". The score becomes bonus coins (capped). When the world is
 * ready a card invites the player in, so nobody is pulled out mid-catch.
 */
import { useRef, useState } from "react";
import { uiSprite } from "@/game/art/ui";
import LoadingGame from "@/components/loading/LoadingGame";
import { MAX_LOADING_BONUS } from "@/components/loading/types";
import { PixelBar, PixelButton, SpriteView } from "@/components/ui/kit";
import { useMusic } from "@/components/app/audioHooks";
import { targetLabel, type FlowError, type LoadedWorld, type WorldTarget } from "@/components/app/flow";
import type { AppServices } from "@/components/app/services";
import { useStore } from "@/lib/game/useStore";
import { TipLine } from "./loading/TipLine";
import { overallProgress, useWorldLoader } from "./loading/useWorldLoader";
import { WorldReadyCard } from "./loading/WorldReadyCard";

interface Props {
  target: WorldTarget;
  services: AppServices;
  onEnter: (loaded: LoadedWorld, bonusCoins: number) => void;
  onError: (error: FlowError) => void;
  onCancel: () => void;
}

/**
 * The mini-game box: 16:9, as wide as possible while leaving ~250 px of
 * height for the header and the status area underneath.
 */
const GAME_BOX_STYLE = { width: "min(960px, 100%, calc((100vh - 250px) * 16 / 9))", aspectRatio: "16 / 9" };

export function LoadingScreen({ target, services, onEnter, onError, onCancel }: Props) {
  const { save, audio } = services;
  const look = useStore(save, (s) => s.look);
  const hatId = useStore(save, (s) => s.equipped.hat);
  const theme = useStore(save, (s) => s.theme);
  const [bonusCoins, setBonusCoins] = useState(0);
  const state = useWorldLoader(target, onError);
  // Enter can be pressed and clicked at nearly the same moment; only the first one counts.
  const enteredRef = useRef(false);

  useMusic(audio, "loading");

  function enterWorld(loaded: LoadedWorld) {
    if (enteredRef.current) return;
    enteredRef.current = true;
    audio.sfx("uiSelect");
    onEnter(loaded, bonusCoins);
  }

  function cancel() {
    audio.sfx("uiBack");
    onCancel();
  }

  return (
    <main className="flex h-full w-full flex-col items-center gap-3 overflow-y-auto bg-night px-4 py-3">
      <header className="flex w-full max-w-[960px] items-center justify-between gap-4">
        <PixelButton tone="cream" small onClick={cancel}>
          ◀ Cancel
        </PixelButton>
        <h1 className="truncate text-center font-title text-[14px] leading-loose text-cream">
          Building <span className="text-gold">{targetLabel(target)}</span>
        </h1>
        <p className="flex shrink-0 items-center gap-2 font-bold text-gold" aria-live="polite">
          <SpriteView sprite={uiSprite("coin")} scale={2} />
          bonus coins: {bonusCoins}
          <span className="text-cream/60">/ {MAX_LOADING_BONUS}</span>
        </p>
      </header>

      <div className="relative shrink-0" style={GAME_BOX_STYLE}>
        <LoadingGame
          audio={audio}
          look={look}
          hatId={hatId}
          theme={theme}
          onScore={(score) => setBonusCoins(Math.min(MAX_LOADING_BONUS, score))}
          className="h-full w-full"
        />
      </div>

      {state.status === "ready" ? (
        <WorldReadyCard analysis={state.loaded.analysis} bonusCoins={bonusCoins} onEnter={() => enterWorld(state.loaded)} />
      ) : (
        <section className="flex w-full max-w-[720px] flex-col gap-3 pt-1">
          <PixelBar value={overallProgress(state.progress)} label="Analysis progress" color="var(--color-gold)" />
          <p className="text-center font-semibold text-cream">{state.progress?.label ?? "Waking up the kingdom…"}</p>
          <TipLine />
        </section>
      )}
    </main>
  );
}
