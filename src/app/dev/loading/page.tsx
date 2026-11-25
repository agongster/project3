"use client";

/**
 * Bug Catch test page (/dev/loading): the loading mini-game on its own, big.
 *
 *   /dev/loading?theme=sakura        pick the scenery theme (default meadow)
 *   /dev/loading?hat=beanie          put a hat on the hero
 *   /dev/loading?look=42             a random hero look from a seed (default: the starter look)
 *
 * In development `window.__bugCatch` holds the live sim state, so scripts can
 * read the score, the hero position or the falling bugs.
 */
import { use, useState } from "react";
import Link from "next/link";
import LoadingGame from "@/components/loading/LoadingGame";
import { MAX_LOADING_BONUS } from "@/components/loading/types";
import { randomLook } from "@/game/art";
import { createAudio } from "@/game/audio";
import type { AudioApi } from "@/game/bridge";
import { THEMES } from "@/lib/game/catalog";
import { defaultSave } from "@/lib/game/store";
import type { ThemeId } from "@/lib/types";

// The real audio engine is created on first use (never during server rendering).
let realAudio: AudioApi | null = null;
function audioEngine(): AudioApi {
  if (!realAudio) realAudio = createAudio();
  return realAudio;
}
const audio: AudioApi = {
  unlock: () => audioEngine().unlock(),
  sfx: (name, opts) => audioEngine().sfx(name, opts),
  music: (track) => audioEngine().music(track),
  setTheme: (theme) => audioEngine().setTheme(theme),
  setVolumes: (sfx, music) => audioEngine().setVolumes(sfx, music),
};

type SearchParams = Record<string, string | string[] | undefined>;

function param(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

export default function LoadingGameTestPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = use(searchParams);
  const themeParam = param(sp, "theme");
  const theme: ThemeId = THEMES.find((t) => t.id === themeParam)?.id ?? "meadow";
  const lookSeed = param(sp, "look");
  const look = lookSeed ? randomLook(Number(lookSeed) || 0) : defaultSave().look;
  const hatId = param(sp, "hat") ?? null;

  const [score, setScore] = useState(0);
  const [paused, setPaused] = useState(false);
  const [round, setRound] = useState(0);

  const restart = () => {
    setScore(0);
    setRound((r) => r + 1);
  };

  return (
    <main className="min-h-screen bg-[#1b1630] p-6 text-white">
      <div className="mx-auto flex max-w-[980px] flex-col gap-4">
        <header className="flex flex-wrap items-center gap-3">
          <h1 className="font-title text-sm">Bug Catch</h1>
          <span className="text-white/60">score</span>
          <span data-testid="score" className="font-title text-sm text-[#ffd84a]">
            {score}
          </span>
          <span className="text-white/60">→ {Math.min(score, MAX_LOADING_BONUS)} bonus coins</span>
          <span className="flex-1" />
          <button className="px-btn" onClick={() => setPaused((p) => !p)}>
            {paused ? "Resume" : "Pause"}
          </button>
          <button className="px-btn" onClick={restart}>
            Restart
          </button>
        </header>

        <nav className="flex flex-wrap gap-2 text-sm">
          {THEMES.map((t) => (
            <Link
              key={t.id}
              href={`?theme=${t.id}${hatId ? `&hat=${hatId}` : ""}${lookSeed ? `&look=${lookSeed}` : ""}`}
              className={`rounded px-2 py-1 ${t.id === theme ? "bg-white/25" : "bg-white/10 hover:bg-white/20"}`}
            >
              {t.name}
            </Link>
          ))}
        </nav>

        <LoadingGame
          key={round}
          className="w-full"
          audio={audio}
          look={look}
          hatId={hatId}
          theme={theme}
          paused={paused}
          onScore={setScore}
        />

        <p className="text-sm text-white/60">
          ←/→ or A/D to run, or move the mouse over the game. Golden bugs are worth 5. Catch a heart for a big net.
          <input className="px-input ml-3 w-48" placeholder="typing here must not move the hero" />
        </p>
      </div>
    </main>
  );
}
