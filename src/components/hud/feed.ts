/**
 * The HUD's "news feed": short toasts on the right ("Unused import subdued!
 * +3") and big centre banners ("DUNGEON PURIFIED!").
 *
 * It is a tiny store outside React (like the save and HUD stores) so the game
 * screen can push messages from anywhere — event handlers, store
 * subscriptions, effects — and the toast/banner components just render it.
 * Timers that remove old messages live here too. They are never cancelled on
 * purpose: they only touch this feed, and after the game screen closes they
 * simply run out within a few seconds.
 */
import { createStore } from "@/lib/game";
import type { MonsterKind, Store } from "@/lib/types";

/** Most toasts on screen at once; a new one pushes the oldest out. */
export const MAX_TOASTS = 4;
/** How long a toast stays, including its fade-out. */
export const TOAST_LIFETIME_MS = 3000;
/** The last part of a toast's life, spent fading out. */
export const TOAST_FADE_MS = 300;
/** How long each banner stays; banners that arrive together are shown one after another. */
export const BANNER_LIFETIME_MS = 2600;

export type ToastTone = "info" | "good" | "warn";

/** A picture at the start of a toast. Plain data, so the feed never touches canvases. */
export type ToastIcon = { type: "monster"; kind: MonsterKind } | { type: "coin" } | { type: "star" };

export interface Toast {
  id: number;
  text: string;
  /** Optional smaller second line, e.g. the rule code. */
  detail?: string;
  tone: ToastTone;
  icon?: ToastIcon;
  /** Shows "+N" with a coin. */
  coins?: number;
  /** True during the final TOAST_FADE_MS. */
  leaving: boolean;
}

export interface Banner {
  id: number;
  title: string;
  subtitle?: string;
  /** Picks the banner's colours ("forge": back from the Workshop; "quiet": monsters subdued, lines to fix). */
  tone: "purify" | "level" | "forge" | "quiet";
}

export interface FeedState {
  toasts: Toast[];
  /** Waiting banners; the first one is on screen. */
  banners: Banner[];
}

export interface Feed {
  store: Store<FeedState>;
  toast(toast: Omit<Toast, "id" | "leaving">): void;
  banner(banner: Omit<Banner, "id">): void;
}

export function createFeed(): Feed {
  const store = createStore<FeedState>({ toasts: [], banners: [] });
  let nextId = 1;

  function updateToast(id: number, change: (toast: Toast) => Toast | null): void {
    store.set((state) => ({
      ...state,
      toasts: state.toasts.flatMap((toast) => {
        if (toast.id !== id) return [toast];
        const next = change(toast);
        return next ? [next] : [];
      }),
    }));
  }

  function toast(input: Omit<Toast, "id" | "leaving">): void {
    const id = nextId++;
    store.set((state) => ({ ...state, toasts: [...state.toasts, { ...input, id, leaving: false }].slice(-MAX_TOASTS) }));
    setTimeout(() => updateToast(id, (t) => ({ ...t, leaving: true })), TOAST_LIFETIME_MS - TOAST_FADE_MS);
    setTimeout(() => updateToast(id, () => null), TOAST_LIFETIME_MS);
  }

  /** Starts the clock on whichever banner is now first in line. */
  function showNextBanner(): void {
    if (store.get().banners.length === 0) return;
    setTimeout(() => {
      store.set((state) => ({ ...state, banners: state.banners.slice(1) }));
      showNextBanner();
    }, BANNER_LIFETIME_MS);
  }

  function banner(input: Omit<Banner, "id">): void {
    const wasIdle = store.get().banners.length === 0;
    store.set((state) => ({ ...state, banners: [...state.banners, { ...input, id: nextId++ }] }));
    if (wasIdle) showNextBanner();
  }

  return { store, toast, banner };
}
