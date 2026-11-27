"use client";

/**
 * The forge streak: "×3" with a row of pips (lit up to the "Steady Hands"
 * achievement), and what the next clean forge would pay.
 */
import { ACHIEVEMENT_GOALS } from "@/lib/game/achievements";
import { streakBonus } from "@/lib/game/questsStreak";
import type { WorkshopProgress } from "@/lib/game/questsTypes";

/** One pip per clean forge up to the long-streak achievement. */
const STREAK_PIPS = ACHIEVEMENT_GOALS.longStreak;

function streakHint(streak: number, best: number): string {
  if (streak === 0) return best > 0 ? `Best ever ×${best}. Save a fix that adds no new bug to start again.` : "Save a fix that adds no new bug to start one.";
  const next = streakBonus(streak + 1);
  return `Next clean save: +${next} bonus coins${best > streak ? ` · best ×${best}` : ""}`;
}

export function StreakMeter({ workshop }: { workshop: WorkshopProgress | undefined }) {
  const streak = workshop?.streak ?? 0;
  const best = workshop?.bestStreak ?? 0;
  return (
    <div className="qst-streak" data-active={streak > 0} aria-label={`Clean save streak: ${streak}`}>
      <span className="qst-streak-count font-title">×{streak}</span>
      <div className="qst-streak-body">
        <span className="qst-streak-title">{streak > 0 ? "Clean save streak" : "No streak yet"}</span>
        <div className="qst-pips" aria-hidden>
          {Array.from({ length: STREAK_PIPS }, (_, i) => (
            <span key={i} className="qst-pip" data-lit={i < streak} />
          ))}
        </div>
        <span className="qst-streak-hint">{streakHint(streak, best)}</span>
      </div>
    </div>
  );
}
