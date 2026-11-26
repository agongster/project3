"use client";

/**
 * The title screen: logo, "which repo?" form, the hero card and the scenery
 * picker, all over a living village backdrop in the chosen theme. Failed
 * analyses come back here and are explained in an error panel.
 */
import { ThemePicker } from "@/components/character/ThemePicker";
import { PixelPanel } from "@/components/ui/kit";
import { useMusic } from "@/components/app/audioHooks";
import { DEMO_TARGET, type FlowError, type WorldTarget } from "@/components/app/flow";
import type { AppServices } from "@/components/app/services";
import { setTheme } from "@/lib/game";
import { useStore } from "@/lib/game/useStore";
import { ErrorPanel } from "./title/ErrorPanel";
import { HeroCard } from "./title/HeroCard";
import { Logo } from "./title/Logo";
import { recentTargets } from "./title/recentRepos";
import { RepoForm } from "./title/RepoForm";
import { SoundToggle } from "./title/SoundToggle";
import { TitleBackdrop } from "./title/TitleBackdrop";

interface Props {
  services: AppServices;
  error: FlowError | null;
  onStart: (target: WorldTarget) => void;
  onEditHero: () => void;
  onDismissError: () => void;
}

export function TitleScreen({ services, error, onStart, onEditHero, onDismissError }: Props) {
  const { save, audio } = services;
  const theme = useStore(save, (s) => s.theme);
  const look = useStore(save, (s) => s.look);
  const hatId = useStore(save, (s) => s.equipped.hat);
  const repoKeys = useStore(save, (s) => Object.keys(s.repos));

  useMusic(audio, "title");

  return (
    <main className="relative h-full w-full overflow-hidden">
      <TitleBackdrop theme={theme} />

      <div className="absolute inset-0 flex flex-col items-center gap-3 overflow-y-auto px-4 py-4">
        {/* my-auto centres the menu vertically on tall windows and lets it scroll on tiny ones. */}
        <div className="my-auto flex w-full max-w-[1080px] flex-col items-center gap-3">
          <Logo look={look} hatId={hatId} />

          <div className="grid w-full grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,470px)]">
            <PixelPanel className="anim-slide-up p-5">
              <RepoForm audio={audio} recent={recentTargets(repoKeys)} onSubmit={onStart} onDemo={() => onStart(DEMO_TARGET)} />
            </PixelPanel>

            <div className="anim-slide-up flex flex-col gap-3" style={{ animationDelay: "80ms" }}>
              <HeroCard save={save} audio={audio} onEdit={onEditHero} />
              <PixelPanel tone="dark" className="px-3 pb-3 pt-2">
                <h2 className="mb-1 font-bold text-cream">Scenery</h2>
                <ThemePicker value={theme} onChange={(id) => save.set((s) => setTheme(s, id))} audio={audio} previewScale={2} columns={3} />
              </PixelPanel>
            </div>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-center gap-3 text-[14px] text-cream/85">
          <span className="bg-night/70 px-2 py-0.5">Python files only · public repos · your code is analysed in your own browser with Ruff</span>
          <span className="bg-night/70 px-2 py-0.5">In the world, the Workshop (F) lets you fix the code itself too.</span>
          <SoundToggle save={save} audio={audio} />
        </footer>
      </div>

      {error && (
        <ErrorPanel
          error={error}
          audio={audio}
          onClose={onDismissError}
          onRetry={() => onStart(error.target)}
          onDemo={() => onStart(DEMO_TARGET)}
          onPick={onStart}
        />
      )}
    </main>
  );
}
