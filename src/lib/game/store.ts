/**
 * The save file.
 *
 * Three jobs live here:
 *   1. `createStore`: a tiny observable value. The save and the HUD both use it.
 *   2. `defaultSave` / `sanitizeSave`: what a brand-new save looks like, and how
 *      to turn *anything* found in localStorage (an older save, hand-edited
 *      JSON, plain garbage) into a save the rest of the game can trust without
 *      re-checking it.
 *   3. `createSaveStore`: the save as a Store that writes itself to localStorage.
 *
 * Nothing here changes a save. All game rules are pure functions in
 * actions.ts, gacha.ts and loot.ts; this file only creates, loads and stores.
 */
import {
  ACCESSORIES,
  ALL_ITEMS,
  EYE_STYLES,
  HAIR_COLORS,
  HAIR_STYLES,
  MAX_CHARMS,
  OUTFIT_COLORS,
  OUTFITS,
  SKIN_TONES,
  STARTER_WEAPON,
  THEMES,
  getItem,
} from "@/lib/game/catalog";
import { HEALTH_MILESTONES, MAX_SAVED_REPOS } from "@/lib/game/progress";
import type { CharacterLook, EquippedItems, ItemSlot, RepoProgress, SaveData, Store, ThemeId } from "@/lib/types";

// ─────────────────────────── Constants ───────────────────────────

/** localStorage key. The `v1` matches `SaveData.version`; a new save shape would get a new key. */
export const SAVE_STORAGE_KEY = "lintlands:save:v1";

/**
 * Writes are batched: the first change starts this timer and every change made
 * before it fires goes out in one write. Coins can be picked up many times a
 * second, and re-serializing the whole save for each one would be wasteful.
 */
export const SAVE_DEBOUNCE_MS = 300;

/** Coins and XP are clamped to this, so a hand-edited save can't hold Infinity or 1e308. */
export const MAX_COINS = 9_999_999;
export const MAX_XP = 9_999_999;

/** Lifetime counters (stats, wish counters) are clamped to this for the same reason. */
const MAX_COUNTER = 999_999_999;

/** Longest hero name, in characters (it is drawn above the player's head). */
export const MAX_NAME_LENGTH = 16;
export const DEFAULT_NAME = "Hero";

const DEFAULT_THEME: ThemeId = "meadow";

/** A friendly first look: brown hair, blue hoodie, sparkly eyes and a little blush. */
const DEFAULT_LOOK: CharacterLook = {
  name: DEFAULT_NAME,
  skin: 1,
  hairStyle: 0,
  hairColor: 1,
  outfit: 1,
  outfitColor: 5,
  eyes: 1,
  accessory: 2,
};

const DEFAULT_SETTINGS: SaveData["settings"] = { sfx: 0.7, music: 0.4, screenShake: true };

/** Starter items are owned from the very first second and can never be lost. */
const STARTER_ITEM_IDS: readonly string[] = ALL_ITEMS.filter((item) => item.starter).map((item) => item.id);

/** Each look field is an index into one of these option lists in catalog.ts. */
const LOOK_OPTIONS = {
  skin: SKIN_TONES,
  hairStyle: HAIR_STYLES,
  hairColor: HAIR_COLORS,
  outfit: OUTFITS,
  outfitColor: OUTFIT_COLORS,
  eyes: EYE_STYLES,
  accessory: ACCESSORIES,
} as const;

const VALID_MILESTONES: ReadonlySet<number> = new Set(HEALTH_MILESTONES.map((m) => m.percent));

// ───────────────────────── Observable store ─────────────────────────

/**
 * A tiny observable value. React reads it through `useStore`, the canvas
 * engine calls `get` / `set` directly, and neither needs to know about the other.
 *
 * `set` ignores a value identical (`Object.is`) to the current one, so the
 * reducers in actions.ts, which return the very same save when nothing
 * changed, don't wake any listener up.
 *
 * T must not itself be a function: a function passed to `set` is treated as
 * an updater `(prev) => next`.
 */
export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(next) {
      const value = typeof next === "function" ? (next as (prev: T) => T)(state) : next;
      if (Object.is(value, state)) return;
      state = value;
      // Loop over a copy so a listener may subscribe or unsubscribe while we notify.
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

// ─────────────────────────── New save ───────────────────────────

/** A brand-new save: no coins yet, the starter items owned, the Trusty Twig in hand. */
export function defaultSave(): SaveData {
  return {
    version: 1,
    created: false,
    look: { ...DEFAULT_LOOK },
    theme: DEFAULT_THEME,
    coins: 0,
    xp: 0,
    owned: [...STARTER_ITEM_IDS],
    equipped: { weapon: STARTER_WEAPON, hat: null, pet: null, trail: null, charms: [] },
    gacha: { totalPulls: 0, sinceEpic: 0, sinceLegendary: 0 },
    repos: {},
    settings: { ...DEFAULT_SETTINGS },
    stats: { bugsSquashed: 0, chestsOpened: 0, dungeonsCleared: 0, wishes: 0 },
  };
}

// ───────────────────────── Sanitizing ─────────────────────────
// Every helper below takes `unknown` and a fallback, and always returns a valid value.

type UnknownRecord = Record<string, unknown>;

/** Treats anything that is not a plain object as an empty object, so every field falls back to its default. */
function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as UnknownRecord) : {};
}

/** A whole number clamped into [min, max]; anything that is not a finite number becomes `fallback`. */
function toInt(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

/** A fraction clamped into [0, 1] (volumes). */
function toUnit(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

function toBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function toCounter(value: unknown): number {
  return toInt(value, 0, 0, MAX_COUNTER);
}

/** Only the strings of an array, duplicates removed, original order kept. */
function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry): entry is string => typeof entry === "string"))];
}

function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}

/**
 * Cleans a hero name: drops control characters, collapses whitespace and
 * clips it to MAX_NAME_LENGTH characters. Non-strings fall back to `fallback`;
 * a name that ends up empty becomes "Hero".
 */
export function sanitizeName(raw: unknown, fallback: string = DEFAULT_NAME): string {
  if (typeof raw !== "string") return fallback;
  // Array.from splits by code point, so an emoji is never cut in half.
  const printable = Array.from(raw).filter((ch) => ch >= " " && ch !== "\u007f");
  const tidy = printable.join("").replace(/\s+/g, " ").trim();
  return Array.from(tidy).slice(0, MAX_NAME_LENGTH).join("").trim() || DEFAULT_NAME;
}

/** A look whose every index points at a real option in catalog.ts. Bad indices are clamped into range. */
export function sanitizeLook(raw: unknown, fallback: CharacterLook = DEFAULT_LOOK): CharacterLook {
  const look = asRecord(raw);
  const index = (key: keyof typeof LOOK_OPTIONS): number =>
    toInt(look[key], fallback[key], 0, LOOK_OPTIONS[key].length - 1);
  return {
    name: sanitizeName(look.name, fallback.name),
    skin: index("skin"),
    hairStyle: index("hairStyle"),
    hairColor: index("hairColor"),
    outfit: index("outfit"),
    outfitColor: index("outfitColor"),
    eyes: index("eyes"),
    accessory: index("accessory"),
  };
}

/** Volumes clamped into 0–1, screen shake a real boolean. */
export function sanitizeSettings(
  raw: unknown,
  fallback: SaveData["settings"] = DEFAULT_SETTINGS,
): SaveData["settings"] {
  const settings = asRecord(raw);
  return {
    sfx: toUnit(settings.sfx, fallback.sfx),
    music: toUnit(settings.music, fallback.music),
    screenShake: toBool(settings.screenShake, fallback.screenShake),
  };
}

/** Known item ids only, no duplicates, and the starter items always present. */
function sanitizeOwned(raw: unknown): string[] {
  const owned = toStringList(raw).filter((id) => getItem(id) !== undefined);
  for (const starter of STARTER_ITEM_IDS) {
    if (!owned.includes(starter)) owned.push(starter);
  }
  return owned;
}

/** Equipped items must be owned and sit in the right slot; the weapon slot is never empty. */
function sanitizeEquipped(raw: unknown, owned: readonly string[]): EquippedItems {
  const equipped = asRecord(raw);
  const ownedSet = new Set(owned);
  const ownedInSlot = (id: unknown, slot: ItemSlot): id is string =>
    typeof id === "string" && ownedSet.has(id) && getItem(id)?.slot === slot;
  const optional = (id: unknown, slot: ItemSlot): string | null => (ownedInSlot(id, slot) ? id : null);

  return {
    weapon: ownedInSlot(equipped.weapon, "weapon") ? equipped.weapon : STARTER_WEAPON,
    hat: optional(equipped.hat, "hat"),
    pet: optional(equipped.pet, "pet"),
    trail: optional(equipped.trail, "trail"),
    // Charms are kept oldest → newest, so over the cap we keep the newest ones.
    charms: toStringList(equipped.charms)
      .filter((id) => ownedInSlot(id, "charm"))
      .slice(-MAX_CHARMS),
  };
}

function sanitizeProgress(raw: unknown): RepoProgress {
  const progress = asRecord(raw);
  const milestones = Array.isArray(progress.milestones) ? progress.milestones : [];
  return {
    defeated: toStringList(progress.defeated),
    cleared: toStringList(progress.cleared),
    opened: toStringList(progress.opened),
    milestones: [...new Set(milestones.filter((m): m is number => typeof m === "number" && VALID_MILESTONES.has(m)))],
  };
}

/** Keeps the MAX_SAVED_REPOS most recent repos (the last keys; see `withRepoProgress`). */
function sanitizeRepos(raw: unknown): Record<string, RepoProgress> {
  const entries = Object.entries(asRecord(raw))
    // "__proto__" is a legal JSON key but would be dangerous to copy onto a plain object.
    .filter(([key]) => key.length > 0 && key !== "__proto__")
    .slice(-MAX_SAVED_REPOS);
  return Object.fromEntries(entries.map(([key, value]) => [key, sanitizeProgress(value)]));
}

/**
 * Turns ANY value into a valid save, and never throws.
 *
 * Missing or malformed fields get their default; unknown item ids are dropped;
 * equipped items the player doesn't own are unequipped; numbers are clamped;
 * look indices are clamped into the catalog's option ranges; charms are capped
 * at MAX_CHARMS. A save that is already valid comes back deep-equal to itself,
 * so it is safe to run on every load.
 */
export function sanitizeSave(raw: unknown): SaveData {
  try {
    const save = asRecord(raw);
    const gacha = asRecord(save.gacha);
    const stats = asRecord(save.stats);
    const owned = sanitizeOwned(save.owned);
    return {
      version: 1,
      created: toBool(save.created, false),
      look: sanitizeLook(save.look),
      theme: isThemeId(save.theme) ? save.theme : DEFAULT_THEME,
      coins: toInt(save.coins, 0, 0, MAX_COINS),
      xp: toInt(save.xp, 0, 0, MAX_XP),
      owned,
      equipped: sanitizeEquipped(save.equipped, owned),
      gacha: {
        totalPulls: toCounter(gacha.totalPulls),
        sinceEpic: toCounter(gacha.sinceEpic),
        sinceLegendary: toCounter(gacha.sinceLegendary),
      },
      repos: sanitizeRepos(save.repos),
      settings: sanitizeSettings(save.settings),
      stats: {
        bugsSquashed: toCounter(stats.bugsSquashed),
        chestsOpened: toCounter(stats.chestsOpened),
        dungeonsCleared: toCounter(stats.dungeonsCleared),
        wishes: toCounter(stats.wishes),
      },
    };
  } catch {
    // Only reachable with exotic input such as an object whose getters throw.
    return defaultSave();
  }
}

// ──────────────────────── Persistent store ────────────────────────

/** The two Storage methods we need. Tests pass a fake; the browser uses localStorage. */
export type SaveStorage = Pick<Storage, "getItem" | "setItem">;

export interface SaveStore extends Store<SaveData> {
  /** Writes any pending change to storage right now (e.g. before navigating away). */
  flush(): void;
  /**
   * Replaces this tab's save with one that another browser tab just wrote
   * (`text` is the raw localStorage value). Without this, two open tabs would
   * each keep writing their own stale copy and undo each other's progress.
   */
  adoptFromOtherTab(text: string | null): void;
  /**
   * The save the server rendered with: always a default save, because the
   * server has no localStorage. `useStore` uses it while React hydrates, so
   * the first client render matches the server HTML. Always the same object.
   */
  getServerSnapshot(): SaveData;
}

/** localStorage, or null on the server / when the browser blocks it (some private modes throw on access). */
function browserStorage(): SaveStorage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

function loadSave(storage: SaveStorage | null): SaveData {
  if (!storage) return defaultSave();
  try {
    const text = storage.getItem(SAVE_STORAGE_KEY);
    return text ? sanitizeSave(JSON.parse(text)) : defaultSave();
  } catch {
    // Unreadable storage or corrupt JSON: start fresh rather than crash the game.
    return defaultSave();
  }
}

let warnedAboutStorage = false;

function writeSave(storage: SaveStorage, save: SaveData): void {
  try {
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save));
  } catch (error) {
    // Quota exceeded or storage disabled: keep playing in memory, warn once.
    if (!warnedAboutStorage) {
      warnedAboutStorage = true;
      console.warn("Lintlands: could not save progress to localStorage.", error);
    }
  }
}

/**
 * The save as a Store that loads itself from localStorage and writes back
 * every change (batched by SAVE_DEBOUNCE_MS, and flushed immediately when the
 * page is hidden or closed so the last coins are never lost).
 *
 * If the game is open in two tabs, each tab copies in what the other one
 * saves (the browser's `storage` event), so they share one save.
 *
 * Safe to call during server rendering: without `window` it simply holds a
 * default save in memory. Pass `storage` to use something other than
 * localStorage (tests do), or `null` to disable persistence.
 */
export function createSaveStore(storage: SaveStorage | null = browserStorage()): SaveStore {
  const store = createStore(loadSave(storage));
  const serverSnapshot = defaultSave();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let dirty = false;
  /** True while another tab's save is being copied in, so that copy is not written straight back. */
  let adopting = false;

  function flush(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (!dirty || !storage) return;
    dirty = false;
    writeSave(storage, store.get());
  }

  function adoptFromOtherTab(text: string | null): void {
    if (text === null) return; // the other tab cleared its storage: keep what we have
    let incoming: SaveData;
    try {
      incoming = sanitizeSave(JSON.parse(text));
    } catch {
      return; // not a save we can read: ignore it
    }
    // The other tab's save is newer than anything this tab has not written yet.
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    dirty = false;
    adopting = true;
    store.set(() => incoming);
    adopting = false;
  }

  store.subscribe(() => {
    if (adopting) return;
    dirty = true;
    if (timer === null) timer = setTimeout(flush, SAVE_DEBOUNCE_MS);
  });

  if (typeof window !== "undefined") {
    // pagehide is the reliable "page is going away" event (incl. mobile Safari and bfcache);
    // beforeunload and visibilitychange cover older browsers and tab switches.
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
    // Fires only in the *other* tabs of this site when one tab writes to localStorage.
    window.addEventListener("storage", (event) => {
      if (storage !== null && event.storageArea === storage && event.key === SAVE_STORAGE_KEY) adoptFromOtherTab(event.newValue);
    });
  }

  return { ...store, flush, adoptFromOtherTab, getServerSnapshot: () => serverSnapshot };
}
