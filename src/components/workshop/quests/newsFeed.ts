/**
 * What the QuestNews component shows for the news `settleQuests` returns: small toasts down
 * the right (quest complete, clean-forge streak, level up) and one big banner
 * at a time for each achievement, plus the sound each kind of news makes.
 *
 * Like the HUD's feed (src/components/hud/feed.ts) it is a tiny store
 * outside React, so the timers that remove old toasts live here and not in
 * effects. They are never cancelled on purpose: they only touch this feed
 * and run out within a few seconds after the Workshop closes.
 */
import type { SfxName } from "@/game/bridge";
import type { Achievement, AchievementIcon } from "@/lib/game/achievements";
import type { QuestReward } from "@/lib/game/quests";
import type { QuestNewsItem } from "@/lib/game/questsSettle";
import { createStore } from "@/lib/game/store";
import type { Store } from "@/lib/types";
import { LEVEL_ICON, STREAK_ICON, questIcon } from "./icons";

/** Most toasts on screen at once; a new one pushes the oldest out. */
export const MAX_NEWS_TOASTS = 4;
/** How long a toast stays, including its fade-out. */
export const NEWS_TOAST_MS = 4200;
/** The last part of a toast's life, spent fading out. */
export const NEWS_FADE_MS = 300;
/** How long an achievement banner stays… */
export const NEWS_BANNER_MS = 3200;
/** …or, when more banners wait behind it, this long, so a burst of badges doesn't take all day. */
export const NEWS_BANNER_QUEUED_MS = 1800;
/** Streaks are announced from this length on (the first clean forge already has the forge summary). */
export const MIN_STREAK_TO_ANNOUNCE = 2;
/** When news brings two different sounds, the second one plays this much later. */
export const NEWS_SOUND_GAP_MS = 450;

export interface NewsToast {
  id: number;
  /** Picks the toast's colours. */
  tone: "quest" | "streak" | "calm" | "level";
  head: string;
  text: string;
  icon: AchievementIcon;
  reward?: QuestReward;
  /** True during the final NEWS_FADE_MS. */
  leaving: boolean;
}

export interface NewsBanner {
  id: number;
  achievement: Achievement;
  reward: QuestReward;
}

export interface NewsFeedState {
  toasts: NewsToast[];
  /** Waiting banners; the first one is on screen. */
  banners: NewsBanner[];
}

/** The toast a piece of news becomes, or null when it gets a banner or is not worth a toast. */
export function toastFor(item: QuestNewsItem): Omit<NewsToast, "id" | "leaving"> | null {
  switch (item.type) {
    case "quest":
      return { tone: "quest", head: "Quest complete!", text: item.quest.title, icon: questIcon(item.quest), reward: item.quest.reward };
    case "streak":
      if (item.streak < MIN_STREAK_TO_ANNOUNCE) return null;
      return { tone: "streak", head: `Clean forge ×${item.streak}`, text: "Fixed, and not one new bug. Keep it up!", icon: STREAK_ICON, reward: item.reward };
    case "streakLost":
      if (item.streak < MIN_STREAK_TO_ANNOUNCE) return null;
      return { tone: "calm", head: `Streak ×${item.streak} reset`, text: "A new bug slipped in. No harm done: it is just a new monster.", icon: STREAK_ICON };
    case "levelUp":
      return { tone: "level", head: "Level up!", text: `Level ${item.level}: ${item.title}`, icon: LEVEL_ICON };
    case "achievement":
      return null;
  }
}

/** The sound each kind of news makes, most exciting first. */
const SOUND_ORDER: readonly { type: QuestNewsItem["type"]; sound: SfxName }[] = [
  { type: "achievement", sound: "revealEpic" },
  { type: "levelUp", sound: "levelUp" },
  { type: "quest", sound: "revealRare" },
  { type: "streak", sound: "coin" },
  { type: "streakLost", sound: "uiBack" },
];

/** The (at most two) sounds a batch of news should make, most exciting first. Quiet news makes none. */
export function soundsFor(news: readonly QuestNewsItem[]): SfxName[] {
  const loud = news.filter((item) => item.type === "achievement" || toastFor(item) !== null);
  return SOUND_ORDER.filter((entry) => loud.some((item) => item.type === entry.type))
    .map((entry) => entry.sound)
    .slice(0, 2);
}

export interface NewsFeed {
  store: Store<NewsFeedState>;
  /** Shows one batch of news from settleQuests. */
  push(news: readonly QuestNewsItem[]): void;
}

export function createNewsFeed(): NewsFeed {
  const store = createStore<NewsFeedState>({ toasts: [], banners: [] });
  let nextId = 1;

  function updateToast(id: number, change: (toast: NewsToast) => NewsToast | null): void {
    store.set((state) => ({
      ...state,
      toasts: state.toasts.flatMap((toast) => {
        if (toast.id !== id) return [toast];
        const next = change(toast);
        return next ? [next] : [];
      }),
    }));
  }

  function addToast(input: Omit<NewsToast, "id" | "leaving">): void {
    const id = nextId++;
    store.set((state) => ({ ...state, toasts: [...state.toasts, { ...input, id, leaving: false }].slice(-MAX_NEWS_TOASTS) }));
    setTimeout(() => updateToast(id, (toast) => ({ ...toast, leaving: true })), NEWS_TOAST_MS - NEWS_FADE_MS);
    setTimeout(() => updateToast(id, () => null), NEWS_TOAST_MS);
  }

  /** Starts the clock on whichever banner is now first in line. */
  function showNextBanner(): void {
    const waiting = store.get().banners.length;
    if (waiting === 0) return;
    setTimeout(
      () => {
        store.set((state) => ({ ...state, banners: state.banners.slice(1) }));
        showNextBanner();
      },
      waiting > 1 ? NEWS_BANNER_QUEUED_MS : NEWS_BANNER_MS,
    );
  }

  function push(news: readonly QuestNewsItem[]): void {
    const wasIdle = store.get().banners.length === 0;
    for (const item of news) {
      if (item.type === "achievement") {
        const banner = { id: nextId++, achievement: item.achievement, reward: item.reward };
        store.set((state) => ({ ...state, banners: [...state.banners, banner] }));
      } else {
        const toast = toastFor(item);
        if (toast) addToast(toast);
      }
    }
    if (wasIdle) showNextBanner();
  }

  return { store, push };
}
