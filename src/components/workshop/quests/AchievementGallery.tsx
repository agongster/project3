"use client";

/**
 * The achievement gallery, folded away under a "Achievements 3 / 16" bar.
 * Earned badges are bright; the others are silhouettes with the hint on how
 * to earn them, so the gallery doubles as a list of things to try.
 */
import { useState } from "react";
import { ACHIEVEMENTS } from "@/lib/game/achievements";
import { ArtIcon } from "./ArtIcon";

/** Size of each badge's picture, in CSS pixels. */
const BADGE_BOX = 32;

export function AchievementGallery({ earned }: { earned: readonly string[] }) {
  const [open, setOpen] = useState(false);
  const have = new Set(earned);
  const count = ACHIEVEMENTS.filter((achievement) => have.has(achievement.id)).length;

  return (
    <section>
      <button type="button" className="qst-gallery-toggle" aria-expanded={open} onClick={() => setOpen((wasOpen) => !wasOpen)}>
        <span>Achievements</span>
        <span className="qst-head-count">
          {count} / {ACHIEVEMENTS.length}
        </span>
        <span className="qst-chevron" aria-hidden>
          ▸
        </span>
      </button>
      {open && (
        <ul className="qst-gallery" style={{ marginTop: 8 }}>
          {ACHIEVEMENTS.map((achievement) => {
            const isEarned = have.has(achievement.id);
            return (
              <li key={achievement.id} className="qst-badge" data-earned={isEarned}>
                <ArtIcon icon={achievement.icon} box={BADGE_BOX} silhouette={!isEarned} />
                <span className="min-w-0">
                  <span className="qst-badge-title">{achievement.title}</span>
                  <span className="qst-badge-how">{achievement.how}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
