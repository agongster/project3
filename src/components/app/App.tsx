"use client";

/**
 * The whole app as one small state machine (see flow.ts for the picture):
 *
 *   title → creator (first visit, or "Edit hero") → loading → playing → title
 *
 * App owns the current Screen and the long-lived services (save, audio, HUD
 * store); each screen gets what it needs plus callbacks to move on.
 */
import { useState } from "react";
import { CreatorScreen } from "@/components/screens/CreatorScreen";
import { LoadingScreen } from "@/components/screens/LoadingScreen";
import { TitleScreen } from "@/components/screens/TitleScreen";
import { addCoins } from "@/lib/game";
import { useStore } from "@/lib/game/useStore";
import { useAudioSetup } from "./audioHooks";
import type { FlowError, LoadedWorld, Screen, WorldTarget } from "./flow";
import { GameScreen } from "./GameScreen";
import { getServices, type AppServices } from "./services";
import { useIsClient } from "./useIsClient";

export function App() {
  const isClient = useIsClient();
  // The server (and the hydration pass) renders an empty night-sky page; the
  // game itself needs the browser (canvas, localStorage, Web Audio).
  if (!isClient) return <main className="h-full w-full bg-night" />;
  return <AppFlow services={getServices()} />;
}

function AppFlow({ services }: { services: AppServices }) {
  const { save } = services;
  const [screen, setScreen] = useState<Screen>({ name: "title", error: null });
  const heroCreated = useStore(save, (s) => s.created);
  useAudioSetup(save, services.audio);

  const showTitle = (error: FlowError | null = null) => setScreen({ name: "title", error });

  /** First-time players design their hero before the first world loads. */
  const startWorld = (target: WorldTarget) => {
    setScreen(heroCreated ? { name: "loading", target } : { name: "creator", next: target });
  };

  const enterWorld = (loaded: LoadedWorld, bonusCoins: number) => {
    save.set((s) => addCoins(s, bonusCoins));
    if (bonusCoins > 0) services.audio.sfx("coin");
    setScreen({ name: "playing", loaded });
  };

  switch (screen.name) {
    case "title":
      return (
        <TitleScreen
          services={services}
          error={screen.error}
          onStart={startWorld}
          onEditHero={() => setScreen({ name: "creator", next: null })}
          onDismissError={() => showTitle()}
        />
      );
    case "creator": {
      const next = screen.next;
      return (
        <CreatorScreen
          services={services}
          next={next}
          onDone={() => (next ? setScreen({ name: "loading", target: next }) : showTitle())}
          onBack={() => showTitle()}
        />
      );
    }
    case "loading":
      return (
        <LoadingScreen
          target={screen.target}
          services={services}
          onEnter={enterWorld}
          onError={(error) => showTitle(error)}
          onCancel={() => showTitle()}
        />
      );
    case "playing":
      return <GameScreen loaded={screen.loaded} services={services} onExit={() => showTitle()} />;
  }
}
