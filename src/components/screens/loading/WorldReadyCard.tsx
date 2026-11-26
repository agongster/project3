"use client";

/**
 * The "Your world is ready!" card. It appears under the mini-game instead of
 * yanking the player out of it, teases what the world holds, and waits for
 * the player to click "Enter the Lintlands" (or press Enter).
 */
import { useEffect, useEffectEvent } from "react";
import { KeyCap, PixelButton, PixelPanel } from "@/components/ui/kit";
import type { RepoAnalysis } from "@/lib/types";
import { isTrivialInit } from "@/lib/worldgen/regions";

/** "1 boss" / "3 bosses": English plurals that are not just "+s". */
function count(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

/** The one-line teaser, e.g. "42 files · 17 bugs · 3 bosses · 12 treasure houses". */
export function worldTeaser(analysis: RepoAnalysis): string {
  const { stats } = analysis;
  // A clean file becomes a treasure house, except a near-empty `__init__.py` (only a lantern on the map).
  const treasureHouses = analysis.files.filter((file) => file.status === "ok" && file.findings.length === 0 && !isTrivialInit(file)).length;
  return [
    count(stats.fileCount, "file"),
    count(stats.findingCount, "bug"),
    count(stats.bySeverity.boss, "boss", "bosses"),
    count(treasureHouses, "treasure house"),
  ].join(" · ");
}

interface Props {
  analysis: RepoAnalysis;
  bonusCoins: number;
  onEnter: () => void;
}

export function WorldReadyCard({ analysis, bonusCoins, onEnter }: Props) {
  const enter = useEffectEvent(onEnter);

  // Enter works from anywhere on the page (the mini-game only uses arrows / A / D).
  // preventDefault stops a focused button from also turning the same Enter into a click.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" && !event.repeat) {
        event.preventDefault();
        enter();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <PixelPanel className="anim-pop flex w-full max-w-[960px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-3">
      <div className="min-w-0 flex-1">
        <h2 className="font-title text-[18px] leading-tight text-leaf-deep">Your world is ready!</h2>
        <p className="mt-2 font-semibold">{worldTeaser(analysis)}</p>
        <p className="text-ink-soft">
          {bonusCoins > 0 ? `+${bonusCoins} bonus coins from Bug Catch` : "Keep catching bugs for bonus coins, or dive right in."}
          {analysis.warnings.length > 0 && ` · ${analysis.warnings.join(" · ")}`}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        {/* The bob lives on a wrapper so the button keeps its own hover / press movement. */}
        <div className="anim-bob">
          <PixelButton tone="gold" className="text-[22px]" onClick={onEnter}>
            Enter the Lintlands ▶
          </PixelButton>
        </div>
        <p className="text-[14px] text-ink-soft">
          or press <KeyCap>Enter</KeyCap>
        </p>
      </div>
    </PixelPanel>
  );
}
