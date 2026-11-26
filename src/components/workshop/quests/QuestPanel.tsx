"use client";

/**
 * The quest board for the repo being edited: the forge streak, the posted
 * quests (each with a "Go to …" button), the last few completed ones, and
 * the achievement gallery. It only reads the save; quests are paid by
 * `settleQuests` (src/lib/game/questsSettle.ts), which the game calls after
 * every forge and every other change, so this panel simply follows along.
 *
 * Fits a side panel about 320 px wide (one column of notes) and spreads
 * into two or three columns in a wider area.
 */
import { useMemo } from "react";
import { PixelPanel } from "@/components/ui/kit";
import { getProgress } from "@/lib/game/progress";
import { questBoard } from "@/lib/game/questsBoard";
import { useStore } from "@/lib/game/useStore";
import type { RepoAnalysis, SaveData, Store } from "@/lib/types";
import { AchievementGallery } from "./AchievementGallery";
import { ArtIcon } from "./ArtIcon";
import { CHECK_ICON } from "./icons";
import { QuestCard, RewardChip } from "./QuestCard";
import { StreakMeter } from "./StreakMeter";
import "./quests.css";

export interface QuestPanelProps {
  /** The repo as the code is now (the workspace's live analysis). */
  analysis: RepoAnalysis;
  save: Store<SaveData>;
  /** `owner/repo@sha` (see repoKey in src/game/bridge.ts). */
  repoKey: string;
  /** Opens a file in the editor, at a 1-based line when there is one. */
  onOpenFile: (path: string, line?: number) => void;
}

export function QuestPanel({ analysis, save, repoKey, onOpenFile }: QuestPanelProps) {
  const progress = useStore(save, (s) => getProgress(s, repoKey));
  const workshop = useStore(save, (s) => s.workshop);
  const board = useMemo(() => questBoard(progress, analysis), [progress, analysis]);
  const doneHere = progress.quests?.done.length ?? 0;
  // The newest completed quest stays pinned up with its DONE! stamp; older ones shrink to a line.
  const [latest, ...older] = [...board.recent].reverse();

  return (
    <PixelPanel tone="wood" className="qst-board">
      <header className="qst-head">
        <h2 className="font-title">Quest Board</h2>
        <span className="qst-head-count">
          {board.active.length} posted · {doneHere} done here
        </span>
      </header>

      <StreakMeter workshop={workshop} />

      {board.active.length === 0 ? (
        <p className="qst-desc" style={{ color: "var(--color-cream)" }}>
          No quests to post: this repo has no Python file the board can read.
        </p>
      ) : (
        <ul className="qst-list">
          {board.active.map((quest) => (
            <QuestCard key={quest.id} quest={quest} onOpenFile={onOpenFile} />
          ))}
        </ul>
      )}

      {latest && (
        <>
          <span className="qst-label">Completed</span>
          <ul className="qst-list">
            {/* Keyed, so a newly completed quest gets a fresh card and its stamp thumps down again. */}
            <QuestCard key={latest.id} quest={latest} onOpenFile={onOpenFile} />
          </ul>
          {older.length > 0 && (
            <ul className="qst-recent">
              {older.map((quest) => (
                <li key={quest.id}>
                  <ArtIcon icon={CHECK_ICON} box={16} />
                  <span className="qst-wrap">{quest.title}</span>
                  <RewardChip reward={{ coins: quest.reward.coins, xp: 0 }} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <AchievementGallery earned={workshop?.achievements ?? []} />
    </PixelPanel>
  );
}
