"use client";

/**
 * Every dungeon cleared: confetti, the hero doing a happy spin, the final
 * stats, a report card for the repo, and one last nudge toward the real
 * takeaway: copy the to-do list and go fix the bugs for real.
 */
import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { Modal, PixelButton } from "@/components/ui/kit";
import { getProgress, levelForXp, repoHealth } from "@/lib/game";
import { useStore } from "@/lib/game/useStore";
import { reportCard } from "./parts/boardData";
import { Confetti } from "./parts/Confetti";
import { CopyChecklistButton } from "./parts/CopyChecklistButton";
import { FX } from "./parts/fx";
import { GradeBadge, GRADE_INFO } from "./parts/GradeBadge";
import { useTicker } from "./parts/hooks";
import { PANEL_MEDIUM } from "./parts/panelSizes";
import { PixelSprite } from "./parts/PixelSprite";
import { heroSprite, petFrame } from "./parts/sprites";
import type { Facing } from "./parts/sprites";
import type { OverlayProps } from "./types";

/** The hero turns on the spot: a little victory twirl. */
const TWIRL: readonly Facing[] = ["down", "left", "up", "right"];
const TWIRL_MS = 260;
const HERO_SCALE = 4;
const PET_SCALE = 2;
const GOLD_RAYS = { "--fx-color": "var(--color-gold)", "--rays-size": "340px" } as CSSProperties;

export default function VictoryOverlay({ ctx }: OverlayProps<"victory">) {
  const { analysis, audio } = ctx;
  const save = useStore(ctx.save, (state) => state);
  const progress = getProgress(save, ctx.repoKey);
  const health = repoHealth(analysis, progress);
  const level = levelForXp(save.xp);
  const card = reportCard(analysis);
  const tick = useTicker(TWIRL_MS);

  // One fanfare when the screen appears (the ref stops React's dev-mode double effect from playing it twice).
  const played = useRef(false);
  useEffect(() => {
    if (played.current) return;
    played.current = true;
    audio.sfx("victory");
  }, [audio]);

  const stats = [
    { value: `${health.defeated}/${health.total}`, label: "bugs squashed" },
    { value: `${health.dungeonsCleared}/${health.dungeonsTotal}`, label: "dungeons purified" },
    { value: `${health.chestsOpened}/${health.chestsTotal}`, label: "chests opened" },
    { value: save.coins.toLocaleString(), label: "coins saved up" },
  ];

  return (
    <Modal label="Victory" onClose={ctx.close} className={PANEL_MEDIUM}>
      <Confetti />
      <header className="text-center">
        <h2 className="font-title text-xl text-gold [text-shadow:0_3px_0_var(--color-ink)]">THE LAND IS PURE!</h2>
        <p className="mt-1 font-bold">
          Every monster in {analysis.repo.owner}/{analysis.repo.repo} has been squashed. Hooray!
        </p>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[200px_minmax(0,1fr)] gap-4">
        <div className="px-panel dark relative flex flex-col items-center justify-center gap-1 overflow-hidden">
          <span aria-hidden="true" className={FX.rays} style={GOLD_RAYS} />
          <div className="anim-bob relative flex items-end gap-1">
            <PixelSprite sprite={heroSprite(save.look, save.equipped.hat, TWIRL[tick % TWIRL.length], 0)} scale={HERO_SCALE} label={save.look.name} />
            {save.equipped.pet && <PixelSprite sprite={petFrame(save.equipped.pet, tick)} scale={PET_SCALE} />}
          </div>
        </div>

        <div className="px-scroll flex min-h-0 min-w-0 flex-col justify-center-safe gap-2 pr-1">
          <dl className="grid grid-cols-2 gap-2">
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-baseline gap-2 bg-cream-deep/70 px-3 py-1">
                <dd className="font-title shrink-0 text-sm tabular-nums">{stat.value}</dd>
                <dt className="min-w-0 truncate text-sm">{stat.label}</dt>
              </div>
            ))}
            <div className="col-span-2 flex items-baseline gap-2 bg-cream-deep/70 px-3 py-1">
              <dd className="font-title shrink-0 text-sm">Lv {level.level}</dd>
              <dt className="min-w-0 truncate text-sm">
                {save.look.name} the {level.title}
              </dt>
            </div>
          </dl>
          <div className="flex items-center gap-3 bg-cream-deep/70 p-2">
            <GradeBadge grade={card.grade} size="md" />
            <div className="text-sm leading-snug">
              <p className="font-bold">
                Repo report card: {card.grade} ({GRADE_INFO[card.grade].word})
              </p>
              <p>
                The average code-quality grade of all {card.fileCount} files: {card.points} on a scale where S = 4, A = 3, B = 2, C = 1.
              </p>
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-sm font-bold">The monsters are gone, but the bugs are still in the code. Now go fix them for real!</p>
      <footer className="flex flex-wrap items-start justify-center gap-2">
        <CopyChecklistButton analysis={analysis} progress={progress} onCopied={() => audio.sfx("uiSelect")} />
        <PixelButton tone="leaf" onClick={ctx.close}>
          Keep exploring
        </PixelButton>
        <PixelButton tone="grape" onClick={ctx.exitToTitle}>
          Try another repo
        </PixelButton>
      </footer>
    </Modal>
  );
}
