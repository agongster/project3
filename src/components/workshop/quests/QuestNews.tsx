"use client";

/**
 * Celebrates what `settleQuests` just did: toasts slide in on the right for
 * completed quests, clean-forge streaks and level-ups, and each new
 * achievement gets a big banner at the top, with the matching sound.
 *
 * Hand it the `news` list of the latest settleQuests result (a new array
 * each time; an empty one shows nothing). It is drawn in fixed position, so
 * it can sit anywhere in the page.
 */
import { useEffect, useRef, useState } from "react";
import type { AudioApi } from "@/game/bridge";
import type { QuestNewsItem } from "@/lib/game/questsSettle";
import { useStore } from "@/lib/game/useStore";
import { ArtIcon } from "./ArtIcon";
import { createNewsFeed, NEWS_SOUND_GAP_MS, soundsFor } from "./newsFeed";
import type { NewsBanner, NewsToast } from "./newsFeed";
import { RewardChip } from "./QuestCard";
import "./quests.css";
import "./news.css";

/** Pitch rises a little with each step of a streak, up to this many steps. */
const MAX_PITCHED_STREAK = 8;
const PITCH_PER_STREAK = 0.06;

interface QuestNewsProps {
  news: readonly QuestNewsItem[];
  audio: AudioApi;
}

/** Plays the batch's sounds: the most exciting now, a second one a moment later. */
function playSounds(news: readonly QuestNewsItem[], audio: AudioApi): void {
  const streak = news.find((item) => item.type === "streak");
  const pitch = streak?.type === "streak" ? 1 + PITCH_PER_STREAK * Math.min(streak.streak, MAX_PITCHED_STREAK) : 1;
  soundsFor(news).forEach((sound, index) => {
    const play = () => audio.sfx(sound, sound === "coin" ? { pitch } : undefined);
    if (index === 0) play();
    else setTimeout(play, NEWS_SOUND_GAP_MS * index);
  });
}

function Toast({ toast }: { toast: NewsToast }) {
  return (
    <div className={`qst-toast ${toast.leaving ? "qst-leaving" : "qst-toast-in"}`} data-tone={toast.tone}>
      <ArtIcon icon={toast.icon} box={32} />
      <span className="min-w-0 flex-1">
        <span className="qst-toast-head">{toast.head}</span>
        <span className="qst-toast-text qst-wrap">{toast.text}</span>
      </span>
      {toast.reward && <RewardChip reward={toast.reward} />}
    </div>
  );
}

function Banner({ banner }: { banner: NewsBanner }) {
  return (
    <div className="qst-banner-wrap" role="status">
      <div key={banner.id} className="qst-banner qst-banner-in">
        <ArtIcon icon={banner.achievement.icon} box={48} className="qst-shine" />
        <span className="min-w-0">
          <span className="qst-banner-head">Achievement unlocked</span>
          <span className="qst-banner-title font-title">{banner.achievement.title}</span>
          <span className="qst-banner-how">{banner.achievement.how}</span>
          <RewardChip reward={banner.reward} />
        </span>
      </div>
    </div>
  );
}

export function QuestNews({ news, audio }: QuestNewsProps) {
  const [feed] = useState(createNewsFeed);
  /** The last list shown, so a re-render (or a new `audio` object) never repeats it. */
  const shown = useRef<readonly QuestNewsItem[] | null>(null);

  useEffect(() => {
    if (shown.current === news) return;
    shown.current = news;
    if (news.length === 0) return;
    feed.push(news);
    playSounds(news, audio);
  }, [news, audio, feed]);

  const toasts = useStore(feed.store, (state) => state.toasts);
  const banner = useStore(feed.store, (state) => state.banners[0] ?? null);

  return (
    <>
      {banner && <Banner banner={banner} />}
      <div className="qst-news" aria-live="polite">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} />
        ))}
      </div>
    </>
  );
}
