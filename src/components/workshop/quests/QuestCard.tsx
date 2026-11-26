"use client";

/**
 * One quest pinned to the board: what to do and where (a button that opens
 * the file at the right line), what it pays, how far along it is, and a
 * DONE! stamp in place of the button once the job is finished. Also the
 * small reward chip (coins and XP) shared with the news toasts.
 */
import { PixelBar, PixelButton } from "@/components/ui/kit";
import { clipPath } from "@/lib/analysis/repoText";
import { QUEST_KIND_LABELS } from "@/lib/game/quests";
import type { Quest, QuestReward, QuestTarget } from "@/lib/game/quests";
import { ArtIcon } from "./ArtIcon";
import { COIN_ICON, XP_ICON, questIcon } from "./icons";

/** The "Go to …" button names the file (clipped from the left, so the file name stays). */
const MAX_GO_LABEL = 28;
/** Size of the quest's picture, in CSS pixels. */
const ICON_BOX = 32;
/** Size of the coin and XP gem next to a reward. */
const REWARD_ICON_BOX = 16;

/** "recipes.py:3", or the whole path when it is short. */
function goLabel(target: QuestTarget): string {
  const where = clipPath(target.path, MAX_GO_LABEL);
  return target.line ? `${where}:${target.line}` : where;
}

export function RewardChip({ reward }: { reward: QuestReward }) {
  return (
    <span className="qst-reward" aria-label={`Reward: ${reward.coins} coins and ${reward.xp} XP`}>
      {reward.coins > 0 && (
        <span className="qst-reward-coins">
          <ArtIcon icon={COIN_ICON} box={REWARD_ICON_BOX} /> +{reward.coins}
        </span>
      )}
      {reward.xp > 0 && (
        <span className="qst-reward-xp">
          <ArtIcon icon={XP_ICON} box={REWARD_ICON_BOX} /> +{reward.xp}
        </span>
      )}
    </span>
  );
}

interface QuestCardProps {
  quest: Quest;
  onOpenFile: (path: string, line?: number) => void;
}

export function QuestCard({ quest, onOpenFile }: QuestCardProps) {
  const { target, progress } = quest;
  const steps = progress.current !== undefined && progress.goal !== undefined ? { current: progress.current, goal: progress.goal } : null;

  return (
    <li className="qst-card" data-kind={quest.kind} data-done={progress.done}>
      <div className="qst-card-top">
        <ArtIcon icon={questIcon(quest)} box={ICON_BOX} />
        <span className="qst-kind">{QUEST_KIND_LABELS[quest.kind]}</span>
        <RewardChip reward={quest.reward} />
      </div>
      <p className="qst-title qst-wrap">{quest.title}</p>
      <p className="qst-desc qst-wrap">{quest.description}</p>
      {steps && (
        <div className="qst-progress">
          <PixelBar value={steps.goal === 0 ? 1 : steps.current / steps.goal} color="var(--qst-accent)" label="Quest progress" />
          <span>
            {steps.current} / {steps.goal}
          </span>
        </div>
      )}
      <div className="qst-card-foot">
        {progress.done ? (
          <span className="qst-stamp qst-stamp-in font-title">DONE!</span>
        ) : (
          <PixelButton tone="sky" small className="qst-go" title={target.path} onClick={() => onOpenFile(target.path, target.line)}>
            <span>Go to {goLabel(target)}</span>
          </PixelButton>
        )}
      </div>
    </li>
  );
}
